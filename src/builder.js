/* ========== No-code builder ==========
   The committee shapes the app without code. Everything here is data (a "blueprint") saved in
   DB.settings.nocode: which modules residents see, the forms they fill in, and the automations that
   react when something is submitted. QSFlows (server/lib/flows.js) is the one engine that cleans the
   blueprint and decides which automations fire; the API runs it for real, this file runs it in the demo. */
IP.bolt='<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>';
IP.copy=IP.copy||'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>';
IP.download='<path d="M12 3v12M7 11l5 5 5-5M5 21h14"/>';
NAV.splice(3,0,['services','Services','layout']);
ANAV.push(['requests','Requests','book'],['builder','No-code builder','bolt']);

const FT={text:'Short text',longtext:'Long text',number:'Number',date:'Date',select:'Dropdown',checkbox:'Checkbox',phone:'Phone'};
const TRG={'request.created':'a resident submits a form','complaint.created':'a helpdesk ticket is raised'};
const OPL={is:'is',isnot:'is not',contains:'contains',gt:'is more than',lt:'is less than',empty:'is empty'};
const ACL={notify_admin:'Notify the office',notify_resident:'Notify the resident',set_status:'Set the status',assign:'Assign to',post_notice:'Post a notice'};
const MODS={notices:['Notices','Announcements with attachments','notice'],events:['Events','Events, RSVPs and the hero carousel','calendar'],forecast:['Forecast','The next 30 days at a glance','sunrise'],helpdesk:['Helpdesk','Tickets and complaints','chat'],amenities:['Amenities','Clubhouse, gym and slot booking','key'],visitors:['Visitors','Visitor passes and gate approvals','visitor'],marketplace:['Marketplace','Classifieds and banner ads','tag'],polls:['Polls','Votes and surveys','vote'],gallery:['Gallery','Photo albums','image'],accounts:['Accounts','Income and expense ledger (committee)','chart'],documents:['Documents','Bylaws, minutes and forms','book'],directory:['Directory','Residents and emergency contacts','users']};
const MCOUNT={notices:'notices',events:'events',forecast:'schedule',helpdesk:'complaints',amenities:'amenities',visitors:'visitors',marketplace:'ads',polls:'polls',documents:'docs',directory:'contacts',accounts:'entries'};
const BLD={tab:'start',form:null,flow:null};

const nc=()=>{const s=DB.settings;if(!s.nocode)s.nocode=QSFlows.clean({});return s.nocode};
const ncForms=()=>nc().forms,ncForm=id=>nc().forms.find(f=>f.id===id);
function modOn(id){const m=DB&&DB.settings&&DB.settings.nocode&&DB.settings.nocode.modules;return isAdmin()||!m||m[id]!==false}
const formsFor=()=>{const m=me();return ncForms().filter(f=>f.on&&(f.audience==='all'||(m&&f.audience===m.type)))};
const servicesOn=()=>formsFor().length>0;
/* Text boxes save quietly (no redraw), so a click on the next button is never lost; everything else redraws. */
function ncCommit(re=true){
 DB.settings.nocode=QSFlows.clean(nc());save();
 if(re)return render();
 const p=$('#ncprev');if(p&&BLD.tab==='forms')p.innerHTML=formPreview(ncForm(BLD.form));
 const s=$('.sentence'),w=fnd(BLD.flow);if(s&&w)s.innerHTML=describeFlow(w);
 const fm=ncForm(BLD.form),b=$('.frow.on .fr-main b');if(b&&BLD.tab==='forms'&&fm)b.textContent=fm.name;
 const fw=$('.frow.flow.on .fr-main b');if(fw&&w)fw.textContent=w.name}

