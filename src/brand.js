/* ========== Queenstown brand: animated logo, splash screen, "get the Android app" ========== */
Object.assign(IP,{camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
 paperclip:'<path d="M21 11.5l-8.6 8.6a5 5 0 01-7.1-7.1l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.6 8.6a1.8 1.8 0 01-2.5-2.5l7.9-7.9"/>',
 download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
 file:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5"/>',
 app:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'
});
const isNativeApp=()=>{try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())||/QueenstownApp/.test(navigator.userAgent)}catch(e){return false}};

/* ----- animated logo -----
   The logo picture is cut into pieces with fixed rectangles (castle, each group of letters, "Chinchwad"),
   so the castle can rise, the name can appear letter by letter, and a golden shine can sweep across it.
   Colours come from CSS (--a1, --a2), so the same picture works on dark and light backgrounds. */
const AL_W=692,AL_H=411;
const AL_RECT=(x0,y0,x1,y1)=>`inset(${(y0/AL_H*100).toFixed(2)}% ${((AL_W-x1)/AL_W*100).toFixed(2)}% ${((AL_H-y1)/AL_H*100).toFixed(2)}% ${(x0/AL_W*100).toFixed(2)}%)`;
const AL_LETTERS=[[0,0,172,360],[172,258,220,360],[220,258,333,360],[333,258,375,360],[375,258,434,360],[434,258,497,360],[497,258,585,360],[585,0,692,360]];
const AL_SPARKS=[[46.5,2.4,3.0],[58.9,13.5,3.9],[37.2,11.8,4.6],[66,36,3.4],[43,28,5.1],[27,52,4.2]];
function animLogo(cls='',style=''){
 return`<span class="alogo ${cls}" style="${style}" role="img" aria-label="Queenstown, Chinchwad"><span class="al-p al-c" style="clip-path:${AL_RECT(172,0,560,258)}"><i class="al-i"></i></span>${AL_LETTERS.map((r,i)=>`<span class="al-p al-l" style="clip-path:${AL_RECT(...r)}"><i class="al-i" style="animation-delay:${(1.15+i*.11).toFixed(2)}s"></i></span>`).join('')}<span class="al-p al-s" style="clip-path:${AL_RECT(0,360,692,411)}"><i class="al-i"></i></span><i class="al-sh"></i>${AL_SPARKS.map(([x,y,d])=>`<b class="al-sp" style="--x:${x}%;--y:${y}%;--d:${d}s"></b>`).join('')}</span>`}
const animMark=()=>`<span class="amark" aria-hidden="true"><i class="am-i"></i><i class="am-sh"></i></span>`;
/* big logo on the public page: the society's own uploaded logo if the admin set one, else the animated castle */
const bigLogo=()=>{const s=cfg().site.logo;return s?`<img class="logo-img big" src="${esc(s)}" alt="">`:animLogo('big')};

/* ----- splash screen: shown once per visit while the app loads ----- */
(function splash(){
 try{if(sessionStorage.getItem('qs_splash'))return;sessionStorage.setItem('qs_splash','1')}catch(e){}
 const el=document.createElement('div');el.id='splash';el.className='splash';
 el.innerHTML=`<div class="splash-in">${animLogo('splash-logo','--w:min(470px,84vw)')}<div class="splash-bar"><i></i></div></div>`;
 document.body.appendChild(el);
 const t0=Date.now(),minMs=matchMedia('(prefers-reduced-motion:reduce)').matches?400:3000;let gone=false;
 const bye=()=>{if(gone)return;gone=true;el.classList.add('out');setTimeout(()=>el.remove(),650)};
 el.addEventListener('click',bye);
 const tick=()=>{const a=document.getElementById('app'),first=a&&a.firstElementChild,ready=first&&!first.classList.contains('boot'),age=Date.now()-t0;
  if((ready&&age>=minMs)||age>12000)bye();else setTimeout(tick,150)};tick();
})();

/* ----- Android app: open it if installed, otherwise download it ----- */
const apkUrl=()=>String(window.QS_APK_URL||'').trim();
const canOfferApp=()=>!!apkUrl()&&!isNativeApp();
const isAndroidWeb=()=>/Android/i.test(navigator.userAgent)&&!isNativeApp();
/* Chrome on Android opens the installed app through this address; if the app is missing it goes to the download instead. */
const appOpenHref=()=>`intent://open#Intent;scheme=queenstown;package=in.queenstown.society;S.browser_fallback_url=${encodeURIComponent(apkUrl())};end`;
function appBanner(){
 if(!canOfferApp()||!isAndroidWeb())return'';
 try{if(Date.now()<(+lsGet('qs_appbar')||0)||matchMedia('(display-mode: standalone)').matches)return''}catch(e){}
 return`<div class="appbar" role="region" aria-label="Get the Android app"><img src="icons/icon-192.png" alt="" width="38" height="38"><div class="t"><b>Queenstown app for Android</b><small>Notices, bills and events on your phone</small></div><a class="go" href="${appOpenHref()}">Get app</a><button type="button" data-act="app-dismiss" aria-label="Hide">${ic('x')}</button></div>`}
