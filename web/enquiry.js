const $=s=>document.querySelector(s);
function newRequestKey(){
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function initEnquiry(download) {
  const form=$('#enquiry-form'),submit=form.querySelector('[type=submit]'),status=$('#enquiry-status');
  let config=null,scope=null,key=null,lastPayload=null,lastReceipt=null,busy=false,widget=null,token='',startedAt=Date.now(),autoBrief='';
  function announce(message,kind='info') {status.hidden=false;status.dataset.kind=kind;status.textContent=message;}
  function showReceipt(data) {
    lastReceipt=data;
    announce(`${data.message}${data.reference?` Reference: ${data.reference}`:''}`,data.status==='delivered'?'success':data.status==='test'?'test':'warning');
    $('#check-delivery').hidden=!['processing','unknown'].includes(data.status);
    submit.disabled=['delivered','processing','unknown'].includes(data.status);
    if(data.status==='failed') { key=null;lastPayload=null; }
    if(data.status==='delivered') submit.textContent='Enquiry received';
    status.focus({preventScroll:true});
  }
  function payload() {
    const values=Object.fromEntries(new FormData(form));
    return {name:values.name.trim(),phone:values.phone.trim(),email:values.email.trim(),city:values.city.trim(),type:values.type,tier:values.tier,message:values.message.trim(),consent:form.elements.consent.checked,consentVersion:config?.consentVersion||'enquiry-2026-10-31',source:scope?'calculator':'enquiry',calculator:scope,website:values.website||''};
  }
  function refreshChallenge(){token='';if(widget!==null&&window.turnstile)window.turnstile.reset(widget);}
  async function api(path,body) {
    const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','Idempotency-Key':key},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!response.headers.get('content-type')?.includes('application/json')) throw new Error('Unexpected response');
    return {response,data:await response.json()};
  }
  async function loadConfig() {
    submit.disabled=true;
    try {
      const response=await fetch('/api/enquiries',{cache:'no-store',signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error();config=await response.json();
      if(!config.ready) {announce('Online enquiry delivery is not active yet. You can download your brief; nothing has been sent.','warning');return;}
      if(config.mode==='test') {announce('Test mode · Use sample details. The server will validate them, but nothing will be sent to the company.','test');submit.textContent='Test my enquiry';submit.disabled=false;return;}
      announce('Your enquiry will be sent securely after you agree and complete the security check.');
      if(!config.turnstileSiteKey)throw new Error();
      const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      script.onload=()=>{widget=window.turnstile.render('#enquiry-challenge',{sitekey:config.turnstileSiteKey,action:'enquiry',theme:'dark',callback:value=>{token=value;submit.disabled=busy||['delivered','unknown','processing'].includes(lastReceipt?.status);},'expired-callback':()=>{token='';submit.disabled=true;announce('The security check expired. Please complete it again.','warning');refreshChallenge();},'error-callback':()=>{token='';submit.disabled=true;announce('The security check could not load. Please reload or download your brief.','warning');}});};
      script.onerror=()=>announce('The security check could not load. Please reload or download your brief.','warning');document.head.append(script);
    } catch {announce('The enquiry service is unavailable. Nothing is confirmed as sent. You can download your brief and try again later.','warning');}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity()||!config?.ready)return;
    if(scope&&(scope.type!==form.elements.type.value||scope.tier!==form.elements.tier.value)){announce('Your collection or project type changed. Recalculate the budget or remove the attached estimate before sending.','warning');return;}
    if(config.mode==='live'&&!token){announce('Please complete the security check.','warning');return;}
    const data=payload(),fingerprint=JSON.stringify(data);
    if(lastReceipt && ['unknown','processing'].includes(lastReceipt.status)){announce('Delivery is still unconfirmed. Check the existing status before sending another enquiry.','warning');return;}
    if(fingerprint!==lastPayload){key=newRequestKey();lastPayload=fingerprint;}
    const fields=[...form.elements];const priorDisabled=fields.map(e=>e.disabled);
    fields.forEach(e=>e.disabled=true);$('#download-enquiry').disabled=true;busy=true;form.setAttribute('aria-busy','true');submit.textContent='Checking delivery…';
    announce('Submitting securely. Please keep this page open.');
    try {
      const {response,data:result}=await api('/api/enquiries',{...data,startedAt,turnstileToken:token});
      if(!response.ok && result.status!=='unknown') {
        lastReceipt=null;announce(result.message,'warning');
        for(const [name,message] of Object.entries(result.fields||{})){const field=form.elements[name];if(field?.setCustomValidity){field.setCustomValidity(message);field.setAttribute('aria-invalid','true');}}
        if(response.status===409){key=null;lastPayload=null;}
      } else showReceipt(result);
    } catch {showReceipt({status:'unknown',message:'Connection interrupted. Delivery is unconfirmed. Check the status before submitting again.'});}
    finally {
      busy=false;$('#download-enquiry').disabled=false;fields.forEach((e,i)=>e.disabled=lastReceipt?.status==='delivered'||priorDisabled[i]);form.removeAttribute('aria-busy');
      submit.textContent=lastReceipt?.status==='delivered'?'Enquiry received':config.mode==='test'?'Test my enquiry':'Send my enquiry';
      submit.disabled=['delivered','unknown','processing'].includes(lastReceipt?.status)||config.mode==='live';
      refreshChallenge();
      form.reportValidity();
    }
  });
  form.addEventListener('input',event=>{if(event.target.setCustomValidity){event.target.setCustomValidity('');event.target.removeAttribute('aria-invalid');}});
  $('#check-delivery').addEventListener('click',async()=>{
    if(!key||busy)return;busy=true;$('#check-delivery').disabled=true;
    try {const {response,data}=await api('/api/enquiries/status',{});if(response.status===404){lastReceipt=null;submit.disabled=config.mode==='live'&&!token;announce('No receipt was found. You can retry this enquiry.','warning');$('#check-delivery').hidden=true;}else if(response.ok)showReceipt(data);else announce(data.message,'warning');}
    catch{announce('Status is unavailable. Delivery remains unconfirmed. Please keep this page open and check again.','warning');}
    finally{busy=false;$('#check-delivery').disabled=false;}
  });
  $('#download-enquiry').addEventListener('click',()=>{
    const data=lastReceipt?.status==='delivered'?JSON.parse(lastPayload):payload();download('Turnkey_Project_Enquiry.txt',`THE TURNKEY COMPANY\nPROJECT ENQUIRY\n\nName: ${data.name}\nMobile: ${data.phone}\nEmail: ${data.email}\nCity: ${data.city}\nProject: ${data.type}\nCollection: ${data.tier}\n\n${data.message}\n\nCalculator scope: ${data.calculator?JSON.stringify(data.calculator):'Not attached'}\nConsent: ${data.consent?'Given':'Not given'}\nDelivery status: ${lastReceipt?.status||'Not submitted'}\nReference: ${lastReceipt?.reference||'None'}\n${lastReceipt?.status==='delivered'?'Accepted by the lead system; not a WhatsApp delivery confirmation.':'No confirmed delivery to the company.'}\n`);
  });
  $('#remove-estimate').addEventListener('click',()=>{if(form.elements.message.value===autoBrief)form.elements.message.value='';setScope(null);announce('Estimate removed. Please review your project brief before sending.');});
  function setScope(value) {
    if(!value && scope && form.elements.message.value===autoBrief)form.elements.message.value='';
    scope=value?{...value}:null;autoBrief=value?form.elements.message.value:'';
    $('#attached-estimate').hidden=!scope;
    $('#attached-estimate-text').textContent=scope?`${scope.type==='office'?'Office / Commercial':'Residential'} · ${scope.tier} · ${scope.area.toLocaleString('en-IN')} sq ft. Selected options and the server-calculated indicative budget will be included.`:'';
    if(lastReceipt?.status==='delivered'){announce('Your previous enquiry was received. Reload the page to start a new enquiry.');}
  }
  loadConfig();
  return {setScope};
}