/* ---------- templates: whole blueprints in one click ---------- */
const Q=(id,label,type,req,options)=>({id,label,type,req:!!req,...(options?{options}:{})});
const TEMPLATES={
 community:{name:'Gated apartment community',note:'Move-in, renovation, parking and NOC forms with smart approvals',icon:'building',bp:()=>({modules:{},forms:[
  {id:'move',name:'Move in / move out',desc:'Book the lift and a time slot for shifting.',icon:'building',fields:[Q('kind','Move in or move out','select',1,['Move in','Move out']),Q('date','Date','date',1),Q('vehicle','Vehicle','select',1,['Hand-carried','Tempo','Mini truck','Truck']),Q('contact','Mover contact number','phone',1),Q('agree','I will pay for any damage to the lift or corridor','checkbox',1)]},
  {id:'reno',name:'Renovation permission',desc:'Ask the committee before any work starts.',icon:'gear',fields:[Q('work','Type of work','select',1,['Painting','Flooring','Plumbing','Electrical','Carpentry','Other']),Q('from','Start date','date',1),Q('days','Working days','number',1),Q('contractor','Contractor name','text',1),Q('details','Describe the work','longtext')]},
  {id:'park',name:'Parking sticker',desc:'Get a sticker for your vehicle.',icon:'key',fields:[Q('type','Vehicle type','select',1,['Two-wheeler','Car']),Q('number','Registration number','text',1),Q('make','Make and model','text')]},
  {id:'noc',name:'NOC or address proof',desc:'Letters for bank, passport or gas connection.',icon:'book',fields:[Q('purpose','What is it for','select',1,['Bank loan','Passport','Gas connection','Other']),Q('details','Anything the office should know','longtext')]}],
  flows:[
   {id:'w-park',name:'Two-wheeler stickers are approved instantly',trigger:'request.created',formId:'park',conds:[{field:'a.type',op:'is',value:'Two-wheeler'}],actions:[{type:'set_status',value:'approved'},{type:'notify_resident',text:'Hi {{name}}, your parking sticker for {{a.number}} is approved. Collect it from the security desk.'}]},
   {id:'w-reno',name:'Long renovations need a committee look',trigger:'request.created',formId:'reno',conds:[{field:'a.days',op:'gt',value:'7'}],actions:[{type:'notify_admin',text:'{{flat}} wants {{a.days}} days of {{a.work}} work. Please review.'}]},
   {id:'w-truck',name:'Truck moves alert the office',trigger:'request.created',formId:'move',conds:[{field:'a.vehicle',op:'is',value:'Truck'}],actions:[{type:'notify_admin',text:'{{flat}} has a truck for a {{a.kind}} on {{a.date}}. Check the lift.'}]},
   {id:'w-lift',name:'Lift tickets go to the lift vendor',trigger:'complaint.created',formId:'',conds:[{field:'category',op:'is',value:'Lift'}],actions:[{type:'assign',value:'Lift vendor (AMC)'},{type:'set_status',value:'in-progress'},{type:'notify_resident',text:'{{name}}, we have informed the lift vendor about: {{title}}.'}]}]})},
 villa:{name:'Villa or plotted community',note:'Contractor passes, water tankers and tree trimming',icon:'tag',bp:()=>({modules:{forecast:false,marketplace:false},forms:[
  {id:'contractor',name:'Contractor entry pass',desc:'Let the gate know who is coming to work.',icon:'visitor',fields:[Q('who','Contractor or company','text',1),Q('phone','Phone','phone',1),Q('work','Work','text',1),Q('from','From','date',1),Q('to','To','date',1)]},
  {id:'tanker',name:'Water tanker request',desc:'Book a tanker for your villa.',icon:'wallet',fields:[Q('count','Number of tankers','number',1),Q('date','Needed on','date',1)]},
  {id:'tree',name:'Garden or tree trimming',desc:'Ask the maintenance crew for a visit.',icon:'flag',fields:[Q('where','Where','select',1,['Front garden','Back garden','Street side']),Q('details','What needs doing','longtext',1)]}],
  flows:[
   {id:'w-tank',name:'Big tanker orders are flagged',trigger:'request.created',formId:'tanker',conds:[{field:'a.count',op:'gt',value:'2'}],actions:[{type:'notify_admin',text:'{{flat}} asked for {{a.count}} tankers on {{a.date}}.'}]},
   {id:'w-pass',name:'Every contractor pass alerts the gate office',trigger:'request.created',formId:'contractor',conds:[],actions:[{type:'notify_admin',text:'Contractor pass: {{a.who}} for {{flat}}, {{a.from}} to {{a.to}}.'},{type:'set_status',value:'approved'}]}]})},
 coliving:{name:'Co-living or hostel',note:'Late passes, guest stays and room changes',icon:'users',bp:()=>({modules:{marketplace:false,accounts:false,polls:false},forms:[
  {id:'late',name:'Late-night pass',desc:'Tell the warden you will return after curfew.',icon:'clock',fields:[Q('date','Date','date',1),Q('back','Expected back by','text',1),Q('why','Reason','select',1,['Work shift','Family event','Travel','Other'])]},
  {id:'guest',name:'Guest stay',desc:'Host a guest overnight.',icon:'users',fields:[Q('guest','Guest name','text',1),Q('nights','Nights','number',1),Q('from','Arriving on','date',1)]},
  {id:'room',name:'Room change request',desc:'Ask for a different room or bed.',icon:'key',fields:[Q('why','Why','longtext',1)]}],
  flows:[
   {id:'w-shift',name:'Work-shift late passes are approved on the spot',trigger:'request.created',formId:'late',conds:[{field:'a.why',op:'is',value:'Work shift'}],actions:[{type:'set_status',value:'approved'},{type:'notify_resident',text:'{{name}}, your late pass for {{a.date}} is approved.'}]},
   {id:'w-nights',name:'Long guest stays go to the warden',trigger:'request.created',formId:'guest',conds:[{field:'a.nights',op:'gt',value:'3'}],actions:[{type:'notify_admin',text:'{{name}} ({{flat}}) wants a guest for {{a.nights}} nights.'}]}]})},
 office:{name:'Office or business park',note:'Courier passes, visitor parking and desk issues',icon:'layout',bp:()=>({modules:{marketplace:false,polls:false,gallery:false,events:false},forms:[
  {id:'courier',name:'Asset or courier gate pass',desc:'Take equipment out or receive a delivery.',icon:'tag',fields:[Q('what','Item','text',1),Q('dir','Direction','select',1,['Going out','Coming in']),Q('date','Date','date',1)]},
  {id:'vpark',name:'Visitor parking',desc:'Reserve a bay for a guest.',icon:'key',fields:[Q('guest','Guest name','text',1),Q('date','Date','date',1),Q('plate','Vehicle number','text')]},
  {id:'desk',name:'Desk or IT issue',desc:'Something is not working at your desk.',icon:'gear',fields:[Q('kind','Type','select',1,['Network','Power','Furniture','Other']),Q('details','Describe','longtext',1)]}],
  flows:[
   {id:'w-out',name:'Equipment leaving the building alerts the office',trigger:'request.created',formId:'courier',conds:[{field:'a.dir',op:'is',value:'Going out'}],actions:[{type:'notify_admin',text:'{{name}} ({{flat}}) is taking out: {{a.what}} on {{a.date}}.'}]},
   {id:'w-vp',name:'Visitor parking is approved automatically',trigger:'request.created',formId:'vpark',conds:[],actions:[{type:'set_status',value:'approved'},{type:'notify_resident',text:'Parking for {{a.guest}} on {{a.date}} is booked.'}]}]})}
};
function applyTemplate(id){const t=TEMPLATES[id];if(!t)return;const bp=t.bp();bp.template=id;DB.settings.nocode=QSFlows.clean(bp);BLD.form=null;BLD.flow=null;save()}