ACT['app-dismiss']=()=>{lsSet('qs_appbar',String(Date.now()+7*864e5));const b=$('.appbar');if(b)b.remove()};
/* on Android phones the top bar already offers the app, so the card would be a second banner */
const appCard=()=>canOfferApp()&&!isAndroidWeb()?`<div class="card flat appcard"><span class="ai">${ic('app')}</span><div class="sp"><b>Get the Android app</b><br><small>Pay bills, read notices and see events from your home screen.</small></div><button type="button" class="btn sm pri" data-act="app-dl">${ic('download')}Get the app</button></div>`:'';
const appSide=()=>canOfferApp()?`<button type="button" class="navbtn" data-act="app-dl">${ic('app')}Get the Android app</button>`:'';
ACT['app-dl']=()=>{
 if(!canOfferApp())return;
 const apk=apkUrl(),android=isAndroidWeb(),ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 modal('Get the Queenstown app',`<div class="stack"><p class="muted">Pay maintenance, read notices and see events from your home screen. It is the same Queenstown Society you see on the website, so every change shows up in both.</p>
 ${android?`<div class="row" style="flex-wrap:wrap"><a class="btn pri" href="${appOpenHref()}">${ic('app')}Open app or install</a><a class="btn" href="${esc(apk)}" download>${ic('download')}Download APK</a></div>
 <small>If the app is already on your phone, the first button opens it. If not, the download starts. When Android asks, allow installs from this source once, then open the downloaded file.</small>`
 :ios?`<div class="card flat"><b>iPhone and iPad</b><p class="muted">The app file is for Android phones. On iPhone, open this site in Safari, tap Share, then Add to Home Screen.</p></div>`
 :`<div class="row" style="align-items:center;gap:16px;flex-wrap:wrap"><div id="appqr" class="appqr" aria-label="QR code"></div><div class="sp" style="min-width:200px"><b>On your Android phone</b><p class="muted">Scan the code with the camera and tap the link. The page offers to open or download the app.</p></div></div>
 <div class="row"><a class="btn" href="${esc(apk)}" download>${ic('download')}Download APK to this computer</a></div>`}
 </div>`);
 if(!android&&!ios&&window.QRCode)setTimeout(()=>{const b=$('#appqr');if(b&&!b.firstChild)try{new QRCode(b,{text:location.origin+location.pathname+'#getapp',width:160,height:160,colorDark:'#0B3B3A',colorLight:'#ffffff'})}catch(e){}},50)};

/* ----- sync warning: in demo mode every phone and computer keeps its own copy, so a change on one never reaches the others ----- */
const syncWarn=()=>(!REMOTE&&isAdmin())?`<div class="syncwarn" role="alert">${ic('info')}<span><b>Demo mode: changes stay on this device only.</b> A new logo, notice or event made here will not show on your phone or other residents' phones. Set <code>QS_API_URL</code> on Vercel to your Render server address (see DEPLOY.md) so every change is shared everywhere.</span></div>`:'';
/* open the download dialog when someone scans the QR code or follows a #getapp link */
setTimeout(()=>{if(location.hash==='#getapp'){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}if(canOfferApp())ACT['app-dl']()}},900);

/* Header Sign in / Sign up: switch the form and bring it into view */
ACT['auth-go']=d=>{UI.auth=d.t;render();setTimeout(()=>{const f=document.querySelector('form[data-form=login],form[data-form=register]');if(f){f.scrollIntoView({behavior:'smooth',block:'center'});const i=f.querySelector('input');if(i)i.focus({preventScroll:true})}},60)};

ACT['to-top']=()=>{window.scrollTo({top:0,behavior:'smooth'});const v=document.querySelector('.main');if(v&&v.scrollTo)v.scrollTo({top:0,behavior:'smooth'})};

/* ----- account menu (avatar) ----- */
ACT.umenu=()=>{const p=document.querySelector('.umpop'),b=document.querySelector('.avbtn');if(!p)return;const open=p.hidden;p.hidden=!open;if(b)b.setAttribute('aria-expanded',String(open))};
document.addEventListener('click',e=>{if(e.target.closest('.umenu'))return;const p=document.querySelector('.umpop');if(p&&!p.hidden){p.hidden=true;const b=document.querySelector('.avbtn');if(b)b.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=document.querySelector('.umpop');if(p&&!p.hidden){p.hidden=true;const b=document.querySelector('.avbtn');if(b){b.setAttribute('aria-expanded','false');b.focus()}}}});

