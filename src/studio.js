/* ========== site studio: logo, festive theme, website text, footer ========== */
/* Saved settings live in DB.settings.site. While the admin edits, changes live in DRAFT only.
   cfg() gives the rest of the app what to draw: the saved site, or the draft while previewing. */
const SITE_DEF=()=>({
 logo:'',
 theme:{festival:'none',from:'',to:'',effects:true,greeting:'',brand:'#0F4C4A',accent:'#E39A1B'},
 content:{headline:'',intro:'Notices, maintenance payments, events, bookings, helpdesk and more. Residents register their flat and get access after the society admin approves the request.',
  steps:[{t:'Register your flat',d:'Name, tower, flat number and mobile.'},{t:'Admin verifies',d:'The committee checks ownership or tenancy.'},{t:'Start using the app',d:'Pay dues, read notices, book amenities.'}],
  welcome:'',announce:{on:false,text:'',link:''}},
 footer:{about:'',phone:'',email:'',hours:'',links:[],social:{facebook:'',instagram:'',youtube:'',whatsapp:'',x:''},image:'',caption:'',showImage:true,copyright:''}
});
const BAD_KEY=k=>k==='__proto__'||k==='constructor'||k==='prototype';
function deepMerge(d,s){
 if(!s||typeof s!=='object')return d;
 for(const k of Object.keys(s)){if(BAD_KEY(k))continue;const v=s[k];
  if(Array.isArray(v))d[k]=JSON.parse(JSON.stringify(v));
  else if(v&&typeof v==='object'&&d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k]))deepMerge(d[k],v);
  else if(v!==undefined&&v!==null)d[k]=v}
 return d}
function mergeSite(s){
 const o=deepMerge(SITE_DEF(),s),def=SITE_DEF().content.steps;
 o.content.steps=def.map((x,i)=>{const y=o.content.steps[i]||{};return{t:y.t||x.t,d:y.d||x.d}});
 return o}

let DRAFT=null,BASE='',PV=null;
const siteDirty=()=>!!DRAFT&&JSON.stringify(DRAFT)!==BASE;
function cfg(){
 const dr=PV&&DRAFT,s=DB.settings;
 return{...s,...(dr?{name:DRAFT.name,tagline:DRAFT.tagline,address:DRAFT.address}:{}),site:mergeSite(dr?DRAFT.site:s.site)}}
function studioStart(){
 const s=DB.settings,d={name:s.name||'',tagline:s.tagline||'',address:s.address||'',site:mergeSite(s.site)};
 while(d.site.footer.links.length<6)d.site.footer.links.push({label:'',url:''});
 DRAFT=JSON.parse(JSON.stringify(d));BASE=JSON.stringify(DRAFT)}