/* ---------- demo mode: run automations here. With an API, the server does it. ---------- */
function ncAutomate(coll,doc,u){
 if(REMOTE)return[];
 const rec={...doc,name:u?u.name:'Society Office',flat:u&&u.tower?flatKey(u):'',form:doc.formName||'',title:doc.title||doc.formName||''};
 const fx=QSFlows.run(DB.settings.nocode,coll==='requests'?'request.created':'complaint.created',rec),said=[];
 for(const e of fx){
  if(e.type==='notify_admin'){notify('admin',e.text,coll==='requests'?'requests':'helpdesk');said.push('office notified')}
  else if(e.type==='notify_resident'&&doc.userId&&doc.userId!=='admin'){notify(doc.userId,e.text,coll==='requests'?'services':'helpdesk');said.push('you were notified')}
  else if(e.type==='set_status'){doc.status=e.value;said.push('status set to '+e.value)}
  else if(e.type==='assign'&&coll==='complaints'){doc.assignee=e.value;said.push('assigned to '+e.value)}
  else if(e.type==='post_notice'){DB.notices.unshift({id:uid('n'),title:e.title,body:e.text||e.title,category:'General',priority:'normal',pinned:false,date:new Date().toISOString(),author:'Society Office (automation)',readBy:[],attachment:null});notify('all','New notice: '+e.title,'notices');said.push('notice posted')}}
 if(fx.length)logAct('Automation ran ('+fx.length+' step'+(fx.length>1?'s':'')+') for '+(doc.formName||doc.title));
 return[...new Set(said)]}

/* First run of the demo: start from the community template and add a few sample requests. */
function ncBoot(){
 DB.requests=DB.requests||[];
 if(DB.settings.nocode&&DB.settings.nocode.forms)return;
 applyTemplate('community');
 const us=DB.users.filter(u=>u.status==='approved'&&u.role!=='admin'&&u.role!=='security').slice(0,3),mk=(u,f,a,st,note,d)=>{const form=ncForm(f);return{id:uid('r'),formId:f,formName:form.name,userId:u.id,name:u.name,flat:flatKey(u),fields:form.fields.map(({id,label,type})=>({id,label,type})),answers:a,status:st,note,created:Date.now()-d*DAY}};
 const D1=new Date(Date.now()+3*DAY).toISOString().slice(0,10),D2=new Date(Date.now()+9*DAY).toISOString().slice(0,10);
 if(us[0])DB.requests.push(mk(us[0],'move',{kind:'Move in',date:D1,vehicle:'Mini truck',contact:'9876512345',agree:true},'pending','',0));
 if(us[1])DB.requests.push(mk(us[1],'reno',{work:'Flooring',from:D2,days:'10',contractor:'Shree Interiors',details:'Replace living room tiles.'},'pending','',1));
 if(us[2])DB.requests.push(mk(us[2],'park',{type:'Two-wheeler',number:'KA01 AB 1234',make:'Honda Activa'},'approved','Approved automatically',2));
 DB.requests.reverse();save()}

/* ---------- resident form drawing (also used for the live preview) ---------- */
function qField(f){
 const id='q_'+f.id,L=esc(f.label)+(f.req?' *':'');
 switch(f.type){
  case'longtext':return F.a(id,L,{cls:'full',req:f.req});
  case'select':return F.s(id,L,[['','Choose...'],...f.options],{req:f.req});
  case'checkbox':return F.c(id,esc(f.label)+(f.req?' *':''),false);
  case'number':return F.t(id,L,{type:'number',req:f.req,attrs:'inputmode="decimal"'});
  case'date':return F.t(id,L,{type:'date',req:f.req});
  case'phone':return F.t(id,L,{type:'tel',req:f.req,attrs:'inputmode="tel"'});
  default:return F.t(id,L,{req:f.req})}}
function formPreview(f){
 if(!f)return`<div class="empty">${ic('layout')}<b>Pick a form to edit</b><span>The live preview appears here.</span></div>`;
 return`<div class="pv-head">${ic(f.icon)}<div><b>${esc(f.name)}</b><small>${esc(f.desc)||'No description'}</small></div></div><fieldset disabled class="pv-fs"><div class="frm">${f.fields.map(qField).join('')||'<p class="muted full">No questions yet. Add one on the left.</p>'}</div></fieldset>`}

/* ---------- builder page ---------- */
const BTABS=[['start','Start','layout'],['modules','Modules','gear'],['forms','Forms','book'],['flows','Automations','bolt'],['code','Blueprint','copy']];
ROUTES.builder=()=>{
 if(!isAdmin())return ROUTES.home();
 const n=nc();
 return`<div class="stack">${head('No-code builder','Shape the whole app without writing code. Changes go live the moment you make them.',`<span class="chip good">${ic('check')}Live and saved</span>`)}
 <div class="tabs2 bld-tabs" role="tablist">${BTABS.map(t=>`<button role="tab" class="${BLD.tab===t[0]?'on':''}" aria-selected="${BLD.tab===t[0]}" data-act="bld-tab" data-t="${t[0]}">${ic(t[2])}<span>${t[1]}</span></button>`).join('')}</div>
 ${BLD.tab==='modules'?bModules(n):BLD.tab==='forms'?bForms(n):BLD.tab==='flows'?bFlows(n):BLD.tab==='code'?bCode(n):bStart(n)}</div>`};
