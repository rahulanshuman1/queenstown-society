/* ===== Security desk: guards log visitors with a photo, residents approve or deny, like a gate app ===== */
const isGuard=()=>{const m=me();return !!m&&m.role==='security'};
const GATE_PURPOSES=['Guest','Delivery','Cab or taxi','Service or repair','Staff or maid','Other'];
const agoShort=t=>{const s=Math.max(0,Math.floor((Date.now()-+D(t))/1000));return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':fdate(t)};
const vFlat=v=>v.flat||uflat(v.userId);
const vThumb=(v,cls='vthumb')=>v.photo?`<img class="${cls}" src="${esc(v.photo)}" alt="Photo of ${esc(v.name)}" data-act="v-photo" data-id="${esc(v.id)}">`:`<span class="${cls} noimg" aria-hidden="true">${ic('visitor')}</span>`;
ACT['v-photo']=d=>{const v=DB.visitors.find(x=>x.id===d.id);if(!v||!v.photo)return;modal(esc(v.name),`<img class="vbig" src="${esc(v.photo)}" alt="Photo of ${esc(v.name)}"><p class="muted" style="margin:10px 0 0">${esc(v.purpose)} · Flat ${esc(vFlat(v))} · ${esc(agoShort(v.date))}</p>`)};

/* ---------- photo capture ---------- */
let GPHOTO='';
function shrinkPhoto(file){return new Promise((ok,bad)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{let max=480,q=.62,out='';for(let n=0;n<6;n++){const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);out=c.toDataURL('image/jpeg',q);if(out.length<=70000)break;max=Math.round(max*.8);q=Math.max(.4,q-.06)}URL.revokeObjectURL(url);out.length<=88000?ok(out):bad(new Error('Photo is too large'))}catch(e){bad(e)}};img.onerror=()=>{URL.revokeObjectURL(url);bad(new Error('Could not read that photo'))};img.src=url})}
const photoField=()=>`<div class="fld full"><span>Visitor photo</span><div class="phbox" id="g_phbox"><div class="phprev" id="g_prev">${ic('camera')}<small>No photo yet</small></div><div class="stack" style="gap:8px"><button type="button" class="btn pri" data-act="g-snap">${ic('camera')}<span id="g_snaplbl">Take photo</span></button><small class="muted">Opens the camera. Ask the visitor to face you.</small></div><input type="file" id="g_file" accept="image/*" capture="environment" hidden></div></div>`;
ACT['g-snap']=()=>{const f=$('#g_file');if(f)f.click()};
document.addEventListener('change',async e=>{const t=e.target;if(!t||t.id!=='g_file'||!t.files||!t.files[0])return;
 try{GPHOTO=await shrinkPhoto(t.files[0]);const p=$('#g_prev');if(p)p.innerHTML=`<img src="${GPHOTO}" alt="Visitor photo preview">`;const l=$('#g_snaplbl');if(l)l.textContent='Retake photo'}catch(er){toast(er.message,'x')}t.value=''});

/* ---------- guard: new visitor ---------- */
ACT['g-new']=()=>{GPHOTO='';modal('New visitor',formWrap('gnew',
 F.s('g_flat','Going to flat',[['','Choose a flat...']].concat(approvedFlats().sort((a,b)=>flatKey(a).localeCompare(flatKey(b),undefined,{numeric:true})).map(u=>[u.id,flatKey(u)+' · '+u.name])),{cls:'full'})+
 F.t('g_name','Visitor name',{req:true,cls:'full',ph:'Name of the visitor'})+
 F.t('g_phone','Visitor mobile (optional)',{attrs:'inputmode="tel" maxlength="12"',ph:'98765 43210'})+
 F.s('g_purpose','Purpose',GATE_PURPOSES.map(x=>[x,x]))+
 F.t('g_veh','Vehicle number (optional)',{cls:'full',ph:'MH 12 AB 1234'})+photoField(),'Ask resident'),{wide:1})};