/* ----- sample data: fills the empty modules so the app looks alive; every sample record has an id starting with smp_ so it can be removed in one tap ----- */
const SMP='smp_',isSmp=x=>typeof x.id==='string'&&x.id.startsWith(SMP);
function sampleData(){
 const at=(d,h,mi=0)=>{const x=new Date();x.setDate(x.getDate()+d);x.setHours(h,mi,0,0);return x.toISOString()},sid=p=>uid(SMP+p),now=Date.now(),DAYMS=864e5;
 const ev=(title,scene,d,h,venue,cat,fee,desc,o={})=>({id:sid('e'),title,scene,date:at(d,h),venue,category:cat,fee,desc,featured:true,rsvps:{},cover:null,photos:[],capacity:0,...o});
 const out={};
 out.notices=[
  ['Water tank cleaning','Maintenance','high',true,-1,'The overhead tanks will be cleaned between 9 am and 3 pm. Water supply will be interrupted, so please store water for essential use.'],
  ['Annual General Meeting notice','Finance','high',true,-3,'The AGM is at 11 am in the Clubhouse Hall. Agenda: audited accounts, budget, election of committee members and open floor.'],
  ['Visitor pre-approval is now mandatory','Security','normal',false,-6,'Please pre-approve expected visitors and delivery partners in the Visitors section. Security will ask for the six digit code at the gate.'],
  ['Lift servicing','Maintenance','normal',false,-8,'One lift will be out of service from 10 am to 1 pm for the quarterly service. The second lift runs as usual.'],
  ['Festive decoration guidelines','Emergency','high',false,-10,'Please do not use open flames in corridors and staircases. Electric lights are allowed on balconies until 11 pm.'],
  ['Parking sticker renewal','General','normal',false,-14,'Residents with expired parking stickers should apply at the society office with a copy of the vehicle RC.']
 ].map(([t,c,p,pin,d,b])=>({id:sid('n'),title:t,body:b,category:c,priority:p,pinned:pin,date:at(d,10),author:'Society Office',readBy:[],attachment:null}));
 out.events=[
  ev('Yoga and Wellness Morning','yoga',3,6,'Central Lawn','Wellness',0,'A guided one hour yoga and breathing session for all ages. Bring your own mat.'),
  ev('Sports Fest','sports',9,8,'Sports Court','Sports',100,'Badminton, box cricket, table tennis and a kids relay. Fee covers refreshments and trophies.'),
  ev('Annual Day Cultural Evening','night',16,18,'Amphitheatre','Cultural',0,'Dance, music and skits by residents of all ages. Dinner follows the show.'),
  ev('Annual General Meeting','meeting',25,11,'Clubhouse Hall','Meeting',0,'Presentation of accounts, budget, committee election and open floor. Every flat has one vote.',{featured:false}),
  ev('Kids Fair and Carnival','kids',32,16,'Central Lawn','Festival',150,'Stalls, games, a puppet show and a food court run by residents.'),
  ev('New Year Gala Night','festival',45,20,'Amphitheatre and Clubhouse','Festival',600,'Live band, dinner buffet and a midnight countdown. Family passes are limited.',{capacity:300})
 ].map(e=>({...e,attachment:null}));
 out.schedule=[['Water tank cleaning',4,9,'maintenance','Supply off 9 am to 3 pm'],['Lift servicing',6,10,'maintenance','One lift out of service'],['Committee meeting',7,19,'meeting','Clubhouse office'],['DG set load test',8,11,'maintenance','Short power cut, 20 minutes'],['Pest control',12,10,'maintenance','Keep kitchen cabinets open']].map(([t,d,h,k,n])=>({id:sid('s'),title:t,date:at(d,h),kind:k,note:n}));
 out.amenities=[
  {id:sid('am'),name:'Banquet Hall',rate:3000,unit:'per slot',capacity:120,hours:'8 am to 11 pm',desc:'Air conditioned hall with a pantry and stage.',scene:'festival'},
  {id:sid('am'),name:'Tennis Court',rate:150,unit:'per hour',capacity:4,hours:'6 am to 9 pm',desc:'Floodlit synthetic court. Racquets at the desk.',scene:'sports'},
  {id:sid('am'),name:'Swimming Pool',rate:0,unit:'free for residents',capacity:40,hours:'6 am to 9 am, 4 pm to 8 pm',desc:'Swim cap compulsory. Lifeguard on duty.',scene:'yoga'},
  {id:sid('am'),name:'Guest Room',rate:1200,unit:'per night',capacity:3,hours:'Check-in 12 pm',desc:'Rooms for visiting relatives. Book two days ahead.',scene:'garden'}];
 out.polls=[
  {id:sid('p'),question:'Should we install solar panels on the roofs?',options:[{t:'Yes, go ahead'},{t:'Yes, after the AGM discussion'},{t:'No'}],votes:{},closes:at(12,23),status:'open',by:'Committee'},
  {id:sid('p'),question:'Preferred time for the weekly yoga class',options:[{t:'5:30 am'},{t:'6:30 am'},{t:'7:30 am'}],votes:{},closes:at(20,23),status:'open',by:'Committee'}];
 out.docs=[['Society Bye-laws','Bye-laws',-400,'Registered bye-laws: renovation, pets, parking and common areas.'],['Audited Accounts','Audit',-60,'Income and expenditure statement, balance sheet and auditor remarks.'],['Proxy form for AGM','Forms',-3,'Fill and hand over to the office before the meeting.'],['Fire safety and evacuation plan','Circulars',-90,'Assembly points, extinguisher locations and emergency numbers.']].map(([t,ty,d,ds])=>({id:sid('d'),title:t,type:ty,date:at(d,0),desc:ds,link:''}));
 out.contacts=[['Main Gate Security','24 x 7 desk','9876543210','Society'],['Society Office','10 am to 6 pm','9876543211','Society'],['Plumber','Mr. Biswas','9876543212','Services'],['Electrician','Rafiq Electricals','9876543213','Services'],['Lift Care Service','Lift AMC','9876543214','Services'],['Housekeeping','CleanPro agency','9876543215','Services']].map(([n,r,p,c])=>({id:sid('t'),name:n,role:r,phone:p,cat:c}));
 const ent=[];[0,1,2].forEach(i=>{const d=new Date();d.setMonth(d.getMonth()-i);const iso=k=>new Date(d.getFullYear(),d.getMonth(),k,12).toISOString();
  [['Salaries','Security and housekeeping staff',62000],['Electricity','Common area electricity',28000],['Lift AMC','Lift maintenance',9500],['Water','Tanker and treatment',11000],['Garden','Gardener and supplies',4500]].forEach(([c,t,a],j)=>ent.push({id:sid('x'),date:iso(3+j),category:c,desc:t,amount:a+i*350,type:'expense'}));
  ent.push({id:sid('x'),date:iso(11),category:'Hall rent',desc:'Banquet hall bookings',amount:6000+i*1500,type:'income'})});
 out.entries=ent.filter(e=>+new Date(e.date)<=now);
 /* these need a real resident, so they are added only when one exists */
 const res=(DB.users||[]).find(u=>u.status==='approved'&&u.role!=='admin');
 if(res){
  out.complaints=[{id:sid('c'),userId:res.id,category:'Plumbing',title:'Water leakage from bathroom ceiling',body:'Seepage in the bathroom ceiling since two days.',priority:'normal',status:'in-progress',assignee:'Mr. Biswas, plumber',created:now-2*DAYMS,comments:[{by:'Society Office',text:'Plumber will visit tomorrow morning.',at:now-DAYMS,admin:true}]},
   {id:sid('c'),userId:res.id,category:'Lift',title:'Lift making noise between floors',body:'Grinding sound between floors 5 and 6.',priority:'high',status:'open',assignee:'',created:now-5*3600e3,comments:[]}];
  out.ads=[{id:sid('a'),userId:res.id,business:'FreshBite Cloud Kitchen',title:'Home style tiffin, lunch and dinner',body:'Weekly menu on WhatsApp. Free delivery inside the society.',category:'Food',contact:'98765 00009',price:'From ₹120 per meal',type:'banner',weeks:2,fee:1000,feePaid:true,status:'live',hue:'#2FA39B',created:now-5*DAYMS},
   {id:sid('a'),userId:res.id,business:'',title:'Dining table, 6 seater, teak',body:'Two years old, very good condition.',category:'Buy and Sell',contact:'98765 00007',price:'₹14,000',type:'classified',weeks:0,fee:0,feePaid:true,status:'live',hue:'#C77A0A',created:now-2*DAYMS}]}
 return out}
ACT['sample-add']=async()=>{
 if(!isAdmin())return;const data=sampleData();let n=0;
 for(const k of Object.keys(data)){if(!Array.isArray(DB[k]))DB[k]=[];const have=new Set(DB[k].map(x=>x.id));const add=data[k].filter(x=>!have.has(x.id));DB[k].unshift(...add);n+=add.length}
 logAct('Added sample data');save();
 if(REMOTE){const rej=await flushWait();if(rej.length)return}
 render(true);toast(n+' sample records added across notices, events, forecast, amenities, polls, documents, directory and accounts.')};
ACT['sample-clear']=async()=>{
 if(!isAdmin())return;let n=0;
 for(const k of Object.keys(DB)){if(!Array.isArray(DB[k]))continue;const keep=DB[k].filter(x=>!(x&&isSmp(x)));n+=DB[k].length-keep.length;DB[k]=keep}
 save();if(REMOTE){const rej=await flushWait();if(rej.length)return}
 render(true);toast(n?n+' sample records removed.':'No sample records to remove.')};