ACT['bld-tab']=d=>{BLD.tab=d.t;render()};

function bStart(n){
 const on=Object.keys(MODS).filter(k=>n.modules[k]!==false).length,pend=DB.requests.filter(r=>r.status==='pending').length,act=n.flows.filter(w=>w.on).length;
 const kp=(i,v,l)=>`<div class="kpi"><span class="k-ic">${ic(i)}</span><div><b>${v}</b><small>${l}</small></div></div>`;
 return`<div class="grid kpis4">${kp('gear',on+' / '+Object.keys(MODS).length,'modules switched on')}${kp('book',n.forms.length,'custom forms')}${kp('bolt',act,'automations running')}${kp('check',pend,'requests waiting')}</div>
 <section class="card"><h3>${ic('layout')}Start from a template</h3><p class="muted" style="margin:-4px 0 12px">One tap sets up the modules, forms and automations for a kind of community. You can change everything afterwards.</p>
 <div class="tiles tpl">${Object.entries(TEMPLATES).map(([id,t])=>`<button type="button" class="tile ${n.template===id?'on':''}" data-act="tpl-apply" data-id="${id}" data-confirm="1">${ic(t.icon)}<b>${esc(t.name)}</b><small>${esc(t.note)}</small>${n.template===id?'<span class="chip good">In use</span>':''}</button>`).join('')}</div></section>
 <section class="card"><h3>${ic('info')}How the builder works</h3><div class="steps card flat"><div><span class="n">1</span><div><b>Modules</b><br><small>Switch features on or off. Residents see only what you enable.</small></div></div><div><span class="n">2</span><div><b>Forms</b><br><small>Design any request form by adding questions. It appears under Services.</small></div></div><div><span class="n">3</span><div><b>Automations</b><br><small>When something is submitted, check the answers and act: approve, notify, assign, post a notice.</small></div></div></div>
 <p class="muted" style="margin-top:10px">${REMOTE?'Automations run on the server, so a resident can never skip or fake them.':'Demo mode: automations run in this browser. With the API connected they run on the server.'}</p></section>`}
ACT['tpl-apply']=d=>{applyTemplate(d.id);toast('Template applied: '+TEMPLATES[d.id].name);render()};

function bModules(n){
 const items=Object.entries(MODS);
 const phone=NAV.filter(x=>x[0]==='accounts'?false:x[0]==='services'?n.forms.some(f=>f.on):n.modules[x[0]]!==false);
 return`<div class="split"><section class="card"><h3>${ic('gear')}What residents can use</h3><p class="muted" style="margin:-4px 0 12px">Home and Maintenance are always on. Admins keep access to everything.</p>
 <div class="mods">${items.map(([k,[t,d,i]])=>{const c=MCOUNT[k]?(DB[MCOUNT[k]]||[]).length:null;return`<label class="mod ${n.modules[k]===false?'off':''}"><span class="mi">${ic(i)}</span><span class="mt"><b>${t}</b><small>${d}${c!=null?' · '+c+' item'+(c===1?'':'s'):''}</small></span><span class="tgl"><input type="checkbox" data-nc="mod|${k}" ${n.modules[k]===false?'':'checked'} aria-label="${t}"><span class="sw"></span></span></label>`}).join('')}</div></section>
 <aside class="card phonecard"><h3>${ic('eye')}Resident menu</h3><div class="phone" aria-label="Preview of the resident menu"><div class="pn"><b>${esc(DB.settings.name)}</b></div><div class="pm">${phone.map(x=>`<div class="pi">${ic(x[2])}${x[1]}</div>`).join('')}</div></div><small class="muted">Updates as you switch modules.</small></aside></div>`}