FORMS.gnew=async d=>{
 if(!d.g_flat)return fErr('Choose the flat this visitor is going to.');
 if(d.g_name.trim().length<2)return fErr('Enter the visitor name.');
 if(!GPHOTO&&!confirm('No photo taken. Send the request without a photo?'))return;
 const u=DB.users.find(x=>x.id===d.g_flat);if(!u)return fErr('That flat was not found.');
 const v={id:uid('v'),userId:u.id,flat:flatKey(u),name:d.g_name.trim(),phone:(d.g_phone||'').replace(/\D/g,''),purpose:d.g_purpose,vehicle:(d.g_veh||'').trim(),photo:GPHOTO,date:new Date().toISOString(),code:'',status:'waiting',byName:me().name,by:me().id};
 DB.visitors.unshift(v);if(!REMOTE)notify(u.id,`${v.name} (${v.purpose}) is at the gate for ${flatKey(u)}. Open Visitors to approve or deny.`,'visitors');
 save();
 if(REMOTE){const rej=await flushWait();if(rej.length)return}
 GPHOTO='';closeModal();UI.tab='wait';render();toast('Request sent to '+flatKey(u)+'. Waiting for their answer.')};
const gSet=(id,s,msg)=>{const v=DB.visitors.find(x=>x.id===id);if(!v)return;v.status=s;if(s==='entered')v.entryAt=Date.now();if(s==='exited')v.exitAt=Date.now();if(!REMOTE&&s==='entered')notify(v.userId,`${v.name} has entered the gate.`,'visitors');save();render();if(msg)toast(msg)};
ACT['g-enter']=d=>gSet(d.id,'entered','Entry recorded');
ACT['g-exit']=d=>gSet(d.id,'exited','Exit recorded');
ACT['g-cancel']=d=>gSet(d.id,'cancelled','Request withdrawn');

/* ---------- guard desk page ---------- */
const GTABS=[['wait','At gate'],['inside','Inside'],['expected','Expected'],['log','History']];
function gateCard(v){
 const st=v.status,who=`Flat ${esc(vFlat(v))}${v.flat?'':' · '+esc(uname(v.userId))}`;
 const act=st==='waiting'?btn('Withdraw','g-cancel',{sm:1,d:{id:v.id}}):(st==='approved'||st==='expected')?btn('Allow entry','g-enter',{sm:1,c:'good',i:'check',d:{id:v.id}}):st==='entered'?btn('Mark exit','g-exit',{sm:1,i:'logout',d:{id:v.id}}):'';
 const note=st==='waiting'?`<span class="pulse">Waiting for ${esc(vFlat(v))} to answer</span>`:st==='denied'?'<b class="bad-t">Resident denied. Do not allow.</b>':st==='approved'?'<b class="good-t">Approved. You can let them in.</b>':st==='entered'&&v.entryAt?`<span>In at ${esc(ftime(v.entryAt))}</span>`:st==='exited'&&v.exitAt?`<span>${esc(ftime(v.entryAt||v.date))} to ${esc(ftime(v.exitAt))}</span>`:'';
 return`<div class="gcard ${st}">${vThumb(v,'vthumb lg')}<div class="sp" style="min-width:0"><h4>${esc(v.name)}</h4><p>${esc(v.purpose)}${v.vehicle?' · '+esc(v.vehicle):''}${v.phone?' · '+esc(v.phone):''}</p><div class="meta">${sChip(st)}<b>${who}</b><span>${esc(agoShort(v.date))}</span></div>${note?`<div class="gnote">${note}</div>`:''}</div><div class="gact">${act}</div></div>`}