/* ----- festive themes. Palettes are [brand, text on brand, accent, text on accent, sidebar] ----- */
const FEST=[
 {id:'none',name:'Standard',note:'Teal and amber',L:['#0F4C4A','#FFFFFF','#E39A1B','#2B1B00','#0B3B3A']},
 {id:'diwali',name:'Diwali',note:'Lamps and gold',L:['#8A3B0A','#FFFFFF','#F5B301','#2B1B00','#4F2005'],D:['#F0A030','#2B1400','#FFC857','#2B1B00','#2A1305'],fx:['rise',['#FFD166','#F5B301','#FF8A3D'],'spark'],strip:['#F5B301','#C2410C','#8A3B0A'],greet:'Happy Diwali from all of us at {name}.'},
 {id:'holi',name:'Holi',note:'Bright colours',L:['#7B2CBF','#FFFFFF','#FF4D8D','#3A0016','#3C1361'],D:['#C77DFF','#20093A','#FF7AA8','#3A0016','#1D0A33'],fx:['float',['#FF4D8D','#FFD23F','#3DDC97','#4CC9F0','#C77DFF'],'dot'],strip:['#FF4D8D','#FFD23F','#3DDC97','#4CC9F0','#C77DFF'],greet:'Happy Holi from {name}. Enjoy the colours.'},
 {id:'christmas',name:'Christmas',note:'Green, red and snow',L:['#146B3A','#FFFFFF','#D62839','#FFFFFF','#0B3D20'],D:['#52C788','#052313','#FF6B78','#3A0309','#08301A'],fx:['fall',['#FFFFFF','#E8F1F2','#CFE8FF'],'snow'],strip:['#D62839','#146B3A','#FFFFFF'],greet:'Merry Christmas from everyone at {name}.'},
 {id:'newyear',name:'New Year',note:'Navy and gold',L:['#1B2A6B','#FFFFFF','#E9B949','#231A00','#0F1744'],D:['#8EA2FF','#0B1240','#F2CC6B','#231A00','#0A0F30'],fx:['fall',['#E9B949','#FFFFFF','#8EA2FF','#FF6B78'],'conf'],strip:['#E9B949','#1B2A6B','#FFFFFF'],greet:'Happy New Year from {name}.'},
 {id:'republic',name:'Republic or Independence Day',note:'Tricolour',L:['#138808','#FFFFFF','#FF9933','#2B1500','#0B3D07'],D:['#4CC443','#04200A','#FFAA55','#2B1500','#0A2A08'],fx:['fall',['#FF9933','#FFFFFF','#138808'],'conf'],strip:['#FF9933','#FFFFFF','#138808'],greet:'Jai Hind. Warm wishes from {name}.'},
 {id:'eid',name:'Eid',note:'Green and gold',L:['#0B5D4B','#FFFFFF','#D4AF37','#2B2200','#06382C'],D:['#3FD1A5','#04221B','#E6C35C','#2B2200','#052A21'],fx:['rise',['#E6C35C','#FFF3C4'],'spark'],strip:['#0B5D4B','#D4AF37'],greet:'Eid Mubarak from all of us at {name}.'},
 {id:'navratri',name:'Navratri or Durga Puja',note:'Crimson and marigold',L:['#A4161A','#FFFFFF','#FFB400','#2B1B00','#5A0B0E'],D:['#FF6B6B','#2B0507','#FFC53D','#2B1B00','#2E0507'],fx:['fall',['#FFB400','#E11D48','#F97316','#FACC15'],'petal'],strip:['#E11D48','#F97316','#FACC15','#16A34A','#0EA5E9','#7C3AED'],greet:'Subho Navratri and Durga Puja wishes from {name}.'},
 {id:'ganesh',name:'Ganesh Chaturthi',note:'Saffron and petals',L:['#B03A0B','#FFFFFF','#FFC24B','#2B1B00','#5C1D05'],D:['#FF8A4C','#2B1000','#FFD27A','#2B1B00','#2E1004'],fx:['fall',['#FFB400','#FF7A00','#FFD166'],'petal'],strip:['#FF7A00','#FFC24B','#B03A0B'],greet:'Ganpati Bappa Morya. Happy Ganesh Chaturthi from {name}.'},
 {id:'custom',name:'Custom colours',note:'Pick your own'}
];
const hex2=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lum=h=>{const[r,g,b]=hex2(h).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
const mixHex=(a,b,k)=>'#'+hex2(a).map((v,i)=>Math.round(v*(1-k)+hex2(b)[i]*k).toString(16).padStart(2,'0')).join('');
const inkFor=h=>lum(h)>.35?'#1A1200':'#FFFFFF';
function festDef(site){
 const id=site.theme.festival,f=FEST.find(x=>x.id===id);
 if(id!=='custom')return f;
 const b=site.theme.brand,a=site.theme.accent,bd=lum(b)<.25?mixHex(b,'#FFFFFF',.45):b;
 return{...f,L:[b,inkFor(b),a,inkFor(a),mixHex(b,'#000000',.45)],D:[bd,inkFor(bd),a,inkFor(a),mixHex(b,'#000000',.78)],strip:[b,a]}}
function festActive(site){
 const t=site.theme;if(!t||t.festival==='none'||!FEST.some(x=>x.id===t.festival))return'';
 const today=new Date().toLocaleDateString('en-CA');
 if(t.from&&today<t.from)return'';if(t.to&&today>t.to)return'';return t.festival}
const palVars=p=>`--brand:${p[0]};--brand-ink:${p[1]};--accent:${p[2]};--accent-ink:${p[3]};--side-bg:${p[4]}`;
function festCss(id,L,D){const a=`:root[data-fest="${id}"]`;return`${a}{${palVars(L)}}@media (prefers-color-scheme:dark){${a}:not([data-theme="light"]){${palVars(D)}}}${a}[data-theme="dark"]{${palVars(D)}}`}
const prand=(i,m)=>((i*9301+49297+i*i*131)%233280)/233280*m;
function applyFx(def,on){
 let el=$('#fx');
 if(!def||!def.fx||!on){if(el)el.remove();return}
 const[mode,cols,shape]=def.fx,key=def.id+'|'+cols.join();
 if(el&&el.dataset.k===key)return;if(el)el.remove();
 el=document.createElement('div');el.id='fx';el.dataset.k=key;el.className=mode+' '+shape;el.setAttribute('aria-hidden','true');
 const n=mode==='float'?9:24,size=shape==='snow'?[4,9]:shape==='spark'?[3,6]:shape==='petal'?[9,15]:mode==='float'?[70,130]:[6,10];
 el.innerHTML=Array.from({length:n},(_,i)=>`<i style="--x:${Math.round(prand(i+1,100))}%;--s:${(size[0]+prand(i+7,size[1]-size[0])).toFixed(1)}px;--d:${(mode==='float'?14:7)+Math.round(prand(i+3,mode==='float'?10:8))}s;--dl:-${Math.round(prand(i+5,14))}s;--dx:${Math.round(prand(i+9,16)-8)}vw;--c:${cols[i%cols.length]}"></i>`).join('');
 document.body.appendChild(el)}
function applyTheme(){
 if(!DB)return;
 const c=cfg(),f=festActive(c.site),def=f?festDef(c.site):null,root=document.documentElement;
 let st=$('#fest-css');if(!st){st=document.createElement('style');st.id='fest-css';document.head.appendChild(st)}
 st.textContent=def&&def.L?festCss(f,def.L,def.D||def.L):'';
 if(def)root.dataset.fest=f;else delete root.dataset.fest;
 let strip=$('#fstrip');
 if(def&&def.strip){const cs=def.strip,w=cs.map((x,i)=>`${x} ${i*44}px ${(i+1)*44}px`).join(',');if(!strip){strip=document.createElement('div');strip.id='fstrip';strip.setAttribute('aria-hidden','true');document.body.appendChild(strip)}strip.style.background=`repeating-linear-gradient(90deg,${w})`}
 else if(strip)strip.remove();
 applyFx(def,c.site.theme.effects);
 document.body.classList.toggle('pv',!!PV)}

/* ----- logo, bars, footer ----- */
const logoOf=src=>src?`<img class="logo-img" src="${esc(src)}" alt="">`:animMark();
const logoHtml=()=>logoOf(cfg().site.logo);
const hrefOf=(u,label)=>String(u).startsWith('#')?`<a href="${esc(u)}">${label}</a>`:`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
function siteBars(){
 const c=cfg(),f=festActive(c.site),def=f?festDef(c.site):null,t=c.site.theme,an=c.site.content.announce;
 const greet=def&&!UI.fbOff?(t.greeting||(def.greet||'').replace('{name}',c.name)):'';
 return(greet?`<div class="fest-bar" role="status"><span>${esc(greet)}</span><button type="button" data-act="fest-close" aria-label="Hide greeting">${ic('x')}</button></div>`:'')+
  (an.on&&an.text?`<div class="ann-bar" role="status">${ic('info')}<span>${esc(an.text)}</span>${an.link?hrefOf(an.link,'Read more'):''}</div>`:'')}
ACT['fest-close']=()=>{UI.fbOff=true;render()};
const SOC=[['facebook','Facebook'],['instagram','Instagram'],['youtube','YouTube'],['whatsapp','WhatsApp'],['x','X']];
function siteFooter(){
 const c=cfg(),f=c.site.footer,links=f.links.filter(l=>l.label&&l.url),soc=SOC.filter(([k])=>f.social[k]),addr=c.address;
 const n=c.name||'Queenstown Society';
 return`<footer class="sitefoot">${f.showImage&&f.image?`<figure class="foot-img"><img src="${esc(f.image)}" alt="${esc(f.caption||n)}">${f.caption?`<figcaption>${esc(f.caption)}</figcaption>`:''}</figure>`:''}
 <div class="foot-grid"><div class="fcol"><a class="brand" href="#${SES?(isAdmin()?'admin':'home'):''}">${logoHtml()}<div><b>${esc(n.split(' ')[0])}</b><span>${esc(n.split(' ').slice(1).join(' ')||'Society')}</span></div></a>
 <p style="margin-top:12px">${esc(f.about||c.tagline||'')}</p>${soc.length?`<div class="soc">${soc.map(([k,l])=>hrefOf(f.social[k],l)).join('')}</div>`:''}</div>
 <div class="fcol">${links.length?`<h5>Quick links</h5>${links.map(l=>hrefOf(l.url,esc(l.label))).join('')}`:''}</div>
 <div class="fcol"><h5>Contact</h5>${addr?`<p>${ic('mappin')}${esc(addr)}</p>`:''}${f.phone?`<a href="tel:${esc(f.phone.replace(/[^0-9+]/g,''))}">${ic('phone')}${esc(f.phone)}</a>`:''}${f.email?`<a href="mailto:${esc(f.email)}">${ic('mail')}${esc(f.email)}</a>`:''}${f.hours?`<p>${ic('clock')}${esc(f.hours)}</p>`:''}</div></div>
 <div class="foot-bottom">${esc(f.copyright||`© ${new Date().getFullYear()} ${n}. All rights reserved.`)}</div></footer>`}

/* ----- image upload: resized in the browser so it stays small ----- */
function loadImg(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=()=>rej(new Error('That file could not be read.'));fr.onload=()=>{const im=new Image();im.onerror=()=>rej(new Error('That image could not be opened. Try a PNG or JPEG.'));im.onload=()=>res(im);im.src=fr.result};fr.readAsDataURL(file)})}
async function fitImage(file,{max,alpha,cap}){
 const im=await loadImg(file),w0=im.naturalWidth||im.width||max,h0=im.naturalHeight||im.height||max;
 let k=Math.min(1,max/Math.max(w0,h0));
 for(let i=0;i<8;i++){
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w0*k));c.height=Math.max(1,Math.round(h0*k));
  const x=c.getContext('2d');if(!alpha){x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height)}
  x.drawImage(im,0,0,c.width,c.height);
  let url;if(alpha){url=c.toDataURL('image/webp',.9);if(!url.startsWith('data:image/webp'))url=c.toDataURL('image/png')}else url=c.toDataURL('image/jpeg',Math.max(.5,.84-i*.06));
  if(url.length<=cap)return url;k*=.8}
 throw new Error('That image is too detailed to store. Try a smaller or simpler one.')}

/* ----- the editor ----- */
const gp=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
function sp(o,p,v){const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++){if(BAD_KEY(ks[i]))return;if(a[ks[i]]==null||typeof a[ks[i]]!=='object')a[ks[i]]={};a=a[ks[i]]}if(!BAD_KEY(ks.at(-1)))a[ks.at(-1)]=v}
const sid=p=>'sf_'+p.replace(/\./g,'_');
const SF={
 t:(p,l,o={})=>`<label class="fld ${o.cls||''}" for="${sid(p)}"><span>${l}</span><input id="${sid(p)}" data-site="${p}" type="${o.type||'text'}" value="${esc(gp(DRAFT,p)??'')}" ${o.ph?`placeholder="${esc(o.ph)}"`:''} ${o.max?`maxlength="${o.max}"`:''} ${o.attrs||''}>${o.hint?`<em class="hint">${o.hint}</em>`:''}</label>`,
 a:(p,l,o={})=>`<label class="fld ${o.cls||''}" for="${sid(p)}"><span>${l}</span><textarea id="${sid(p)}" data-site="${p}" ${o.max?`maxlength="${o.max}"`:''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} style="min-height:${o.h||78}px">${esc(gp(DRAFT,p)??'')}</textarea>${o.hint?`<em class="hint">${o.hint}</em>`:''}</label>`,
 c:(p,l,rr)=>`<label class="tgl"><input type="checkbox" id="${sid(p)}" data-site="${p}" ${rr?'data-rr="1"':''} ${gp(DRAFT,p)?'checked':''}><span class="sw" aria-hidden="true"></span><span>${l}</span></label>`
};
function imgBox(key,src,label,hint){
 return`<div class="upbox"><div class="upprev ${key}">${src?`<img src="${esc(src)}" alt="">`:key==='logo'?logo:`<span class="muted">No image</span>`}</div>
 <div class="stack" style="gap:8px"><div class="row wrap-r"><label class="btn sm pri" for="up_${key}">${ic('upload')}${src?'Replace':'Upload'} ${label}</label>${src?btn('Remove','site-img-clear',{sm:1,d:{k:key},i:'trash'}):''}</div>
 <input type="file" id="up_${key}" data-up="${key}" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden><small class="muted">${hint}</small></div></div>`}
function festTile(f){
 const site=DRAFT.site,on=site.theme.festival===f.id,p=f.id==='custom'?[site.theme.brand,0,site.theme.accent]:f.L;
 return`<button type="button" class="tile ${on?'on':''}" data-act="site-fest" data-id="${f.id}" aria-pressed="${on}"><span class="sw2" style="--a:${p[0]};--b:${p[2]}"></span><b>${esc(f.name)}</b><small>${esc(f.note)}</small></button>`}
ROUTES.studio=()=>{
 if(!isAdmin())return ROUTES.home();
 if(!DRAFT||!siteDirty())studioStart();
 const d=DRAFT,s=d.site,t=s.theme,c=s.content,f=s.footer,def=FEST.find(x=>x.id===t.festival),dirtyNow=siteDirty();
 return`<div class="studio">${head('Site studio','Change the logo, festive theme, website text and footer. Nothing goes live until you save.')}
 <div class="studio-bar" role="toolbar" aria-label="Site studio actions"><span id="studio-state" class="chip ${dirtyNow?'warn':'good'}">${dirtyNow?'Unsaved changes':'All changes saved'}</span><span class="sp"></span>
 <button type="button" class="btn sm" data-act="site-pv" data-p="landing">${ic('eye')}Preview</button>
 <button type="button" class="btn sm" data-act="site-discard" data-confirm="1" data-needs-dirty ${dirtyNow?'':'disabled'}>${ic('undo')}Discard</button>
 <button type="button" class="btn sm acc" data-act="site-save" data-needs-dirty ${dirtyNow?'':'disabled'}>${ic('check')}Save changes</button></div>

 <section class="card"><h3>${ic('image')}Logo and name</h3><div class="stack">${imgBox('logo',s.logo,'logo','PNG, JPEG, WebP or SVG. It is resized and kept small. A square logo on a transparent background looks best.')}
 <div class="frm">${SF.t('name','Society name',{max:80,cls:'full'})}${SF.t('tagline','Tagline',{max:300,cls:'full'})}</div></div></section>

 <section class="card"><h3>${ic('palette')}Festive theme</h3><div class="stack">
 <div class="tiles" role="group" aria-label="Theme">${FEST.map(festTile).join('')}</div>
 ${t.festival==='custom'?`<div class="frm">${SF.t('site.theme.brand','Main colour',{type:'color',attrs:'data-rr="1"'})}${SF.t('site.theme.accent','Highlight colour',{type:'color',attrs:'data-rr="1"'})}</div>`:''}
 ${t.festival!=='none'?`<div class="frm">${SF.a('site.theme.greeting','Greeting shown at the top of every page',{max:160,cls:'full',ph:def&&def.greet?def.greet.replace('{name}',d.name):'',h:64,hint:'Leave empty to use the suggested greeting.'})}
 ${SF.t('site.theme.from','Show from',{type:'date',hint:'Optional. The theme switches on by itself.'})}${SF.t('site.theme.to','Show until',{type:'date',hint:'Optional. The standard look returns after this date.'})}</div>
 ${SF.c('site.theme.effects','Falling lights, petals or snow'+(def&&def.fx?'':' (not used by this theme)'))}`:`<p class="muted">Pick a festival to change colours across the whole app, with a greeting bar and soft animation. You can set dates so it turns on and off by itself.</p>`}
 </div></section>

 <section class="card"><h3>${ic('layout')}Website text</h3><div class="stack">
 <p class="muted">This is the page visitors see before they sign in. Notices, events and ads are managed on their own screens.</p>
 <div class="frm">${SF.t('site.content.headline','Main headline',{max:160,cls:'full',ph:`${d.tagline} One place for everything at ${d.name}.`,hint:'Leave empty to use the suggested headline.'})}
 ${SF.a('site.content.intro','Intro paragraph',{max:500,cls:'full',h:90})}</div>
 ${c.steps.map((x,i)=>`<div class="frm pair">${SF.t(`site.content.steps.${i}.t`,`Step ${i+1} title`,{max:60})}${SF.t(`site.content.steps.${i}.d`,`Step ${i+1} detail`,{max:160})}</div>`).join('')}
 <div class="frm">${SF.t('site.content.welcome','Welcome line on the resident home page',{max:200,cls:'full',ph:'For example: Annual general meeting is on 14 December.'})}</div>
 <div class="subcard"><h4>Announcement bar</h4>${SF.c('site.content.announce.on','Show on every page',1)}${c.announce.on?`<div class="frm">${SF.t('site.content.announce.text','Announcement',{max:200,cls:'full'})}${SF.t('site.content.announce.link','Link (optional)',{max:300,cls:'full',ph:'https://... or #events'})}</div>`:''}</div>
 </div></section>

 <section class="card"><h3>${ic('building')}Footer</h3><div class="stack">
 <div class="frm">${SF.a('site.footer.about','About text',{max:400,cls:'full',h:70,ph:'A line or two about the society. Leave empty to show the tagline.'})}
 ${SF.a('address','Address',{max:300,cls:'full',h:56})}${SF.t('site.footer.phone','Phone',{max:20,attrs:'inputmode="tel"',ph:'+91 98765 43210'})}${SF.t('site.footer.email','Email',{max:120,type:'email'})}${SF.t('site.footer.hours','Office hours',{max:120,cls:'full',ph:'Mon to Sat, 9 am to 6 pm'})}</div>
 <div class="subcard"><h4>Quick links</h4><div class="stack" style="gap:10px">${f.links.map((l,i)=>`<div class="frm pair">${SF.t(`site.footer.links.${i}.label`,`Link ${i+1} label`,{max:40})}${SF.t(`site.footer.links.${i}.url`,`Link ${i+1} address`,{max:300,ph:'https://... or #notices'})}</div>`).join('')}</div></div>
 <div class="subcard"><h4>Social links</h4><div class="frm">${SOC.map(([k,l])=>SF.t(`site.footer.social.${k}`,l,{max:300,ph:'https://',type:'url'})).join('')}</div></div>
 <div class="subcard"><h4>Footer image</h4>${imgBox('footer',f.image,'image','Shown as a wide banner above the footer. JPEG, PNG or WebP, resized for you.')}
 <div class="frm" style="margin-top:12px">${SF.t('site.footer.caption','Caption',{max:120,cls:'full',ph:'For example: The clubhouse in spring'})}</div>${f.image?SF.c('site.footer.showImage','Show the image in the footer',1):''}</div>
 <div class="frm">${SF.t('site.footer.copyright','Copyright line',{max:160,cls:'full',ph:`© ${new Date().getFullYear()} ${d.name}. All rights reserved.`})}</div>
 </div></section></div>`};

function studioTouch(){
 const dn=siteDirty(),s=$('#studio-state');
 if(s){s.className='chip '+(dn?'warn':'good');s.textContent=dn?'Unsaved changes':'All changes saved'}
 $$('[data-needs-dirty]').forEach(b=>{b.disabled=!dn})}
function onSiteInput(e){
 const t=e.target;if(!t.dataset||!t.dataset.site||!DRAFT)return;
 sp(DRAFT,t.dataset.site,t.type==='checkbox'?t.checked:t.value);studioTouch();
 if(e.type==='change'&&t.dataset.rr)render()}
document.addEventListener('input',onSiteInput);
document.addEventListener('change',onSiteInput);
document.addEventListener('change',async e=>{
 const t=e.target;if(!t.dataset||!t.dataset.up||!DRAFT)return;
 const file=t.files&&t.files[0];t.value='';if(!file)return;
 if(!/^image\//.test(file.type))return toast('Choose an image file: PNG, JPEG, WebP or SVG.','x');
 const logoUp=t.dataset.up==='logo';
 try{const url=await fitImage(file,logoUp?{max:384,alpha:true,cap:140000}:{max:1400,alpha:false,cap:430000});
  sp(DRAFT,logoUp?'site.logo':'site.footer.image',url);render();toast(logoUp?'Logo added. Save to publish it.':'Image added. Save to publish it.')}
 catch(err){toast(err.message||'That image could not be used.','x')}});
ACT['site-img-clear']=d=>{if(!DRAFT)return;sp(DRAFT,d.k==='logo'?'site.logo':'site.footer.image','');render();toast('Removed. Save to publish.','info')};
ACT['site-fest']=d=>{
 if(!DRAFT)return;const t=DRAFT.site.theme,prev=FEST.find(x=>x.id===t.festival),next=FEST.find(x=>x.id===d.id);
 const was=prev&&prev.greet?prev.greet.replace('{name}',DRAFT.name):'';
 t.festival=d.id;
 if(!t.greeting||t.greeting===was)t.greeting=next&&next.greet?next.greet.replace('{name}',DRAFT.name):'';
 render()};

/* ----- preview, discard, save ----- */
function pvBar(){
 const dn=siteDirty();
 return`<div class="pvbar ${PV==='app'?'pv-app':''}" role="region" aria-label="Preview controls"><span class="chip warn">Preview${dn?': not saved':''}</span>
 <div class="seg" role="group" aria-label="Preview page"><button type="button" class="${PV==='landing'?'on':''}" data-act="site-pv" data-p="landing">Public page</button><button type="button" class="${PV==='app'?'on':''}" data-act="site-pv" data-p="app">Inside the app</button></div><span class="sp"></span>
 <button type="button" class="btn sm" data-act="site-pv-exit">${ic('edit')}Back to editor</button>
 <button type="button" class="btn sm" data-act="site-discard" data-confirm="1" ${dn?'':'disabled'}>${ic('undo')}Discard</button>
 <button type="button" class="btn sm acc" data-act="site-save" ${dn?'':'disabled'}>${ic('check')}Save changes</button></div>`}
ACT['site-pv']=d=>{
 if(!DRAFT)studioStart();PV=d.p;
 if(PV==='app'&&routeOf()==='studio')location.hash='admin';
 render(true);scrollTo(0,0)};
ACT['site-pv-exit']=()=>{PV=null;location.hash='studio';render(true)};
ACT['site-discard']=()=>{studioStart();PV=null;if(routeOf()!=='studio')location.hash='studio';render(true);toast('Changes discarded. The saved site is unchanged.','info')};
function siteErrors(d){
 const e=[],url=u=>/^(https?:\/\/\S+|#[\w\/-]{0,40})$/i.test(u),web=u=>/^https?:\/\/\S+$/i.test(u),f=d.site.footer,c=d.site.content,t=d.site.theme;
 if(!d.name.trim())e.push('Society name is required.');
 f.links.forEach((l,i)=>{const a=l.label.trim(),b=l.url.trim();if((a||b)&&!(a&&url(b)))e.push(`Quick link ${i+1} needs a label and an address that starts with https:// or #.`)});
 SOC.forEach(([k,l])=>{const v=(f.social[k]||'').trim();if(v&&!web(v))e.push(`${l} link must start with https://`)});
 if(f.email.trim()&&!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(f.email.trim()))e.push('The footer email address does not look right.');
 if(f.phone.trim()&&!/^[+0-9 ()-]{5,20}$/.test(f.phone.trim()))e.push('The footer phone number can only have digits, spaces, + ( ) and -.');
 if(c.announce.on&&!c.announce.text.trim())e.push('Write the announcement text, or switch the announcement bar off.');
 if(c.announce.link.trim()&&!url(c.announce.link.trim()))e.push('The announcement link must start with https:// or #.');
 if(t.from&&t.to&&t.to<t.from)e.push('The theme end date is before its start date.');
 return e}
ACT['site-save']=()=>{
 if(!DRAFT)return;
 const errs=siteErrors(DRAFT);if(errs.length)return toast(errs[0],'x');
 const base=JSON.parse(BASE),d=JSON.parse(JSON.stringify(DRAFT)),f=d.site.footer;
 f.links=f.links.map(l=>({label:l.label.trim(),url:l.url.trim()})).filter(l=>l.label&&l.url);
 for(const k of Object.keys(f.social))f.social[k]=(f.social[k]||'').trim();
 for(const k of['about','phone','email','hours','caption','copyright'])f[k]=f[k].trim();
 d.site.content.announce.link=d.site.content.announce.link.trim();
 for(const k of['name','tagline','address'])if(d[k]!==base[k])DB.settings[k]=d[k].trim();
 DB.settings.site=d.site;save();
 PV=null;studioStart();if(routeOf()!=='studio'&&isAdmin())location.hash='studio';
 render(true);toast('Saved. Residents and visitors see the changes now.')};
window.addEventListener('beforeunload',e=>{if(siteDirty()){e.preventDefault();e.returnValue=''}});