function bForms(n){
 const f=ncForm(BLD.form);
 const list=`<section class="card"><h3>${ic('book')}Your forms</h3><div class="stack">${n.forms.map(x=>`<div class="frow ${BLD.form===x.id?'on':''}"><button type="button" class="fr-main" data-act="form-pick" data-id="${x.id}">${ic(x.icon)}<span><b>${esc(x.name)}</b><small>${x.fields.length} question${x.fields.length===1?'':'s'}${x.on?'':' · hidden'}</small></span></button><button type="button" class="iconbtn" data-act="form-del" data-id="${x.id}" data-confirm="1" aria-label="Delete ${esc(x.name)}">${ic('trash')}</button></div>`).join('')||`<p class="muted">No forms yet.</p>`}
 <button type="button" class="btn acc" data-act="form-new">${ic('plus')}New form</button></div></section>`;
 if(!f)return`<div class="split">${list}<aside class="card"><div id="ncprev">${formPreview(null)}</div></aside></div>`;
 const o=(k,v)=>`data-nc="form|${f.id}|${k}"`;
 const edit=`<section class="card"><h3>${ic('edit')}Edit form</h3><div class="stack">
 <div class="frm"><label class="fld full"><span>Form name</span><input ${o('name')} value="${esc(f.name)}" maxlength="60"></label>
 <label class="fld full"><span>Short description</span><input ${o('desc')} value="${esc(f.desc)}" maxlength="200"></label>
 <label class="fld"><span>Who can use it</span><select ${o('audience')}>${[['all','All residents'],['Owner','Owners only'],['Tenant','Tenants only']].map(([v,t])=>`<option value="${v}" ${f.audience===v?'selected':''}>${t}</option>`).join('')}</select></label>
 <label class="fld"><span>Icon</span><select ${o('icon')}>${QSFlows.ICONS.map(i=>`<option ${f.icon===i?'selected':''}>${i}</option>`).join('')}</select></label></div>
 <label class="tgl"><input type="checkbox" ${o('on')} ${f.on?'checked':''}><span class="sw"></span>Visible to residents</label>
 <h4 style="margin:6px 0 0">Questions</h4>
 ${f.fields.map((q,i)=>`<div class="qrow"><div class="qtop"><select data-nc="field|${f.id}|${q.id}|type" aria-label="Type">${QSFlows.FIELD_TYPES.map(t=>`<option value="${t}" ${q.type===t?'selected':''}>${FT[t]}</option>`).join('')}</select><input data-nc="field|${f.id}|${q.id}|label" value="${esc(q.label)}" maxlength="80" aria-label="Question"><div class="qact"><button type="button" class="iconbtn" data-act="q-move" data-f="${f.id}" data-q="${q.id}" data-d="-1" ${i?'':'disabled'} aria-label="Move up">${ic('cl','rot90')}</button><button type="button" class="iconbtn" data-act="q-move" data-f="${f.id}" data-q="${q.id}" data-d="1" ${i<f.fields.length-1?'':'disabled'} aria-label="Move down">${ic('cr','rot90')}</button><button type="button" class="iconbtn" data-act="q-del" data-f="${f.id}" data-q="${q.id}" aria-label="Remove question">${ic('trash')}</button></div></div>
  <div class="qbot">${q.type==='select'?`<label class="fld sp"><span>Options, separated by commas</span><input data-nc="field|${f.id}|${q.id}|options" value="${esc(q.options.join(', '))}"></label>`:''}<label class="tgl"><input type="checkbox" data-nc="field|${f.id}|${q.id}|req" ${q.req?'checked':''}><span class="sw"></span>Required</label></div></div>`).join('')}
 <div class="addq"><small>Add a question:</small>${QSFlows.FIELD_TYPES.map(t=>`<button type="button" class="pill" data-act="q-add" data-f="${f.id}" data-t="${t}">+ ${FT[t]}</button>`).join('')}</div></div></section>`;
 return`<div class="split">${edit}<aside class="card pv"><h3>${ic('eye')}What residents see</h3><div id="ncprev">${formPreview(f)}</div></aside></div>`}
ACT['form-pick']=d=>{BLD.form=d.id;render()};
ACT['form-new']=()=>{const id=uid('f');nc().forms.push({id,name:'New form',desc:'',icon:'layout',on:true,audience:'all',fields:[Q('q1','Your question','text',1)]});BLD.form=id;ncCommit()};
ACT['form-del']=d=>{const n=nc();n.forms=n.forms.filter(f=>f.id!==d.id);n.flows.forEach(w=>{if(w.formId===d.id){w.formId='';w.on=false}});if(BLD.form===d.id)BLD.form=null;ncCommit();toast('Form deleted. Automations that used it were paused.','info')};
ACT['q-add']=d=>{const f=ncForm(d.f);if(!f||f.fields.length>=15)return toast('A form can have up to 15 questions.','x');f.fields.push(Q(uid('q'),'New '+FT[d.t].toLowerCase()+' question',d.t,0,d.t==='select'?['Option 1','Option 2']:null));ncCommit()};
ACT['q-del']=d=>{const f=ncForm(d.f);if(!f)return;f.fields=f.fields.filter(q=>q.id!==d.q);ncCommit()};
ACT['q-move']=d=>{const f=ncForm(d.f);if(!f)return;const i=f.fields.findIndex(q=>q.id===d.q),j=i+Number(d.d);if(i<0||j<0||j>=f.fields.length)return;[f.fields[i],f.fields[j]]=[f.fields[j],f.fields[i]];ncCommit()};

/* ----- automations ----- */
const flowFields=w=>{ /* what a condition can look at */
 if(w.trigger==='complaint.created')return[['category','Category'],['priority','Priority (normal or high)'],['title','Title'],['flat','Flat']];
 const f=ncForm(w.formId),o=[['flat','Flat'],['name','Resident name']];
 if(!f)return[['form','Form name'],...o];
 return[...f.fields.map(q=>['a.'+q.id,q.label]),...o]};
const tokens=w=>w.trigger==='complaint.created'?[['name','Name'],['flat','Flat'],['title','Title'],['category','Category']]:[['name','Name'],['flat','Flat'],['form','Form'],...(ncForm(w.formId)?ncForm(w.formId).fields.map(q=>['a.'+q.id,q.label]):[])];
function describeFlow(w){
 const fl=flowFields(w),lab=k=>(fl.find(x=>x[0]===k)||[k,k])[1];
 const when=w.trigger==='request.created'?(ncForm(w.formId)?`someone submits <b>${esc(ncForm(w.formId).name)}</b>`:'someone submits <b>any form</b>'):'a <b>ticket</b> is raised';
 const cond=w.conds.length?' and '+w.conds.map(c=>`<b>${esc(lab(c.field))}</b> ${OPL[c.op]}${c.op==='empty'?'':' <b>'+esc(c.value)+'</b>'}`).join(' and '):'';
 const act=w.actions.length?w.actions.map(a=>a.type==='notify_admin'?'tell the office':a.type==='notify_resident'?'message the resident':a.type==='set_status'?'set status to <b>'+esc(a.value||'?')+'</b>':a.type==='assign'?'assign to <b>'+esc(a.value||'?')+'</b>':'post notice <b>'+esc(a.title||'?')+'</b>').join(', then '):'<i>do nothing yet</i>';
 return`When ${when}${cond}, ${act}.`}