ROUTES.gate=()=>{
 const tab=GTABS.some(t=>t[0]===UI.tab)?UI.tab:'wait',all=DB.visitors.slice().sort((a,b)=>D(b.date)-D(a.date)),day0=new Date();day0.setHours(0,0,0,0);
 const recent=v=>Date.now()-(v.decidedAt||+D(v.date))<2*3600e3,wait=all.filter(v=>v.status==='waiting'||v.status==='approved'||(v.status==='denied'&&recent(v))),inside=all.filter(v=>v.status==='entered'),exp=all.filter(v=>v.status==='expected'&&+D(v.date)<=Date.now()+864e5),log=all.filter(v=>['exited','cancelled'].includes(v.status)||(v.status==='denied'&&!recent(v)));
 const sets={wait,inside,expected:exp,log},list=sets[tab];
 const kp=(n,l,t,w)=>`<button class="gk ${tab===t?'on':''} ${w&&n?'warn':''}" data-act="tab" data-v="${t}"><b>${n}</b><span>${l}</span></button>`;
 return head('Security desk','Log every visitor, take a photo and ask the resident to approve.',btn('New visitor','g-new',{c:'pri',i:'plus'}))+
 `<div class="gkpis">${kp(wait.length,'At gate','wait',1)}${kp(inside.length,'Inside now','inside')}${kp(exp.length,'Expected','expected')}${kp(all.filter(v=>+D(v.date)>=+day0).length,'Today','log')}</div>`+
 `<div class="card"><h3>${ic('shield')}Pre-approved visitor</h3><form data-form="gate" class="row wrap-r" style="align-items:flex-end"><label class="fld" style="width:200px"><span>Visitor code</span><input id="g_code" name="g_code" inputmode="numeric" maxlength="6" placeholder="6 digit code" required></label><button class="btn pri" type="submit">Check code</button></form></div>`+
 `<div class="filters">${GTABS.map(([t,l])=>`<button class="pill ${tab===t?'on':''}" data-act="tab" data-v="${t}">${l} (${t==='wait'?wait.length:t==='inside'?inside.length:t==='expected'?exp.length:log.length})</button>`).join('')}</div>`+
 `<div class="stack">${list.length?list.slice(0,80).map(gateCard).join(''):empty('visitor',tab==='wait'?'Nobody is at the gate':tab==='inside'?'No visitors inside':tab==='expected'?'No pre-approved visitors':'No history yet',tab==='wait'?'Tap New visitor when someone arrives at the gate.':'')}</div>`};

/* ---------- resident: approve or deny ---------- */
ACT['v-decide']=d=>{const v=DB.visitors.find(x=>x.id===d.id);if(!v||v.status!=='waiting'){closeModal();render();return toast('This request was already answered.','info')}
 v.status=d.s;v.decidedAt=Date.now();v.decidedBy=me().name;if(!REMOTE)notify('security',`${vFlat(v)} ${d.s==='approved'?'approved':'denied'} ${v.name}.`,'gate');save();closeModal();render();toast(d.s==='approved'?'Approved. Security will let '+v.name+' in.':'Denied. Security has been told.')};
const waitCard=v=>`<div class="gcard waiting big">${vThumb(v,'vthumb xl')}<div class="sp" style="min-width:0"><span class="pulse">At the gate now</span><h4>${esc(v.name)}</h4><p>${esc(v.purpose)}${v.vehicle?' · '+esc(v.vehicle):''}${v.phone?' · '+esc(v.phone):''}</p><div class="meta"><span>${esc(agoShort(v.date))}</span>${v.byName?`<span>Security: ${esc(v.byName)}</span>`:''}</div><div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap">${btn('Approve','v-decide',{c:'good',i:'check',d:{id:v.id,s:'approved'}})}${btn('Deny','v-decide',{c:'bad',i:'x',d:{id:v.id,s:'denied'}})}</div></div></div>`;
const alertsCard=()=>('Notification' in window&&Notification.permission==='default')?`<div class="card flat row" style="gap:12px;align-items:center;flex-wrap:wrap"><div class="sp"><b>Get gate alerts on this device</b><p class="muted" style="margin:2px 0 0">Allow notifications so you hear about visitors while this page is open.</p></div>${btn('Allow alerts','alerts-on',{sm:1,c:'pri',i:'bell'})}</div>`:'';
ACT['alerts-on']=async()=>{try{await Notification.requestPermission()}catch(e){}render()};

