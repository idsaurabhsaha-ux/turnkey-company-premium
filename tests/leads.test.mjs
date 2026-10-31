import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLeadRequest,validateLead,configuration,deliver,digest,CONSENT_VERSION } from '../server/leads.mjs';
import {d1Store} from '../server/store.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

const origin='https://turnkey.test',clock=Date.now();
const input=()=>({name:'Test Client',phone:'+91 9876543210',email:'sample@example.invalid',city:'Bilaspur',type:'residential',tier:'Premium',message:'Kitchen and storage\nScope review',consent:true,consentVersion:CONSENT_VERSION,source:'calculator',calculator:{type:'residential',tier:'Premium',area:1200,kitchen:true,storage:true,waterproofing:false,estimate:{subtotal:1}},website:'',startedAt:clock-5000,turnstileToken:'challenge-token'});
const live=()=>({LEAD_MODE:'live',ALLOWED_ORIGINS:origin,LEAD_HASH_SECRET:'h'.repeat(32),TURNSTILE_SITE_KEY:'site-key',TURNSTILE_SECRET_KEY:'secret-key',TURNSTILE_HOSTNAMES:'turnkey.test',PRIVACY_NOTICE_APPROVED:'true',LEAD_PROVIDER:'webhook',LEAD_WEBHOOK_URL:'https://crm.example.invalid/lead',LEAD_WEBHOOK_ALLOWED_HOSTS:'crm.example.invalid',LEAD_WEBHOOK_TOKEN:'test-token',LEAD_WEBHOOK_SIGNING_SECRET:'s'.repeat(32)});
function database(){
 const sql=new DatabaseSync(':memory:');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')))sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const db={prepare(query){let params=[];return {bind(...args){params=args;return this;},async first(){return sql.prepare(query).get(...params)||null;},async run(){return {meta:{changes:sql.prepare(query).run(...params).changes}};}};},async batch(items){return Promise.all(items.map(x=>x.run()));}};
 return {store:d1Store(db),sql};
}
function request(body=input(),key=crypto.randomUUID(),path='',headers={}){return new Request(origin+'/api/enquiries'+path,{method:'POST',headers:{origin,'content-type':'application/json','idempotency-key':key,'cf-connecting-ip':'192.0.2.1',...headers},body:typeof body==='string'?body:JSON.stringify(body)});}
async function parsed(r){return {...await r.json(),httpStatus:r.status};}
const opts=fetcher=>({now:()=>clock,fetcher});
function provider(calls=[],kind='ack') { return async(url,options)=>{
 calls.push({url,options});
 if(url.includes('siteverify'))return Response.json({success:true,hostname:'turnkey.test',action:'enquiry'});
 if(kind==='throw')throw new Error('secret token must not leak');
 if(kind==='error')return Response.json({error:'private provider text'},{status:401});
 if(kind==='plain200')return Response.json({ok:true});
 if(kind==='async')return Response.json({accepted:true},{status:202});
 const body=JSON.parse(options.body);return Response.json({accepted:true,leadId:body.id,receiptId:'fixture-receipt'});
 };}

