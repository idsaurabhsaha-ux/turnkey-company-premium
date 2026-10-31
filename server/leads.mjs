import { calculateEstimate } from '../web/calculator.js';

export const CONSENT_VERSION = 'enquiry-2026-10-31';
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states = {
  delivered: 'Your enquiry was accepted by our lead system. This confirms receipt, not a WhatsApp message or a team response.',
  test: 'Test complete. Your details were validated, but no enquiry was sent to the company.',
  processing: 'Your enquiry is being checked. Delivery has not yet been confirmed.',
  unknown: 'We could not confirm delivery. Please keep your reference and check the status before submitting again.',
  failed: 'The lead system did not accept this enquiry. Your details are still available here; please retry later.'
};
export class LeadError extends Error {
  constructor(status, code, message, fields = {}) { super(message); Object.assign(this, {status, code, fields}); }
}
const fail = (status, code, message, fields) => { throw new LeadError(status, code, message, fields); };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: {
  'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...extra
}});
export async function digest(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function strings(value, min, max) { return typeof value==='string' && value.trim().length>=min && value.trim().length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value); }
export function validateLead(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) fail(400,'invalid_payload','Please check the enquiry details.');
  const fields = {};
  const contact = {};
  for(const [k,min,max] of [['name',2,80],['email',3,120],['city',2,80]]) {
    if(!strings(input[k],min,max) || /[\r\n\t]/.test(input[k])) fields[k]=`Please enter a valid ${k}.`;
    else contact[k]=input[k].trim();
  }
  if(contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fields.email='Please enter a valid email address.';
  const phone=typeof input.phone==='string'?input.phone.replace(/[ -]/g,'').replace(/^\+91/,''):'';
  if(!/^[6-9]\d{9}$/.test(phone)) fields.phone='Enter a valid 10-digit Indian mobile number.';
  if(!['residential','office','hospitality','healthcare'].includes(input.type)) fields.type='Choose a project type.';
  if(!['Not sure yet','Essential','Elevate','Premium'].includes(input.tier)) fields.tier='Choose a collection.';
  if(!strings(input.message ?? '',0,2000)) fields.message='Keep the project brief within 2,000 characters.';
  if(input.consent!==true || input.consentVersion!==CONSENT_VERSION) fields.consent='Please agree to the current enquiry privacy notice.';
  if(!['enquiry','calculator'].includes(input.source)) fields.source='Please reopen the enquiry form.';
  let calculator=null;
  if(input.source==='calculator') {
    const s=input.calculator;
    if(!s || typeof s!=='object' || !['kitchen','storage','waterproofing'].every(k=>typeof s[k]==='boolean') || !Number.isInteger(s.area)) fields.calculator='Please recalculate your budget.';
    else {
      try {
        const scope={type:s.type,tier:s.tier,area:s.area,kitchen:s.kitchen,storage:s.storage,waterproofing:s.waterproofing};
        if(scope.type!==input.type || scope.tier!==input.tier) throw new Error();
        calculator={scope,estimate:calculateEstimate(scope),pricingVersion:'illustrative-2026-10-31',currency:'INR',isQuotation:false};
      } catch { fields.calculator='The project type or collection changed. Please recalculate your budget or remove the estimate.'; }
    }
  } else if(input.calculator!=null) fields.calculator='Please select the calculator enquiry source.';
  if(Object.keys(fields).length) fail(422,'validation_failed','Please correct the highlighted details.',fields);
  return {contact:{...contact,phone,countryCode:'+91'},project:{type:input.type,tier:input.tier,message:(input.message||'').trim()},source:input.source,calculator,consent:{given:true,version:CONSENT_VERSION,purpose:'Respond to this project enquiry; no marketing opt-in'}};
}
export function configuration(env) {
  const mode=env.LEAD_MODE || 'disabled';
  const origins=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  let ready=false;
  if(mode==='test') ready=env.ENABLE_TEST_MODE==='true';
  if(mode==='live') {
    const secureOrigins=origins.length>0 && origins.every(s=>{try {const u=new URL(s);return u.protocol==='https:'&&u.origin===s;}catch{return false;}});
    ready=!!(secureOrigins && env.LEAD_HASH_SECRET?.length>=32 && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.TURNSTILE_HOSTNAMES && env.PRIVACY_NOTICE_APPROVED==='true');
    // Cloudflare's public test keys must never activate live collection.
    if(/^[123]x0{10}/.test(env.TURNSTILE_SECRET_KEY||'') || /^[123]x0{10}/.test(env.TURNSTILE_SITE_KEY||'')) ready=false;
    if(env.LEAD_PROVIDER==='interakt') ready=ready && !!env.INTERAKT_API_KEY;
    else if(env.LEAD_PROVIDER==='webhook') {
      try {
        const u=new URL(env.LEAD_WEBHOOK_URL);
        const hosts=(env.LEAD_WEBHOOK_ALLOWED_HOSTS||'').split(',').map(s=>s.trim());
        ready=ready && u.protocol==='https:' && !u.username && !u.password && !u.hash && !u.search && (!u.port||u.port==='443') && hosts.includes(u.hostname) && !/^(localhost|.*\.local|.*\.internal|[\d.]+|\[.*\])$/i.test(u.hostname) && !!env.LEAD_WEBHOOK_TOKEN && env.LEAD_WEBHOOK_SIGNING_SECRET?.length>=32;
      } catch { ready=false; }
    } else ready=false;
  }
  return {mode,origins,ready:!!ready};
}
async function boundedJson(response, limit=16384) {
  if(!response.body) fail(400,'invalid_json','The request body is missing.');
  const reader=response.body.getReader();let length=0,chunks=[];
  while(true) {const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();fail(413,'too_large','The enquiry is too large. Please shorten your brief.');}chunks.push(value);}
  const bytes=new Uint8Array(length);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'invalid_json','Please reload the form and try again.');}
}
export function receipt(row, now=Date.now()) {
  const status=row.status==='processing' && now-row.createdAt>60000?'unknown':row.status;
  return {status,reference:row.id,delivered:status==='delivered',message:states[status]||states.unknown};
}
export async function deliver(lead, env, fetcher=fetch) {
  async function send(url, body, headers) {
    try {
      const r=await fetcher(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(8000)});
      if([400,401,403,404,422,429].includes(r.status)) return {status:'failed'};
      if(!r.ok || r.status===202) return {status:'unknown'};
      const data=await boundedJson(r);
      return {status:'response',data};
    } catch {return {status:'unknown'};}
  }
  if(env.LEAD_PROVIDER==='interakt') {
    const clean=s=>typeof s==='string'?s.replace(/\s+/g,' ').trim():s;
    const traits={name:lead.contact.name,email:lead.contact.email,city:lead.contact.city,website_lead_id:lead.id,project_type:lead.project.type,collection:lead.project.tier,project_brief:lead.project.message,source:lead.source,consent_version:lead.consent.version,enquiry_received_at:lead.createdAt};
    if(lead.calculator){const {scope:s,estimate:e}=lead.calculator;Object.assign(traits,{area_sq_ft:s.area,kitchen:s.kitchen,storage:s.storage,waterproofing:s.waterproofing,budget_low_inr:e.low,budget_high_inr:e.high,budget_with_gst_low_inr:e.totalLow,budget_with_gst_high_inr:e.totalHigh,gst_rate:e.gstRate,pricing_version:lead.calculator.pricingVersion,is_quotation:false});}
    const normalizedTraits=Object.fromEntries(Object.entries(traits).map(([k,v])=>[k,clean(v)]));
    const headers={Authorization:`Basic ${env.INTERAKT_API_KEY}`};
    const contact=await send('https://api.interakt.ai/v1/public/track/users/',{phoneNumber:lead.contact.phone,countryCode:'+91',traits:normalizedTraits,tags:['Website enquiry',lead.project.tier]},headers);
    if(contact.status!=='response')return {status:contact.status};
    if(contact.data?.result!==true)return {status:contact.data?.result===false?'failed':'unknown'};
    // Preserve each enquiry in the contact timeline; user traits alone overwrite history.
    const event=await send('https://api.interakt.ai/v1/public/track/events/',{phoneNumber:lead.contact.phone,countryCode:'+91',event:'WebsiteEnquiryReceived',traits:normalizedTraits},headers);
    // Partial contact creation must never claim complete delivery or auto-retry the event.
    return {status:event.status==='response'&&event.data?.result===true?'delivered':'unknown'};
  }
  const timestamp=String(Math.floor(Date.now()/1000));
  const body=JSON.stringify(lead);
  const signature=await digest(`${timestamp}.${body}`,env.LEAD_WEBHOOK_SIGNING_SECRET);
  const r=await send(env.LEAD_WEBHOOK_URL,lead,{Authorization:`Bearer ${env.LEAD_WEBHOOK_TOKEN}`,'Idempotency-Key':lead.id,'X-Turnkey-Timestamp':timestamp,'X-Turnkey-Signature':`sha256=${signature}`});
  // An arbitrary 2xx or asynchronous queue acknowledgment is not evidence of delivery.
  return {status:r.status==='response'?(r.data?.accepted===true && r.data?.leadId===lead.id && typeof r.data?.receiptId==='string' && r.data.receiptId.length>0?'delivered':'unknown'):r.status};
}
export async function handleLeadRequest(request, env, store, {fetcher=fetch,now=()=>Date.now()}={}) {
  try {
    const config=configuration(env),url=new URL(request.url),isStatus=url.pathname.endsWith('/status');
    if(request.method==='GET' && !isStatus) return json({mode:config.mode,ready:config.ready,consentVersion:CONSENT_VERSION,turnstileSiteKey:config.ready&&config.mode==='live'?env.TURNSTILE_SITE_KEY:null});
    if(request.method!=='POST') return json({code:'method_not_allowed',message:'Use the enquiry form.'},405,{Allow:isStatus?'POST':'GET, POST'});
    const origin=request.headers.get('origin');
    if(!origin || !(config.origins.length?config.origins:[url.origin]).includes(origin) || request.headers.get('sec-fetch-site')==='cross-site') fail(403,'origin_rejected','Please submit from this website.');
    if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415,'unsupported_type','Please use the enquiry form.');
    if(!config.ready || !store) fail(503,'not_configured','Online enquiry delivery is not active yet. You can download your brief; nothing has been sent.');
    const secret=env.LEAD_HASH_SECRET || 'test-only-receipt-hash-no-live-data';
    // IP comes only from Cloudflare, never from browser supplied X-Forwarded-For.
    const ip=request.headers.get('cf-connecting-ip')||'unavailable';
    const rateKey=await digest(`ip:${ip}:${Math.floor(now()/600000)}`,secret);
    if(!await store.allow(rateKey,now(),isStatus?60:15)) fail(429,'rate_limited','Too many attempts. Please wait up to 10 minutes and try again.');
    const key=request.headers.get('idempotency-key');
    if(!uuid.test(key||'')) fail(400,'invalid_key','Please reopen the enquiry form.');
    const keyHash=await digest(`key:${key}`,secret);
    if(isStatus) { const row=await store.get(keyHash);return row?json(receipt(row,now())):json({status:'not_found',message:'No receipt was found. Nothing is confirmed as sent.'},404); }
    const input=await boundedJson(request);
    const lead=validateLead(input);
    if(typeof input.website!=='string' || input.website.trim()) fail(422,'spam_rejected','We could not validate this submission. Please reload the page.');
    if(!Number.isFinite(input.startedAt) || now()-input.startedAt<1500 || now()-input.startedAt>86400000) fail(422,'form_expired','Please wait a moment or reload the form and try again.');
    const payloadHash=await digest(JSON.stringify(lead),secret);
    const existing=await store.get(keyHash);
    if(existing) {
      if(existing.payloadHash!==payloadHash) fail(409,'key_conflict','These details have changed. Start a new enquiry.');
      return json(receipt(existing,now()));
    }
    if(config.mode==='live') {
      if(!strings(input.turnstileToken,1,2048)) fail(422,'challenge_required','Complete the security check and try again.');
      let verification;
      try {
        const response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:input.turnstileToken}),signal:AbortSignal.timeout(5000),redirect:'error'});
        verification=response.ok?await boundedJson(response):null;
      } catch {fail(503,'challenge_unavailable','The security check is unavailable. Please try again shortly.');}
      if(!verification?.success || verification.action!=='enquiry' || !(env.TURNSTILE_HOSTNAMES||'').split(',').map(s=>s.trim()).includes(verification.hostname)) fail(422,'challenge_failed','The security check expired or failed. Please complete it again.');
    }
    const contactKey=await digest(`phone:${lead.contact.phone}:${Math.floor(now()/3600000)}`,secret);
    if(!await store.allow(contactKey,now(),5)) fail(429,'rate_limited','Please wait before sending another enquiry for this mobile number.');
    const row={id:crypto.randomUUID(),keyHash,payloadHash,status:'processing',createdAt:now()};
    if(!await store.claim(row)) return json(receipt(await store.get(keyHash),now()));
    const result=config.mode==='test'?{status:'test'}:await deliver({...lead,id:row.id,createdAt:new Date(row.createdAt).toISOString()},env,fetcher);
    await store.finish(keyHash,result.status);
    return json(receipt({...row,status:result.status},now()),result.status==='delivered'?201:200);
  } catch(e) {
    if(e instanceof LeadError) return json({status:'rejected',code:e.code,message:e.message,fields:e.fields},e.status,e.status===429?{'Retry-After':'600'}:{});
    // No request body, PII, provider response, token or stack is logged/returned.
    return json({status:'unknown',code:'service_unavailable',message:'We could not confirm delivery. Keep your details and check the status before submitting again.'},503);
  }
}