/* ---------- live alerts: pop-up for residents, sound for guards ---------- */
const SEEN_V=new Set(),GSTAT={};
function beep(){try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=880;g.gain.value=.12;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.frequency.value=1175},140);setTimeout(()=>{o.stop();c.close()},320)}catch(e){}try{navigator.vibrate&&navigator.vibrate([180,80,180])}catch(e){}}
function gateAlerts(){
 if(!DB||!SES||isAdmin())return;const m=me();if(!m)return;
 if(isGuard()){DB.visitors.forEach(v=>{const was=GSTAT[v.id];GSTAT[v.id]=v.status;if(was==='waiting'&&(v.status==='approved'||v.status==='denied')){beep();toast(`${vFlat(v)} ${v.status==='approved'?'approved':'denied'} ${v.name}`,v.status==='approved'?'':'x')}});return}
 const w=DB.visitors.filter(v=>v.status==='waiting'&&!SEEN_V.has(v.id));if(!w.length)return;
 const mr=$('#modal-root');if(mr&&mr.classList.contains('open'))return;
 const v=w[0];SEEN_V.add(v.id);beep();
 if('Notification' in window&&Notification.permission==='granted'&&document.hidden){try{new Notification(`${v.name} is at the gate`,{body:`${v.purpose}. Open the app to approve or deny.`})}catch(e){}}
 setTimeout(()=>modal('Visitor at the gate',`<div class="stack" style="align-items:center;text-align:center">${vThumb(v,'vthumb huge')}<div><h3 style="margin:0">${esc(v.name)}</h3><p class="muted" style="margin:4px 0 0">${esc(v.purpose)}${v.vehicle?' · '+esc(v.vehicle):''}${v.phone?' · '+esc(v.phone):''}</p></div><div class="row" style="gap:10px;justify-content:center;flex-wrap:wrap">${btn('Approve','v-decide',{c:'good',i:'check',d:{id:v.id,s:'approved'}})}${btn('Deny','v-decide',{c:'bad',i:'x',d:{id:v.id,s:'denied'}})}</div></div>`),60)}
/* check every few seconds so a guard and a resident see each other's answer quickly */
if(typeof document!=='undefined')setInterval(()=>{if(SES&&REMOTE&&TOKEN&&!document.hidden)pollRemote()},6000);

/* ---------- admin: security staff ---------- */
const guards=()=>DB.users.filter(u=>u.role==='security');
function guardCard(u){const on=u.status==='staff';return`<div class="card"><div class="row" style="gap:12px;align-items:center"><span class="av">${initials(u.name)}</span><div class="sp"><h4 style="margin:0">${esc(u.name)}</h4><small class="muted">Mobile ${esc(u.mobile)} · ${on?'Active':'Disabled'}</small></div>${chip(on?'Active':'Disabled',on?'good':'bad')}</div><div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${btn('Reset password','reset-pw',{sm:1,i:'lock',d:{id:u.id}})}${btn(on?'Disable':'Enable','g-toggle',{sm:1,d:{id:u.id}})}</div></div>`}
ACT['g-toggle']=d=>{const u=DB.users.find(x=>x.id===d.id);if(!u)return;u.status=u.status==='staff'?'rejected':'staff';logAct((u.status==='staff'?'Enabled':'Disabled')+' security guard '+u.name);save();render();toast(u.status==='staff'?'Guard enabled':'Guard disabled')};
ACT['guard-new']=()=>modal('Add a security guard',formWrap('guardnew',F.t('gd_name','Full name',{req:true,cls:'full'})+F.t('gd_mobile','Mobile number (used to sign in)',{attrs:'inputmode="tel" maxlength="10"',req:true})+F.t('gd_pw','Password',{type:'password',req:true,ph:'At least 6 characters'}),'Add guard'));
FORMS.guardnew=async d=>{const name=d.gd_name.trim(),mob=d.gd_mobile.trim();
 if(name.length<3)return fErr('Enter the guard\'s full name.');if(!/^[6-9]\d{9}$/.test(mob))return fErr('Enter a valid 10 digit mobile number.');if((d.gd_pw||'').length<6)return fErr('Password needs at least 6 characters.');
 if(DB.users.some(u=>u.mobile===mob))return fErr('This mobile number is already used by another account.');
 if(REMOTE){try{await api('/api/admin/security',{method:'POST',body:{name,mobile:mob,password:d.gd_pw}});const r=await api('/api/state');adopt(r.db,r.rev)}catch(e){return fErr(e.message)}}
 else{DB.users.push({id:uid('g'),name,tower:'',flat:'',mobile:mob,email:'',type:'Security',passHash:await sha(d.gd_pw),status:'staff',role:'security',title:'Security',members:1,vehicle:'',showPhone:false,ref:'',created:Date.now()});logAct('Added security guard '+name);save()}
 closeModal();UI.tab='security';render();toast('Guard added. They sign in with their mobile number.')};