function actEditor(w,a,i){
 const dn=`data-nc="act|${w.id}|${i}|`,st=w.trigger==='request.created'?QSFlows.REQ_STATUS:QSFlows.TKT_STATUS;
 const types=QSFlows.ACTIONS.filter(t=>t!=='assign'||w.trigger==='complaint.created');
 let p='';
 if(a.type==='notify_admin'||a.type==='notify_resident')p=`<label class="fld sp"><span>Message</span><input ${dn}text" value="${esc(a.text||'')}" maxlength="200" placeholder="Hi {{name}}, ..."></label>`;
 else if(a.type==='set_status')p=`<label class="fld sp"><span>New status</span><select ${dn}value"><option value="">Choose...</option>${st.map(s=>`<option ${a.value===s?'selected':''}>${s}</option>`).join('')}</select></label>`;
 else if(a.type==='assign')p=`<label class="fld sp"><span>Assign to</span><input ${dn}value" value="${esc(a.value||'')}" maxlength="60" placeholder="Lift vendor"></label>`;
 else p=`<label class="fld sp"><span>Notice title</span><input ${dn}title" value="${esc(a.title||'')}" maxlength="120"></label><label class="fld full"><span>Notice text</span><input ${dn}text" value="${esc(a.text||'')}" maxlength="600"></label>`;
 return`<div class="arow"><div class="row wrap-r" style="align-items:flex-end"><label class="fld"><span>Then</span><select ${dn}type">${types.map(t=>`<option value="${t}" ${a.type===t?'selected':''}>${ACL[t]}</option>`).join('')}</select></label>${p}<button type="button" class="iconbtn" data-act="act-del" data-w="${w.id}" data-i="${i}" aria-label="Remove step">${ic('trash')}</button></div></div>`}
