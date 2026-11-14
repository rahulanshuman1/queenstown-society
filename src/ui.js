/* ========== ui helpers ========== */
const UI={q:'',cat:'all',tab:'',month:mkey(),auth:'login',sel:null,calM:mkey(),err:''};
const FORMS={},ACT={};
const chip=(t,c='')=>`<span class="chip ${c}">${t}</span>`;
const STAT={paid:['Paid','good'],due:['Due','warn'],overdue:['Overdue','bad'],verifying:['Verifying','info'],open:['Open','warn'],'in-progress':['In progress','info'],resolved:['Resolved','good'],pending:['Pending','warn'],approved:['Approved','good'],rejected:['Rejected','bad'],live:['Live','good'],expired:['Expired','bad'],closed:['Closed',''],expected:['Expected','info'],waiting:['Awaiting approval','warn'],denied:['Denied','bad'],cancelled:['Cancelled',''],entered:['Inside','good'],exited:['Left',''],yes:['Going','good'],maybe:['Maybe','warn']};
const sChip=s=>{const[t,c]=STAT[s]||[s,''];return chip(t,c)};
const head=(t,sub='',act='')=>`<div class="ph"><div><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}</div><div class="ph-act">${act}</div></div>`;
const empty=(i,t,s='',a='')=>`<div class="empty">${ic(i)}<b>${t}</b><span>${s}</span>${a}</div>`;
const btn=(label,act,o={})=>`<button type="button" class="btn ${o.c||''} ${o.sm?'sm':''}" data-act="${act}" ${Object.entries(o.d||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')} ${o.confirm?'data-confirm="1"':''}>${o.i?ic(o.i):''}${label}</button>`;
const F={
 t:(id,l,o={})=>`<label class="fld ${o.cls||''}" for="${id}"><span>${l}</span><input id="${id}" name="${id}" type="${o.type||'text'}" value="${esc(o.v??'')}" ${o.req?'required':''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} ${o.attrs||''}>${o.hint?`<em class="hint">${o.hint}</em>`:''}</label>`,
 a:(id,l,o={})=>`<label class="fld ${o.cls||''}" for="${id}"><span>${l}</span><textarea id="${id}" name="${id}" ${o.req?'required':''} ${o.ph?`placeholder="${esc(o.ph)}"`:''}>${esc(o.v??'')}</textarea></label>`,
 s:(id,l,opts,o={})=>`<label class="fld ${o.cls||''}" for="${id}"><span>${l}</span><select id="${id}" name="${id}" ${o.req?'required':''}>${opts.map(x=>{const[v,t]=Array.isArray(x)?x:[x,x];return`<option value="${esc(v)}" ${String(v)===String(o.v)?'selected':''}>${esc(t)}</option>`}).join('')}</select></label>`,
 c:(id,l,on)=>`<label class="chk full"><input type="checkbox" id="${id}" name="${id}" ${on?'checked':''}>${l}</label>`
};
const formWrap=(name,inner,submit='Save',extra='')=>`<form data-form="${name}" novalidate><div class="frm">${inner}</div><div class="err" id="ferr" role="alert"></div><div class="row" style="margin-top:16px;justify-content:flex-end">${extra}<button class="btn pri" type="submit">${submit}</button></div></form>`;
function modal(title,body,o={}){const r=$('#modal-root');r.innerHTML=`<div class="scrim-m" data-act="close-modal"></div><div class="modal ${o.wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><div><h3>${title}</h3>${o.sub?`<small>${o.sub}</small>`:''}</div><button class="iconbtn x" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>${body}</div>`;r.classList.add('open');document.body.classList.add('noscroll');if(!matchMedia('(max-width:640px)').matches)setTimeout(()=>r.querySelector('form input:not([type=checkbox]):not([type=file]),form select,form textarea')?.focus(),60)}
function closeModal(){const r=$('#modal-root');r.classList.remove('open');r.innerHTML='';document.body.classList.remove('noscroll')}
function toast(msg,icon='check'){const t=document.createElement('div');t.className='toast';t.innerHTML=ic(icon)+esc(msg);$('#toasts').appendChild(t);setTimeout(()=>t.classList.add('out'),2800);setTimeout(()=>t.remove(),3200)}
function confetti(){const c=document.createElement('div');c.className='confetti';const cols=['#E39A1B','#2FA39B','#C23B3B','#2B6CB0','#F2B13A','#fff'];for(let i=0;i<60;i++){const e=document.createElement('i');e.style.cssText=`left:${Math.random()*100}%;background:${cols[i%6]};--x:${(Math.random()-.5)*260}px;--r:${Math.random()*720}deg;animation-delay:${Math.random()*.4}s;animation-duration:${1.4+Math.random()*1.2}s`;c.appendChild(e)}document.body.appendChild(c);setTimeout(()=>c.remove(),3200)}
function copyText(t){const done=()=>toast('Copied');try{navigator.clipboard.writeText(t).then(done,()=>fallback())}catch(e){fallback()}function fallback(){const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');done()}catch(e){toast('Select the text and copy it manually','info')}a.remove()}}

/* ========== nav ========== */
const NAV=[['home','Home','home'],['notices','Notices','notice'],['maintenance','Maintenance','wallet'],['events','Events','calendar'],['forecast','Forecast','sunrise'],['helpdesk','Helpdesk','chat'],['amenities','Amenities','key'],['visitors','Visitors','visitor'],['marketplace','Marketplace','tag'],['polls','Polls','vote'],['gallery','Gallery','image'],['accounts','Accounts','chart'],['documents','Documents','book'],['directory','Directory','users']];
const ANAV=[['admin','Dashboard','shield'],['members','Members','users'],['billing','Billing','wallet'],['setup','Society setup','gear'],['studio','Site studio','palette']];
const ROUTES={};
const routeOf=()=>{if(isGuard()){const g=location.hash.slice(1);return['gate','notices','profile'].includes(g)?g:'gate'}let h=location.hash.slice(1)||(isAdmin()?'admin':'home');if(isAdmin()&&h==='maintenance')h='billing';if(!isAdmin()&&ANAV.some(a=>a[0]===h))h='home';if(h!=='profile'&&!NAV.some(n=>n[0]===h)&&!ANAV.some(n=>n[0]===h))h='home';return h};
const pendingReviews=()=>DB.ads.filter(a=>a.status==='pending').length+DB.bookings.filter(b=>b.status==='pending').length+DB.bills.filter(b=>b.status==='verifying').length;
function navBadge(id){if(isGuard())return id==='gate'?DB.visitors.filter(v=>v.status==='waiting').length:0;if(!isAdmin())return 0;return id==='members'?DB.users.filter(u=>u.status==='pending').length:id==='billing'?DB.bills.filter(b=>b.status==='verifying').length:id==='helpdesk'?DB.complaints.filter(c=>c.status==='open').length:id==='amenities'?DB.bookings.filter(b=>b.status==='pending').length:id==='marketplace'?DB.ads.filter(a=>a.status==='pending').length:0}
const logo=`<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#E39A1B"/><path d="M9 31V19l5-3v15M16 31V12l6-4v23M24 31V17l7 3v11" fill="#0B3B3A"/><rect x="18" y="14" width="2" height="2" fill="#E39A1B"/><rect x="18" y="19" width="2" height="2" fill="#E39A1B"/><rect x="18" y="24" width="2" height="2" fill="#E39A1B"/></svg>`;
const brand=()=>{const n=cfg().name||'Queenstown Society';return`<a class="brand" href="#${isAdmin()?'admin':isGuard()?'gate':'home'}">${logoHtml()}<div><b>${esc(n.split(' ')[0])}</b>${n.split(' ').slice(1).length?`<span>${esc(n.split(' ').slice(1).join(' '))}</span>`:''}</div></a>`};

function shell(route,inner){
 const m=me(),t=NAV.concat(ANAV,[['profile','My profile','user'],['gate','Security desk','shield']]).find(n=>n[0]===route)?.[1]||'';
 const link=n=>`<a href="#${n[0]}" class="${route===n[0]?'on':''}">${ic(n[2])}${n[1]}${navBadge(n[0])?`<span class="badge-n">${navBadge(n[0])}</span>`:''}</a>`;
 const tabs=isGuard()?[['gate','Gate','shield'],['notices','Notices','notice'],['profile','Profile','user']]:isAdmin()?[['admin','Admin','shield'],['members','Members','users'],['billing','Billing','wallet'],['notices','Notices','notice']]:[['home','Home','home'],['notices','Notices','notice'],['maintenance','Pay','wallet'],['events','Events','calendar']];
 const inTabs=tabs.some(x=>x[0]===route);
 const dark=document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);
 return`<div class="shell"><aside class="side">${brand()}<nav class="nav" aria-label="Main">${isGuard()?`<h6>Security</h6>${[['gate','Security desk','shield'],['notices','Notices','notice']].map(link).join('')}`:isAdmin()?`<h6>Admin</h6>${ANAV.map(link).join('')}`:''}${isGuard()?'':`<h6>${isAdmin()?'Society':'Menu'}</h6>${NAV.filter(n=>!(isAdmin()&&n[0]==='maintenance')).map(link).join('')}`}</nav>${isGuard()?'':appSide()}<a class="me" href="#profile"><span class="av">${initials(m.name)}</span><div><b>${esc(m.name)}</b><small>${isAdmin()?'Administrator':isGuard()?'Security staff':esc(flatKey(m))+' · '+esc(m.title||m.type)}</small></div></a></aside>
 <div class="main">${appBanner()}${syncWarn()}${siteBars()}<header class="top">${brand()}<div class="ttl">${t}</div><div class="sp"></div><button class="iconbtn" data-act="bell" aria-label="Notifications">${ic('bell')}${unreadN()?`<span class="dot">${unreadN()}</span>`:''}</button><button class="iconbtn" data-act="theme" aria-label="Toggle theme">${ic(dark?'sun':'moon')}</button><div class="umenu"><button type="button" class="iconbtn avbtn" data-act="umenu" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu"><span class="av" style="width:30px;height:30px;font-size:12px">${initials(m.name)}</span></button><div class="umpop" role="menu" hidden><div class="umhead"><b>${esc(m.name)}</b><small>${isAdmin()?'Society admin':isGuard()?'Security staff':esc((m.tower?m.tower+'-'+m.flat:'')||'Resident')}</small></div><a role="menuitem" href="#profile">${ic('user')}My profile</a><button type="button" role="menuitem" class="umout" data-act="logout">${ic('logout')}Sign out</button></div></div></header>
 <div class="wrap"><div class="view enter" id="view">${route==='home'?appCard():''}${inner}</div>${siteFooter()}</div></div>
 <nav class="tabbar" aria-label="Primary">${tabs.map(x=>`<a href="#${x[0]}" class="${route===x[0]?'on':''}">${ic(x[2])}${x[1]}</a>`).join('')}${isGuard()?'':`<button data-act="more" class="${!inTabs?'on':''}">${ic('more')}More</button>`}</nav></div>`;
}
ACT.more=()=>{const items=(isAdmin()?ANAV.slice(0,0):[]).concat(NAV.filter(n=>!(isAdmin()&&n[0]==='maintenance')),isAdmin()?ANAV.slice(3):[],[['profile','Profile','user']]);modal('Menu',`<div class="sheet-grid">${items.map(n=>`<a href="#${n[0]}" data-act="close-modal">${ic(n[2])}${n[1]}</a>`).join('')}<button data-act="logout">${ic('logout')}Sign out</button></div>`)};

/* ========== hero ========== */
function heroSlides(){const now=Date.now(),f=DB.events.filter(e=>e.featured);return[...f.filter(e=>+D(e.date)>=now-3*3600e3).sort((a,b)=>D(a.date)-D(b.date)).slice(0,4).map(e=>({e,tag:'Upcoming'})),...f.filter(e=>+D(e.date)<now-3*3600e3).sort((a,b)=>D(b.date)-D(a.date)).slice(0,1).map(e=>({e,tag:'Throwback'}))]}
function hero(pub=false){
 const sl=heroSlides();if(!sl.length)return'';
 const items=forecastItems(sod(new Date()),new Date(Date.now()+30*DAY),{publicOnly:pub}).filter(x=>!pub||x.kind==='event'||x.kind==='meeting').slice(0,5);
 return`<section class="hero" aria-label="Society highlights" data-hero><div class="stage">${sl.map((s,i)=>{const e=s.e,up=s.tag==='Upcoming';return`<article class="slide ${i?'':'on'}" data-i="${i}"><div class="art-wrap">${cover(e)}</div><div class="scrim"></div><div class="slide-body"><span class="tag ${up?'':'thr'}">${up?'Upcoming · '+rel(e.date):'Throwback'}</span><h1>${esc(e.title)}</h1><div class="meta"><span>${ic('calendar')}${fwd(e.date)}, ${ftime(e.date)}</span><span>${ic('mappin')}${esc(e.venue)}</span></div>${up?`<div class="cd" data-cd="${e.date}"></div>`:`<p class="meta">${esc(e.desc)}</p>`}${pub?'':`<div class="row wrap-r">${up?btn(e.rsvps[me()?.id]?'You are '+(e.rsvps[me()?.id]==='yes'?'going':'interested'):'RSVP now','event-open',{c:'acc',d:{id:e.id}}):btn('See photos','nav',{c:'acc',d:{to:'gallery'}})}</div>`}</div></article>`}).join('')}
 <div class="hero-ctl"><button class="arrow" data-act="hero-prev" aria-label="Previous">${ic('cl')}</button>${sl.map((_,i)=>`<button class="dotb ${i?'':'on'}" data-act="hero-go" data-i="${i}" aria-label="Slide ${i+1}"></button>`).join('')}<button class="arrow" data-act="hero-next" aria-label="Next">${ic('cr')}</button></div></div>
 <aside class="forecast" aria-label="Coming up"><h4><span class="live"></span>Coming up · next 30 days</h4>${items.length?items.map(x=>`<a class="fi" href="${pub?'#':'#'+x.link}" ${pub?'data-act="noop"':''}><div class="d"><b>${D(x.at).getDate()}</b><small>${fdate(x.at,{month:'short'})}</small></div><div class="t">${esc(x.title)}<small>${rel(x.at)}${x.sub?' · '+esc(x.sub):''}</small></div><span class="k" style="background:${KIND[x.kind][1]}"></span></a>`).join(''):'<small style="color:var(--on-art-2)">Nothing scheduled in the next 30 days.</small>'}</aside></section>`;
}
let heroT=null,heroI=0;
function heroGo(i){const h=$('[data-hero]');if(!h)return;const sl=$$('.slide',h),ds=$$('.dotb',h);heroI=(i+sl.length)%sl.length;sl.forEach((s,k)=>s.classList.toggle('on',k===heroI));ds.forEach((d,k)=>{d.classList.remove('on');void d.offsetWidth;d.classList.toggle('on',k===heroI)});heroSched()}
function heroSched(){clearTimeout(heroT);const h=$('[data-hero]');if(!h||h.classList.contains('paused'))return;heroT=setTimeout(()=>heroGo(heroI+1),6000)}
function initHero(){clearTimeout(heroT);heroI=0;const h=$('[data-hero]');if(!h)return;h.onmouseenter=()=>{h.classList.add('paused');clearTimeout(heroT)};h.onmouseleave=()=>{h.classList.remove('paused');heroGo(heroI)};let x0=null;h.ontouchstart=e=>{x0=e.touches[0].clientX};h.ontouchend=e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40)heroGo(heroI+(dx<0?1:-1));x0=null};heroSched()}
ACT['hero-go']=d=>heroGo(+d.i);ACT['hero-next']=()=>heroGo(heroI+1);ACT['hero-prev']=()=>heroGo(heroI-1);
function tickCd(){$$('[data-cd]').forEach(el=>{let s=Math.max(0,Math.floor((+D(el.dataset.cd)-Date.now())/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);el.innerHTML=[[d,'days'],[h,'hrs'],[m,'min'],[s%60,'sec']].map(([v,l])=>`<div><b>${String(v).padStart(2,'0')}</b><small>${l}</small></div>`).join('')})}
setInterval(tickCd,1000);

/* ========== render ========== */
function countUp(){const red=matchMedia('(prefers-reduced-motion:reduce)').matches;$$('[data-count]').forEach(el=>{const to=+el.dataset.count,suf=el.dataset.suf||'',t0=performance.now();if(red||!to){el.textContent=to+suf;return}const step=t=>{const k=Math.min(1,(t-t0)/900),v=Math.round(to*(1-Math.pow(1-k,3)));el.textContent=v.toLocaleString('en-IN')+suf;if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)})}
function render(nav=false){
 if(!DB)return;applyTheme();const root=$('#app'),y=scrollY,ae=document.activeElement,aid=ae&&ae.id&&root.contains(ae)?ae.id:null,pos=aid&&ae.selectionStart!=null?ae.selectionStart:null;
 const m=me();let html,route='';
 if(PV==='landing'||!SES||!m){html=landing()}
 else if(!isAdmin()&&!(m.status==='approved'||(m.role==='security'&&m.status==='staff'))){html=waitScreen(m)}
 else{route=routeOf();html=shell(route,(ROUTES[route]||ROUTES.home)())}
 root.innerHTML=html;if(PV)root.insertAdjacentHTML('beforeend',pvBar());document.title=(route&&route!=='home'?($('.top .ttl')?.textContent+' · '):'')+DB.settings.name;
 setTimeout(()=>{try{gateAlerts()}catch(e){}},0);
 const v=$('#view');if(v&&!nav)v.classList.remove('enter');
 if(!nav)scrollTo(0,y);else scrollTo(0,0);
 if(aid){const el=document.getElementById(aid);if(el){el.focus();try{if(pos!=null)el.setSelectionRange(pos,pos)}catch(e){}}}
 initHero();tickCd();countUp();
}
window.addEventListener('hashchange',()=>{UI.q='';UI.cat='all';UI.tab='';UI.sel=null;render(true)});

/* ========== landing + wait ========== */
function landing(){
 const c=cfg(),s=c,st=c.site.content,reg=UI.auth==='register';
 const towers=['A','B','C','D'],n=c.name||'Queenstown Society';
 return`${appBanner()}${siteBars()}<div class="wrap" style="max-width:1160px;padding-bottom:40px"><div class="landing-top"><a class="brand" href="#">${logoHtml()}<div><b>${esc(n.split(' ')[0])}</b>${n.split(' ').slice(1).length?`<span>${esc(n.split(' ').slice(1).join(' '))}</span>`:''}</div></a><div class="sp"></div><button class="iconbtn" data-act="theme" aria-label="Toggle theme">${ic('moon')}</button><button class="btn sm hdr-in" data-act="auth-go" data-t="login">${ic('user')}<span>Sign in</span></button><button class="btn sm pri hdr-up" data-act="auth-go" data-t="register">Sign up</button></div>
 <div class="view enter"><div class="lbanner">${bigLogo()}<p>${esc(c.tagline||'Home, together.')}</p></div>${hero(true)}
 <div class="split" style="align-items:start"><div class="stack"><h2 style="font-size:clamp(26px,4vw,38px)">${esc(st.headline||`${s.tagline} One place for everything at ${n}.`)}</h2><p class="muted" style="max-width:56ch">${esc(st.intro)}</p>
 <div class="steps card flat">${st.steps.map((x,i)=>`<div><span class="n">${i+1}</span><div><b>${esc(x.t)}</b><br><small>${esc(x.d)}</small></div></div>`).join('')}</div>
 ${appCard()}${REMOTE?'':`<div class="demo">${ic('info')}<span><b>Demo data is loaded.</b> Try admin <code>admin</code> / <code>admin123</code> or resident <code>9876500001</code> / <code>resident123</code> or security guard <code>9876500099</code> / <code>guard123</code>.</span></div>`}</div>
 <div class="card auth"><div class="tabs2" role="tablist"><button class="${reg?'':'on'}" data-act="auth-tab" data-t="login">Sign in</button><button class="${reg?'on':''}" data-act="auth-tab" data-t="register">Register flat</button></div>
 ${reg?formWrap('register',F.t('r_name','Full name',{req:true,cls:'full',attrs:'autocomplete="name"'})+F.s('r_tower','Tower',towers.map(t=>[t,'Tower '+t]))+F.s('r_flat','Flat number',flatOpts(),{})+F.s('r_type','You are',['Owner','Tenant','Family member'])+F.t('r_members','People in flat',{type:'number',v:2,attrs:'min="1" max="12"'})+F.t('r_mobile','Mobile number',{req:true,attrs:'inputmode="numeric" maxlength="10" autocomplete="tel"',hint:'10 digits. This is your login.'})+F.t('r_email','Email (optional)',{type:'email'})+F.t('r_ref','Proof reference (optional)',{cls:'full',ph:'Allotment letter no. or rent agreement date',hint:'Helps the admin verify you faster.'})+F.t('r_pw','Create password',{type:'password',req:true,attrs:'autocomplete="new-password"'})+F.t('r_pw2','Confirm password',{type:'password',req:true,attrs:'autocomplete="new-password"'}),'Submit for approval'):
 formWrap('login',F.t('l_id','Mobile number, email or admin username',{req:true,cls:'full',attrs:'autocomplete="username"'})+F.t('l_pw','Password',{type:'password',req:true,cls:'full',attrs:'autocomplete="current-password"'}),'Sign in',`<span class="sp"></span>`)}
 ${reg||REMOTE?'':`<div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn sm ghost" data-act="demo-res">Fill demo resident</button><button class="btn sm ghost" data-act="demo-admin">Fill demo admin</button></div>`}</div></div></div>${siteFooter()}</div>`;
}
const flatOpts=(t='A')=>{const o=[];for(let f=1;f<=10;f++)for(let u=1;u<=4;u++)o.push(f+'0'+u);return o.map(x=>[x,'Flat '+x])};
function waitScreen(m){const rej=m.status==='rejected';return`<div class="wrap"><div class="landing-top">${brand()}<div class="sp"></div><button class="btn sm" data-act="logout">${ic('logout')}Sign out</button></div><div class="wait view enter"><div class="big">${ic(rej?'x':'hourglass')}</div><h2>${rej?'Registration not approved':'Waiting for admin approval'}</h2><p class="muted">${rej?`The admin declined your request${m.reason?': '+esc(m.reason):'.'} You can contact the society office or register again with correct details.`:`Thanks, ${esc(m.name.split(' ')[0])}. Your request for <b>${esc(flatKey(m))}</b> as ${esc(m.type.toLowerCase())} is with the committee. You will get full access as soon as it is approved.`}</p><div class="card flat" style="width:100%;text-align:left"><div class="kv"><span>Name</span><span>${esc(m.name)}</span></div><div class="kv"><span>Flat</span><span>${esc(flatKey(m))}</span></div><div class="kv"><span>Mobile</span><span>${esc(m.mobile)}</span></div><div class="kv"><span>Status</span><span>${sChip(m.status)}</span></div></div><div class="row">${btn('Check status','refresh',{c:'pri'})}${rej?btn('Register again','reregister'):''}</div></div></div>`}
ACT.refresh=async()=>{if(REMOTE){try{const r=await api('/api/state');adopt(r.db,r.rev);SES=r.session;setSes(SES)}catch(e){if(e.status===401)return endSession('Your session ended. Please sign in again.');return toast(e.message,'x')}}render(true);toast('Status refreshed','info')};
ACT['retry-boot']=async()=>{if(await startRemote())render(true)};
ACT.reregister=async()=>{if(REMOTE){try{await api('/api/auth/withdraw',{method:'POST'})}catch(e){return toast(e.message,'x')}TOKEN=null;lsDel(AKEY);setSes(null);UI.auth='register';await loadPublic();render(true);return}const m=me();DB.users=DB.users.filter(u=>u.id!==m.id);save();setSes(null);UI.auth='register';render(true)};
ACT['auth-tab']=d=>{UI.auth=d.t;render()};
ACT.noop=()=>{};
ACT['demo-res']=()=>{$('#l_id').value='9876500001';$('#l_pw').value='resident123'};
ACT['demo-admin']=()=>{$('#l_id').value='admin';$('#l_pw').value='admin123'};
FORMS.login=async(d,f)=>{
 if(REMOTE){try{const r=await api('/api/auth/login',{method:'POST',body:{id:d.l_id,password:d.l_pw}});await openSession(r.token,r.session);location.hash=SES.k==='admin'?'admin':(isGuard()?'gate':'home');render(true);const m=me();if(m&&m.name)toast('Welcome back, '+m.name.split(' ')[0])}catch(e){TOKEN=null;lsDel(AKEY);fErr(e.message)}return}
 const idf=d.l_id.trim().toLowerCase(),h=await sha(d.l_pw);
 if(idf===DB.settings.adminUser.toLowerCase()){if(h!==DB.settings.adminHash)return fErr('Incorrect admin password.');setSes({k:'admin'});location.hash='admin';render(true);return}
 const u=DB.users.find(u=>u.mobile===idf||(u.email&&u.email.toLowerCase()===idf));if(!u||u.passHash!==h)return fErr('Mobile, email or password is incorrect.');setSes({k:'user',id:u.id});location.hash=u.role==='security'?'gate':'home';render(true);toast('Welcome back, '+u.name.split(' ')[0])};
FORMS.register=async(d)=>{const mob=d.r_mobile.trim();
 if(d.r_name.trim().length<3)return fErr('Enter your full name.');
 if(!/^[6-9]\d{9}$/.test(mob))return fErr('Enter a valid 10 digit Indian mobile number.');
 if(d.r_pw.length<6)return fErr('Password needs at least 6 characters.');
 if(d.r_pw!==d.r_pw2)return fErr('The two passwords do not match.');
 if(REMOTE){try{const r=await api('/api/auth/register',{method:'POST',body:{name:d.r_name,tower:d.r_tower,flat:d.r_flat,type:d.r_type,members:d.r_members,mobile:mob,email:d.r_email,ref:d.r_ref,password:d.r_pw}});await openSession(r.token,r.session);render(true);confetti()}catch(e){TOKEN=null;lsDel(AKEY);fErr(e.message)}return}
 if(DB.users.some(u=>u.mobile===mob))return fErr('This mobile number is already registered. Sign in instead.');
 if(d.r_type==='Owner'&&DB.users.some(u=>u.tower===d.r_tower&&u.flat===d.r_flat&&u.type==='Owner'&&u.status==='approved'))return fErr(`${d.r_tower}-${d.r_flat} already has an approved owner. Register as Tenant or Family member, or contact the office.`);
 const u={id:uid('u'),name:d.r_name.trim(),tower:d.r_tower,flat:d.r_flat,mobile:mob,email:d.r_email.trim(),type:d.r_type,passHash:await sha(d.r_pw),status:'pending',role:'resident',title:'',members:+d.r_members||1,vehicle:'',showPhone:false,ref:d.r_ref.trim(),created:Date.now()};
 DB.users.push(u);notify('admin',`New registration request from ${u.name} (${flatKey(u)})`,'members');logAct(`${u.name} registered for ${flatKey(u)}`);save();setSes({k:'user',id:u.id});render(true);confetti()};
function fErr(t){const e=$('#ferr');if(e)e.textContent=t;return false}