test('required fields, enums, consent, types and calculator tamper protection',()=>{
 const lead=validateLead(input());assert.equal(lead.contact.phone,'9876543210');assert.equal(lead.calculator.estimate.subtotal,3940000);assert.equal(lead.calculator.estimate.low,3546000);
 for(const change of [{name:' '},{email:'bad'},{phone:'123'},{city:'a'},{consent:'true'},{consentVersion:'old'},{type:'bad'},{tier:'bad'},{message:'a'.repeat(2001)},{source:'other'},{calculator:{...input().calculator,area:1}},{calculator:{...input().calculator,kitchen:'false'}},{tier:'Essential'}])assert.throws(()=>validateLead({...input(),...change}));
 const direct={...input(),source:'enquiry',calculator:null};assert.equal(validateLead(direct).calculator,null);
});
test('fail closed config, no secret exposure, HTTPS allowlist and dummy CAPTCHA rejection',async()=>{
 for(const change of [{},{LEAD_MODE:'live'},{...live(),PRIVACY_NOTICE_APPROVED:'false'},{...live(),LEAD_WEBHOOK_URL:'http://crm.example.invalid/lead'},{...live(),LEAD_WEBHOOK_URL:'https://evil.invalid/lead'},{...live(),TURNSTILE_SITE_KEY:'1x00000000000000000000AA'}])assert.equal(configuration(change).ready,false);
 assert.equal(configuration(live()).ready,true);
 const r=await handleLeadRequest(new Request(origin+'/api/enquiries'),live(),null);const data=await r.text();assert.ok(!data.includes('secret-key'));assert.ok(!data.includes('test-token'));
 assert.equal((await parsed(await handleLeadRequest(request(),{},database().store))).httpStatus,503);
});
test('origin, content type, JSON size, honeypot, fast submit and invalid fields rejected before provider',async()=>{
 const store=database().store,calls=[],env=live();
 for(const [req,code] of [[request(input(),crypto.randomUUID(),'',{origin:'https://evil.test'}),403],[request(input(),crypto.randomUUID(),'',{'content-type':'text/plain'}),415],[request('{'),400],[request(JSON.stringify({message:'a'.repeat(20000)})),413],[request({...input(),website:'spam'}),422],[request({...input(),startedAt:clock}),422],[request({...input(),name:''}),422]])assert.equal((await handleLeadRequest(req,env,store,opts(provider(calls)))).status,code);
 assert.equal(calls.length,0);
});
test('test environment validates but never calls CRM and stores no contact/brief',async()=>{
 const {store,sql}=database();let called=false;
 const r=await parsed(await handleLeadRequest(request(),{LEAD_MODE:'test',ENABLE_TEST_MODE:'true'},store,opts(()=>{called=true;})));
 assert.equal(r.status,'test');assert.equal(r.delivered,false);assert.equal(called,false);
 const rows=JSON.stringify(sql.prepare('SELECT * FROM lead_receipts').all());for(const value of ['9876543210','sample@','Test Client','Kitchen'])assert.ok(!rows.includes(value));
});
test('webhook verified receipt, signature, server budget, duplicate replay and conflict',async()=>{
 const {store}=database(),calls=[],env=live(),key=crypto.randomUUID();
 const r=await parsed(await handleLeadRequest(request(input(),key),env,store,opts(provider(calls))));assert.equal(r.status,'delivered');assert.equal(r.httpStatus,201);
 const outbound=calls.find(c=>c.url===env.LEAD_WEBHOOK_URL);assert.equal(outbound.options.redirect,'error');
 assert.equal(outbound.options.headers['X-Turnkey-Signature'],'sha256='+await digest(outbound.options.headers['X-Turnkey-Timestamp']+'.'+outbound.options.body,env.LEAD_WEBHOOK_SIGNING_SECRET));
 const lead=JSON.parse(outbound.options.body);assert.equal(lead.calculator.estimate.subtotal,3940000);assert.equal(lead.consent.version,CONSENT_VERSION);
 const again=await parsed(await handleLeadRequest(request(input(),key),env,store,opts(provider(calls))));assert.equal(again.reference,r.reference);assert.equal(calls.length,2);
 assert.equal((await handleLeadRequest(request({...input(),city:'Raipur'},key),env,store,opts(provider(calls)))).status,409);
 assert.equal((await parsed(await handleLeadRequest(request({},key,'/status'),env,store,opts(provider(calls))))).status,'delivered');
});
test('unacknowledged 2xx, async queues, timeouts stay unknown; definite rejection is failed',async()=>{
 for(const [kind,state] of [['plain200','unknown'],['async','unknown'],['throw','unknown'],['error','failed']]){
  const r=await parsed(await handleLeadRequest(request(),live(),database().store,opts(provider([],kind))));assert.equal(r.status,state);assert.equal(r.delivered,false);assert.ok(!JSON.stringify(r).includes('private provider'));
 }
});
test('Turnstile hostname/action/failure checks and unavailable verification block delivery',async()=>{
 for(const result of [{success:false},{success:true,hostname:'evil.test',action:'enquiry'},{success:true,hostname:'turnkey.test',action:'login'}]){
  let count=0;const r=await handleLeadRequest(request(),live(),database().store,opts(async()=>{count++;return Response.json(result);}));assert.equal(r.status,422);assert.equal(count,1);
 }
 assert.equal((await handleLeadRequest(request(),live(),database().store,opts(async()=>{throw new Error();}))).status,503);
});
test('rate limit is persisted in D1 and reply supplies retry delay',async()=>{
 const {store}=database();let r;
 for(let i=0;i<16;i++)r=await handleLeadRequest(request({...input(),consent:false}),live(),store,opts(provider()));
 assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'600');
});
test('concurrent same-key submissions produce exactly one provider delivery',async()=>{
 const {store}=database(),key=crypto.randomUUID(),calls=[];
 const responses=await Promise.all([1,2,3].map(()=>handleLeadRequest(request(input(),key),live(),store,opts(provider(calls)))));
 assert.equal(calls.filter(c=>c.url===live().LEAD_WEBHOOK_URL).length,1);for(const r of responses)assert.ok([200,201].includes(r.status));
});
test('database outage never returns success',async()=>{
 const broken={allow:async()=>{throw new Error('secret');}};
 const r=await parsed(await handleLeadRequest(request(),live(),broken));assert.equal(r.httpStatus,503);assert.equal(r.status,'unknown');assert.ok(!JSON.stringify(r).includes('secret'));
});
test('Interakt adapter normalizes phone/traits, includes calculator and requires explicit result',async()=>{
 const lead={...validateLead(input()),id:crypto.randomUUID(),createdAt:new Date().toISOString()},env={...live(),LEAD_PROVIDER:'interakt',INTERAKT_API_KEY:'fixture-key'};
 for(const [data,status] of [[{result:true},'delivered'],[{result:false},'failed'],[{},'unknown']]){
  const r=await deliver(lead,env,async(url,options)=>{assert.ok(['https://api.interakt.ai/v1/public/track/users/','https://api.interakt.ai/v1/public/track/events/'].includes(url));assert.equal(options.headers.Authorization,'Basic fixture-key');const b=JSON.parse(options.body);assert.equal(b.countryCode,'+91');assert.equal(b.traits.budget_low_inr,3546000);assert.ok(!b.traits.project_brief.includes('\n'));return Response.json(data);});assert.equal(r.status,status);
 }
});
test('processing interrupted beyond one minute is unconfirmed and never resends',async()=>{
 const {store}=database(),env=live(),key=crypto.randomUUID();const keyHash=await digest('key:'+key,env.LEAD_HASH_SECRET);await store.claim({id:crypto.randomUUID(),keyHash,payloadHash:'hash',status:'processing',createdAt:clock-61000});
 const r=await parsed(await handleLeadRequest(request({},key,'/status'),env,store,opts(provider())));assert.equal(r.status,'unknown');
});

test('Interakt partial contact success with event rejection remains unconfirmed',async()=>{
 const lead={...validateLead(input()),id:crypto.randomUUID(),createdAt:new Date().toISOString()};let calls=0;
 const r=await deliver(lead,{...live(),LEAD_PROVIDER:'interakt',INTERAKT_API_KEY:'fixture-key'},async(url,options)=>{calls++;if(url.endsWith('/users/'))return Response.json({result:true});assert.equal(JSON.parse(options.body).event,'WebsiteEnquiryReceived');return Response.json({result:false},{status:400});});assert.equal(calls,2);assert.equal(r.status,'unknown');
});