function condEditor(w,c,i){
 const fl=flowFields(w),dn=`data-nc="cond|${w.id}|${i}|`,fm=ncForm(w.formId),q=fm&&c.field.startsWith('a.')?fm.fields.find(x=>'a.'+x.id===c.field):null;
 const val=c.op==='empty'?'':q&&q.type==='select'?`<select ${dn}value">${q.options.map(o=>`<option ${c.value.toLowerCase()===o.toLowerCase()?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input ${dn}value" value="${esc(c.value)}" maxlength="80" ${q&&q.type==='number'?'inputmode="decimal"':''}>`;
 return`<div class="arow"><div class="row wrap-r" style="align-items:flex-end"><label class="fld"><span>${i?'And':'If'}</span><select ${dn}field">${fl.map(([k,l])=>`<option value="${esc(k)}" ${c.field===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label><label class="fld"><span>&nbsp;</span><select ${dn}op">${QSFlows.OPS.map(o=>`<option value="${o}" ${c.op===o?'selected':''}>${OPL[o]}</option>`).join('')}</select></label><label class="fld sp"><span>&nbsp;</span>${val||'<input disabled>'}</label><button type="button" class="iconbtn" data-act="cond-del" data-w="${w.id}" data-i="${i}" aria-label="Remove condition">${ic('trash')}</button></div></div>`}
function bFlows(n){
 const w=n.flows.find(x=>x.id===BLD.flow);
 const list=`<section class="card"><h3>${ic('bolt')}Automations</h3><div class="stack">${n.flows.map(x=>`<div class="frow flow ${BLD.flow===x.id?'on':''}"><button type="button" class="fr-main" data-act="flow-pick" data-id="${x.id}">${ic('bolt')}<span><b>${esc(x.name)}</b><small>${describeFlow(x)}</small></span></button><label class="tgl" title="Switch on or off"><input type="checkbox" data-nc="flow|${x.id}|on" ${x.on?'checked':''} aria-label="${esc(x.name)} on or off"><span class="sw"></span></label></div>`).join('')||`<p class="muted">No automations yet. Add one to approve, notify or assign automatically.</p>`}<button type="button" class="btn acc" data-act="flow-new">${ic('plus')}New automation</button></div></section>`;
 if(!w)return`<div class="split flows">${list}<aside class="card"><div class="empty">${ic('bolt')}<b>Pick an automation to edit</b><span>Rules read like a sentence: when this happens, if that is true, do these steps.</span></div></aside></div>`;
 const tk=tokens(w).map(t=>`<span class="tkn">${esc(t[1])} <code>{{${t[0]}}}</code></span>`).join(' ');
 return`<div class="split flows">${list}<section class="card"><h3>${ic('edit')}Edit automation</h3><div class="stack">
 <label class="fld"><span>Name</span><input data-nc="flow|${w.id}|name" value="${esc(w.name)}" maxlength="80"></label>
 <div class="sentence">${describeFlow(w)}</div>
 <div class="row wrap-r" style="align-items:flex-end"><label class="fld"><span>When</span><select data-nc="flow|${w.id}|trigger">${QSFlows.TRIGGERS.map(t=>`<option value="${t}" ${w.trigger===t?'selected':''}>${TRG[t]}</option>`).join('')}</select></label>
 ${w.trigger==='request.created'?`<label class="fld sp"><span>Which form</span><select data-nc="flow|${w.id}|formId"><option value="">Any form</option>${n.forms.map(f=>`<option value="${f.id}" ${w.formId===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label>`:''}</div>
 ${w.conds.map((c,i)=>condEditor(w,c,i)).join('')}
 ${w.conds.length<4?`<button type="button" class="btn sm" data-act="cond-add" data-w="${w.id}">${ic('plus')}Add a condition</button>`:''}
 ${w.actions.map((a,i)=>actEditor(w,a,i)).join('')}
 ${w.actions.length<4?`<button type="button" class="btn sm" data-act="act-add" data-w="${w.id}">${ic('plus')}Add a step</button>`:''}
 <small class="muted">Use these in messages: ${tk}</small>
 <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="flow-del" data-id="${w.id}" data-confirm="1">${ic('trash')}Delete automation</button></div></div></section></div>`}
const fnd=id=>nc().flows.find(x=>x.id===id);
ACT['flow-pick']=d=>{BLD.flow=d.id;render()};
ACT['flow-new']=()=>{const id=uid('w');nc().flows.push({id,name:'New automation',on:true,trigger:'request.created',formId:'',conds:[],actions:[{type:'notify_admin',text:'New request from {{flat}}: {{form}}'}]});BLD.flow=id;ncCommit()};
ACT['flow-del']=d=>{const n=nc();n.flows=n.flows.filter(w=>w.id!==d.id);BLD.flow=null;ncCommit()};
ACT['cond-add']=d=>{const w=fnd(d.w);if(!w)return;const f=flowFields(w)[0];w.conds.push({field:f[0],op:'is',value:''});ncCommit()};
ACT['cond-del']=d=>{const w=fnd(d.w);if(!w)return;w.conds.splice(Number(d.i),1);ncCommit()};
ACT['act-add']=d=>{const w=fnd(d.w);if(!w)return;w.actions.push({type:'notify_admin',text:''});ncCommit()};
ACT['act-del']=d=>{const w=fnd(d.w);if(!w)return;w.actions.splice(Number(d.i),1);ncCommit()};

/* ----- blueprint (the code view of everything above) ----- */
function bCode(n){
 const json=JSON.stringify(n,null,2);
 return`<section class="card"><h3>${ic('copy')}Blueprint</h3><p class="muted" style="margin:-4px 0 12px">Everything you built is saved as plain data. Copy it to move this setup to another society, or edit it by hand if you like code. It is checked before it is accepted.</p>
 <textarea id="bp_text" class="code" spellcheck="false" aria-label="Blueprint JSON">${esc(json)}</textarea><div class="err" id="bp_err" role="alert"></div>
 <div class="row wrap-r" style="margin-top:12px;justify-content:flex-end"><button type="button" class="btn" data-act="bp-copy">${ic('copy')}Copy</button><button type="button" class="btn" data-act="bp-dl">${ic('download')}Download</button><button type="button" class="btn acc" data-act="bp-apply">${ic('check')}Apply blueprint</button></div>
 <p class="muted" style="margin-top:10px">${json.split('\n').length} lines of data replace the code you would otherwise write for ${n.forms.length} form${n.forms.length===1?'':'s'}, ${n.flows.length} rule${n.flows.length===1?'':'s'} and the menu.</p></section>`}
ACT['bp-copy']=()=>copyText($('#bp_text').value);
ACT['bp-dl']=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('#bp_text').value],{type:'application/json'}));a.download='society-blueprint.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
ACT['bp-apply']=()=>{const e=$('#bp_err');try{const raw=JSON.parse($('#bp_text').value);if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('The blueprint must be an object with modules, forms and flows.');const c=QSFlows.clean(raw);DB.settings.nocode=c;BLD.form=null;BLD.flow=null;save();render();toast(`Blueprint applied: ${c.forms.length} forms, ${c.flows.length} automations`)}catch(x){if(e)e.textContent=x instanceof SyntaxError?'That is not valid JSON: '+x.message:x.message}};

/* ----- one handler for every builder input ----- */
document.addEventListener('change',e=>{
 const t=e.target;if(!t.dataset||!t.dataset.nc||!isAdmin())return;
 const[k,a,b,c]=t.dataset.nc.split('|'),v=t.type==='checkbox'?t.checked:t.value,n=nc(); if(k==='mod'){if(v)delete n.modules[a];else n.modules[a]=false}
 else if(k==='form'){const f=n.forms.find(x=>x.id===a);if(f)f[b]=v}
 else if(k==='field'){const f=n.forms.find(x=>x.id===a),q=f&&f.fields.find(x=>x.id===b);if(q){if(c==='options')q.options=String(v).split(',');else q[c]=v;if(c==='type'&&v==='select'&&!(q.options||[]).length)q.options=['Option 1','Option 2']}}
 else if(k==='flow'){const w=fnd(a);if(w){w[b]=v;if(b==='trigger'){w.formId='';w.conds=[];w.actions=w.actions.filter(x=>x.type!=='assign'||v==='complaint.created').map(x=>x.type==='set_status'?{...x,value:''}:x)}if(b==='formId')w.conds=[]}}
 else if(k==='cond'){const w=fnd(a),x=w&&w.conds[Number(b)];if(x){x[c]=v;if(c==='field')x.value='';if(c==='op'&&v==='empty')x.value=''}}
 else if(k==='act'){const w=fnd(a),x=w&&w.actions[Number(b)];if(x){if(c==='type'){for(const p of Object.keys(x))delete x[p];x.type=v}else x[c]=v}}
 else return;
 ncCommit(t.tagName==='SELECT'||t.type==='checkbox')});

/* ---------- requests inbox (admin) ---------- */
const RST={pending:['Waiting','warn'],approved:['Approved','good'],rejected:['Declined','bad'],done:['Done','info']};
const rChip=s=>{const[t,c]=RST[s]||[s,''];return chip(t,c)};
const ansHtml=r=>`<dl class="ans">${(r.fields||[]).map(f=>{const v=(r.answers||{})[f.id];return`<div><dt>${esc(f.label)}</dt><dd>${esc(QSFlows.fmtAnswer(f,v)||'-')}</dd></div>`}).join('')}</dl>`;
ROUTES.requests=()=>{
 if(!isAdmin())return ROUTES.home();
 const tab=UI.tab||'pending',all=DB.requests.slice().sort((a,b)=>b.created-a.created),l=tab==='all'?all:all.filter(r=>r.status===tab);
 const cnt=s=>s==='all'?all.length:all.filter(r=>r.status===s).length;
 return`<div class="stack">${head('Requests','Everything residents submit through your forms. Automations may already have handled some.',`<button class="btn" data-act="nav" data-to="builder">${ic('bolt')}Open builder</button>`)}
 <div class="row wrap-r">${['pending','approved','rejected','done','all'].map(s=>`<button class="pill ${tab===s?'on':''}" data-act="req-tab" data-t="${s}">${s==='all'?'All':RST[s][0]} (${cnt(s)})</button>`).join('')}</div>
 ${l.length?l.map(r=>`<article class="card req"><div class="row wrap-r" style="justify-content:space-between"><div><b>${esc(r.formName)}</b><div class="muted">${esc(r.name)} · ${esc(r.flat)} · ${fdatey(r.created)}</div></div>${rChip(r.status)}</div>${ansHtml(r)}
  ${r.note?`<p class="muted">Note: ${esc(r.note)}</p>`:''}
  <div class="row wrap-r" style="align-items:flex-end"><label class="fld sp"><span>Note to resident (optional)</span><input id="rn_${r.id}" value="" maxlength="300"></label>
  ${r.status!=='approved'?btn('Approve','req-set',{c:'acc',sm:1,i:'check',d:{id:r.id,s:'approved'}}):''}${r.status!=='rejected'?btn('Decline','req-set',{sm:1,i:'x',d:{id:r.id,s:'rejected'}}):''}${r.status==='approved'?btn('Mark done','req-set',{sm:1,d:{id:r.id,s:'done'}}):''}</div></article>`).join(''):empty('book','Nothing here','New submissions show up as soon as residents send them.')}</div>`};
ACT['req-tab']=d=>{UI.tab=d.t;render()};
ACT['req-set']=d=>{const r=DB.requests.find(x=>x.id===d.id);if(!r)return;const note=(($('#rn_'+d.id)||{}).value||'').trim();r.status=d.s;if(note)r.note=note;
 notify(r.userId,`Your ${r.formName} request was ${d.s==='rejected'?'declined':d.s}${note?': '+note:''}`,'services');logAct(`${RST[d.s][0]}: ${r.formName} for ${r.flat}`);save();render();toast('Marked '+RST[d.s][0].toLowerCase())};

/* ---------- services (resident) ---------- */
ROUTES.services=()=>{
 if(isAdmin())return ROUTES.requests();
 const m=me(),fs=formsFor(),mine=DB.requests.filter(r=>r.userId===m.id).sort((a,b)=>b.created-a.created);
 return`<div class="stack">${head('Services','Ask the society for something. It reaches the office straight away.')}
 ${fs.length?`<div class="tiles svc">${fs.map(f=>`<button type="button" class="tile" data-act="svc-open" data-id="${f.id}">${ic(f.icon)}<b>${esc(f.name)}</b><small>${esc(f.desc)}</small></button>`).join('')}</div>`:empty('layout','No services yet','The committee has not set up any forms.')}
 <section class="card"><h3>${ic('book')}My requests</h3>${mine.length?`<div class="stack">${mine.map(r=>`<div class="myreq"><div class="row wrap-r" style="justify-content:space-between"><b>${esc(r.formName)}</b>${rChip(r.status)}</div><small class="muted">${fdatey(r.created)}</small>${ansHtml(r)}${r.note?`<p class="muted">Office note: ${esc(r.note)}</p>`:''}</div>`).join('')}</div>`:`<p class="muted">You have not sent any requests yet.</p>`}</section></div>`};
ACT['svc-open']=d=>{const f=ncForm(d.id);if(!f)return;modal(esc(f.name),`<p class="muted" style="margin-top:0">${esc(f.desc)}</p>`+formWrap('request',`<input type="hidden" name="formId" value="${f.id}">`+f.fields.map(qField).join(''),'Send request'),{wide:true})};
FORMS.request=(d,f)=>{
 const form=ncForm(d.formId);if(!form||!form.on)return fErr('That form is no longer available.');
 const m=me(),raw={};
 for(const q of form.fields){const el=f.querySelector('#q_'+q.id);raw[q.id]=q.type==='checkbox'?!!(el&&el.checked):(el?el.value:'')}
 const chk=QSFlows.checkAnswers(form,raw);if(chk.err)return fErr(chk.err);
 const doc={id:uid('r'),formId:form.id,formName:form.name,userId:m.id,name:m.name,flat:flatKey(m),fields:form.fields.map(({id,label,type})=>({id,label,type})),answers:chk.answers,status:'pending',note:'',created:Date.now()};
 DB.requests.unshift(doc);notify('admin',`New request from ${flatKey(m)}: ${form.name}`,'requests');
 const said=ncAutomate('requests',doc,m);save();closeModal();render();
 toast(said.length?'Sent. Automation: '+said.join(', '):'Request sent to the office','check')};
