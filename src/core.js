'use strict';
/* ========== utils ========== */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=(p='i')=>p+Math.random().toString(36).slice(2,9);
const DAY=864e5;
const inr=n=>'₹'+Math.round(n||0).toLocaleString('en-IN');
const D=x=>new Date(x);
const sod=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x};
const daysTo=d=>Math.round((sod(d)-sod(new Date()))/DAY);
const fdate=(x,o={day:'numeric',month:'short'})=>D(x).toLocaleDateString('en-IN',o);
const fdatey=x=>fdate(x,{day:'numeric',month:'short',year:'numeric'});
const fwd=x=>fdate(x,{weekday:'short',day:'numeric',month:'short'});
const ftime=x=>D(x).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
const mkey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
const mlabel=k=>{const [y,m]=k.split('-');return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})};
const mshort=k=>{const [y,m]=k.split('-');return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'short'})};
const mshift=(k,n)=>{const [y,m]=k.split('-').map(Number);return mkey(new Date(y,m-1+n,1))};
const rel=d=>{const n=daysTo(d);return n===0?'Today':n===1?'Tomorrow':n===-1?'Yesterday':n>0?`in ${n} days`:`${-n} days ago`};
const initials=n=>String(n||'?').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const greet=()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'};
const isoLocal=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)};
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hashStr=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)};
async function sha(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('qs|'+s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return'x'+btoa(unescape(encodeURIComponent('qs|'+s)))}}
function readImage(file,maxW=1200,q=.72){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{const k=Math.min(1,maxW/im.width),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q))};im.src=fr.result};fr.readAsDataURL(file)})}

/* ========== icons ========== */
const IP={
home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
bell:'<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 004 0"/>',
notice:'<path d="M3 11v3l14 5V6L3 11z"/><path d="M7 14v5a2 2 0 002 2"/><path d="M21 9v6"/>',
wallet:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
sunrise:'<path d="M3 18h18M6 18a6 6 0 0112 0M12 6V3M4.5 9.5L3 8M19.5 9.5L21 8"/>',
chat:'<path d="M4 4h16v12H8l-4 4V4z"/>',
key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
visitor:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0114 0"/><path d="M17 11l2 2 4-4"/>',
tag:'<path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
vote:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
book:'<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 21a7 7 0 0114 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.5a6 6 0 014 6.5"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="M5 12l5 5 9-10"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
moon:'<path d="M20 14A8 8 0 019.5 3.5 8 8 0 1020 14z"/>',
logout:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
search:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
pin:'<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4-1-6z"/>',
phone:'<path d="M5 3h4l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
more:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
chart:'<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>',
trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
mappin:'<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',cl:'<path d="M15 5l-7 7 7 7"/>',cr:'<path d="M9 5l7 7-7 7"/>',
building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
hourglass:'<path d="M6 3h12M6 21h12M7 3c0 6 5 6 5 9s-5 3-5 9M17 3c0 6-5 6-5 9s5 3 5 9"/>',
gym:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
send:'<path d="M21 3L3 11l7 3 3 7 8-18z"/>',
flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
palette:'<path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-2 0-.9-.5-1.4-.5-2.2 0-1 .8-1.8 1.8-1.8H18a3 3 0 003-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
layout:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>'
};
const ic=(n,c='')=>`<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IP[n]||''}</svg>`;

/* ========== generated scene art (placeholder for real event photos) ========== */
const PAL={
 festival:{sky:['#1a0b3b','#7a1f5c','#f08a4b'],glow:'#ffd27a',far:'#2e1450',near:'#140a2a',lamp:['#ffb347','#ff6b9a','#ffe27a']},
 sports:{sky:['#0b3c49','#1f8a8a','#f4d27a'],glow:'#fff1b8',far:'#0f4e59',near:'#08272f'},
 garden:{sky:['#0c3b3a','#3f8f6b','#f0d98a'],glow:'#fff3c4',far:'#17563f',near:'#0a2b26'},
 yoga:{sky:['#1c2f66','#e0728a','#ffc98b'],glow:'#fff0c8',far:'#2c3d79',near:'#101a3d'},
 night:{sky:['#060d24','#1d3557','#41689a'],glow:'#f6e7a8',far:'#16294d',near:'#0a1530'},
 meeting:{sky:['#16233f','#3f5f86','#e8a94a'],glow:'#ffe2a0',far:'#243858',near:'#0f1a30'},
 kids:{sky:['#3b1f78','#d1559e','#ffd86b'],glow:'#fff3a8',far:'#4d2b8c',near:'#25104f',lamp:['#6be3ff','#ff7ab8','#ffe066']}
};
function scene(kind='night',seed=1){
 const p=PAL[kind]||PAL.night,r=rng(seed*977+kind.length*13),W=1600,H=900,id='s'+Math.floor(r()*1e7),f=n=>n.toFixed(0);
 let s=`<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset=".62" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/></linearGradient><radialGradient id="${id}r"><stop offset="0" stop-color="${p.glow}" stop-opacity=".9"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#${id}g)"/>`;
 const sx=380+r()*900,sy=250+r()*110;
 s+=`<circle cx="${f(sx)}" cy="${f(sy)}" r="280" fill="url(#${id}r)"/>`;
 if(kind==='yoga'){s+=`<g class="rot" style="transform-origin:${f(sx)}px ${f(sy)}px">`;for(let i=0;i<28;i++){const a=i/28*Math.PI*2;s+=`<line x1="${f(sx+Math.cos(a)*76)}" y1="${f(sy+Math.sin(a)*76)}" x2="${f(sx+Math.cos(a)*(i%2?190:260))}" y2="${f(sy+Math.sin(a)*(i%2?190:260))}" stroke="${p.glow}" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`}s+='</g>'}
 s+=`<circle cx="${f(sx)}" cy="${f(sy)}" r="52" fill="${p.glow}"/>`;
 if(['night','festival','meeting','kids'].includes(kind))for(let i=0;i<50;i++)s+=`<circle class="tw" style="animation-delay:${(r()*4).toFixed(1)}s" cx="${f(r()*W)}" cy="${f(r()*420)}" r="${(r()*1.7+.6).toFixed(1)}" fill="#fff"/>`;
 s+=`<path d="M0 650 Q320 520 640 630 T1260 600 T1600 650 V900 H0Z" fill="${p.far}"/>`;
 const tw=(x0,n,col,hmin,hmax,base,lit)=>{let o='',x=x0;for(let i=0;i<n;i++){const w=74+r()*54,h=hmin+r()*(hmax-hmin);o+=`<rect x="${f(x)}" y="${f(base-h)}" width="${f(w)}" height="${f(h)}" fill="${col}"/>`;if(lit)for(let yy=base-h+18;yy<base-16;yy+=24)for(let xx=x+10;xx<x+w-14;xx+=19)if(r()<.36)o+=`<rect x="${f(xx)}" y="${f(yy)}" width="8" height="12" rx="1" fill="#ffd27a" opacity="${(.4+r()*.55).toFixed(2)}"/>`;x+=w+10+r()*30}return o};
 s+=tw(-30,13,p.far,200,360,720,false)+tw(-10,12,p.near,260,520,800,true);
 s+=`<rect y="790" width="${W}" height="110" fill="${p.near}"/>`;
 if(p.lamp){s+=`<path d="M0 90 Q400 190 800 110 T1600 130" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"/>`;for(let i=0;i<14;i++){const x=60+i*115,y=95+Math.sin(i*.55)*38+i*2.4,c=p.lamp[i%3];s+=`<g class="sway" style="animation-delay:${(i*.3).toFixed(1)}s"><line x1="${x}" y1="${f(y-6)}" x2="${x}" y2="${f(y+22)}" stroke="#000" stroke-opacity=".4"/><circle cx="${x}" cy="${f(y+40)}" r="30" fill="${c}" opacity=".28"/><ellipse cx="${x}" cy="${f(y+40)}" rx="14" ry="18" fill="${c}"/></g>`}}
 if(kind==='garden'||kind==='yoga'||kind==='sports')for(let i=0;i<9;i++){const x=40+i*190+r()*60,h=90+r()*80;s+=`<g class="sway" style="animation-delay:${(r()*3).toFixed(1)}s"><rect x="${f(x-6)}" y="${f(800-h)}" width="12" height="${f(h)}" fill="#07201c"/><circle cx="${f(x)}" cy="${f(800-h-34)}" r="${f(46+r()*20)}" fill="${i%2?'#1d6b4f':'#2f8a5f'}"/><circle cx="${f(x+28)}" cy="${f(800-h-10)}" r="40" fill="#1d6b4f"/></g>`}
 if(kind==='sports'){s+=`<path d="M0 840 L1600 840 L1600 900 L0 900Z" fill="#1f7a4a"/>`;for(let i=0;i<8;i++)s+=`<path d="M${i*200} 840 L${i*200+100} 840 L${i*200+60} 900 L${i*200-40} 900Z" fill="#2a9158" opacity=".7"/>`;s+=`<circle cx="${f(sx-120)}" cy="${f(sy+170)}" r="22" fill="#fff"/><path d="M${f(sx-420)} 640 Q${f(sx-250)} 360 ${f(sx-120)} ${f(sy+170)}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="10 12"/>`}
 if(kind==='kids')for(let i=0;i<8;i++){const x=120+i*190+r()*50,y=560+r()*120,c=p.lamp[i%3];s+=`<g class="sway" style="animation-delay:${(r()*3).toFixed(1)}s"><ellipse cx="${f(x)}" cy="${f(y)}" rx="34" ry="42" fill="${c}"/><path d="M${f(x)} ${f(y+42)} q-8 60 6 110" fill="none" stroke="#fff" stroke-opacity=".6"/></g>`}
 for(let i=0;i<16;i++){const x=i*105+r()*40;s+=`<circle cx="${f(x)}" cy="812" r="${f(24+r()*20)}" fill="${p.near}"/>`}
 return s+'</svg>';
}
const cover=e=>e.cover?`<img class="art" src="${e.cover}" alt="">`:scene(e.scene,hashStr(e.id));

/* ========== store ========== */
const KEY='qs_data_v1',SKEY='qs_session_v1',TKEY='qs_theme',AKEY='qs_token_v1';
/* Two modes. With no API address (config.js) the app runs on this browser only, using demo data.
   With an API address it talks to the Render server, which keeps everything in MongoDB. */
const API=String((typeof window!=='undefined'&&window.QS_API)||'').trim().replace(/\/+$/,'');
const REMOTE=!!API;
let DB=null,SES=null,TOKEN=null;
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){}};
function loadDB(){try{const r=lsGet(KEY);DB=r?JSON.parse(r):null}catch(e){DB=null}try{SES=JSON.parse(lsGet(SKEY)||'null')}catch(e){SES=null}}
function setSes(s){SES=s;if(s)lsSet(SKEY,JSON.stringify(s));else lsDel(SKEY)}
const adminName=()=>REMOTE?(SES&&SES.username)||'admin':DB.settings.adminUser;

/* ----- remote mode: server calls and change syncing ----- */
const SYNC_COLLS=['users','notices','events','bills','schedule','amenities','bookings','complaints','ads','polls','docs','contacts','entries','visitors','notifs','log'];
let SNAP={},syncing=false,dirty=false,LASTREV=null,syncTimer=null,failStreak=0,LASTREJ=[];
/* Saves now and waits for the server. Returns the changes the server refused (empty when all was saved). */
async function flushWait(){if(!REMOTE||!TOKEN)return[];clearTimeout(syncTimer);for(let i=0;i<60&&syncing;i++)await new Promise(r=>setTimeout(r,100));LASTREJ=[];await flush();return LASTREJ}
async function api(path,opt={}){
 const h={'Content-Type':'application/json'};if(TOKEN)h.Authorization='Bearer '+TOKEN;
 let r;try{r=await fetch(API+path,{method:opt.method||'GET',headers:h,body:opt.body?JSON.stringify(opt.body):undefined})}
 catch(e){const er=new Error('Cannot reach the server. Check your internet connection and try again.');er.net=true;throw er}
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok){const er=new Error(j.error||'Something went wrong. Try again.');er.status=r.status;throw er}
 return j}
const snapOf=db=>{const s={settings:{settings:JSON.stringify(db.settings)}};for(const c of SYNC_COLLS){s[c]={};for(const d of (db[c]||[]))if(d&&d.id)s[c][d.id]=JSON.stringify(d)}return s};
function adopt(db,rev){DB=db;for(const c of SYNC_COLLS)DB[c]=DB[c]||[];SNAP=snapOf(DB);LASTREV=rev==null?LASTREV:rev}
function save(){
 if(!REMOTE){if(!lsSet(KEY,JSON.stringify(DB)))toast('Browser storage is full or blocked. Changes will be lost on reload.');return}
 if(!TOKEN)return;dirty=true;clearTimeout(syncTimer);syncTimer=setTimeout(flush,250)}
async function flush(){
 if(syncing||!dirty||!TOKEN||!DB)return;
 syncing=true;dirty=false;const prev=SNAP;
 try{
  DB.log=DB.log||[];DB.log.forEach(l=>{if(!l.id)l.id=uid('l')});
  const cur=snapOf(DB),changes={};
  for(const c of ['settings',...SYNC_COLLS]){const a=cur[c]||{},b=prev[c]||{},up=[],rem=[];
   for(const id in a)if(a[id]!==b[id])up.push(c==='settings'?{...DB.settings,id:'settings'}:JSON.parse(a[id]));
   for(const id in b)if(!(id in a))rem.push(id);
   if(up.length||rem.length)changes[c]={upsert:up,remove:rem}}
  if(!Object.keys(changes).length)return;
  SNAP=cur;
  const r=await api('/api/sync',{method:'POST',body:{changes}});failStreak=0;
  const rej=(r.rejected||[]).filter(x=>x.coll!=='log');
  if(!dirty)adopt(r.db,r.rev);
  LASTREJ=rej;
  if(rej.length){toast(rej[0].err||'Some changes could not be saved.','x');render()}
 }catch(e){
  if(e.status===401){syncing=false;return endSession('Your session ended. Please sign in again.')}
  SNAP=prev;dirty=true;if(!failStreak++)toast(e.net?'You are offline. Changes will save when you reconnect.':e.message,'x');
  setTimeout(flush,Math.min(30000,4000*failStreak))
 }finally{syncing=false;if(dirty&&!failStreak)flush()}}
function endSession(msg){TOKEN=null;lsDel(AKEY);setSes(null);UI.auth='login';location.hash='';loadPublic().finally(()=>{render(true);if(msg)toast(msg,'info')})}
async function loadPublic(){try{const r=await api('/api/public');adopt(r.db,r.rev)}catch(e){if(!DB)DB={v:1,settings:{name:'Queenstown Society',tagline:'Home, together.'}}; for(const c of SYNC_COLLS)DB[c]=DB[c]||[]}}
async function openSession(token,session){TOKEN=token;lsSet(AKEY,token);setSes(session);const r=await api('/api/state');adopt(r.db,r.rev);SES=r.session;setSes(SES)}
async function startRemote(){
 $('#app').innerHTML='<div class="boot" role="status"><div class="spin"></div><b>Connecting to Queenstown</b><small id="bootnote"></small></div>';
 const t=setTimeout(()=>{const n=$('#bootnote');if(n)n.textContent='The server is waking up. The first load can take up to a minute.'},4000);
 try{
  TOKEN=lsGet(AKEY);try{SES=JSON.parse(lsGet(SKEY)||'null')}catch(e){SES=null}
  if(TOKEN){try{const r=await api('/api/state');adopt(r.db,r.rev);SES=r.session;setSes(SES)}catch(e){if(e.status!==401)throw e;TOKEN=null;lsDel(AKEY);setSes(null)}}
  if(!TOKEN){SES=null;const r=await api('/api/public');adopt(r.db,r.rev)}
  return true
 }catch(e){
  $('#app').innerHTML=`<div class="boot"><b>Cannot reach the Queenstown server</b><small>${esc(e.message)}</small><button class="btn pri" data-act="retry-boot">Try again</button></div>`;return false
 }finally{clearTimeout(t)}}
async function pollRemote(){
 if(!REMOTE||document.hidden||syncing||dirty||!DB)return;
 if($('#modal-root')?.classList.contains('open'))return;
 const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
 if(!TOKEN){try{const r=await api('/api/rev');if(r.rev===LASTREV)return;const p=await api('/api/public');adopt(p.db,p.rev);render()}catch(e){}return}
 try{const r=await api('/api/rev');if(r.rev===LASTREV)return;const s=await api('/api/state');if(dirty||syncing)return;adopt(s.db,s.rev);SES=s.session;render()}
 catch(e){if(e.status===401)endSession('Your session ended. Please sign in again.')}}
if(typeof document!=='undefined'){setInterval(()=>pollRemote(),20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollRemote()})}
const me=()=>!SES?null:SES.k==='admin'?{id:'admin',name:'Society Admin',role:'admin',status:'approved'}:DB.users.find(u=>u.id===SES.id)||null;
const isAdmin=()=>SES?.k==='admin';
const flatKey=u=>u.tower+'-'+u.flat;
function notify(to,text,link){DB.notifs.unshift({id:uid('n'),to,text,link:link||'',at:Date.now(),read:[]});DB.notifs=DB.notifs.slice(0,200)}
function logAct(t){DB.log.unshift({t,at:Date.now()});DB.log=DB.log.slice(0,60)}
const myNotifs=()=>{const m=me();return m?DB.notifs.filter(n=>isAdmin()?(n.to==='admin'||n.to==='all'):(n.to===m.id||n.to==='all')):[]};
const unreadN=()=>{const m=me();return myNotifs().filter(n=>!n.read.includes(m.id)).length};

/* money */
const chargeTotal=()=>DB.settings.charges.reduce((a,c)=>a+Number(c.amt||0),0);
function lateFee(b){if(b.status==='paid')return b.lateFee||0;return daysTo(b.dueDate)<0?Math.round(b.amount*DB.settings.latePct/100):0}
const billTotal=b=>b.amount+lateFee(b);
const billsOf=fk=>DB.bills.filter(b=>b.flat===fk).sort((a,b)=>b.month.localeCompare(a.month));
const unpaidOf=fk=>billsOf(fk).filter(b=>b.status!=='paid');
function collection(m){const bs=DB.bills.filter(b=>b.month===m),paid=bs.filter(b=>b.status==='paid');return{total:bs.length,paid:paid.length,ver:bs.filter(b=>b.status==='verifying').length,billed:bs.reduce((a,b)=>a+b.amount,0),got:paid.reduce((a,b)=>a+billTotal(b),0),pct:bs.length?Math.round(paid.length/bs.length*100):0}}
const approvedFlats=()=>{const m=new Map();DB.users.filter(u=>u.status==='approved').forEach(u=>{const k=flatKey(u);if(!m.has(k)||u.type==='Owner')m.set(k,u)});return[...m.values()]};
function genBills(month){let n=0;approvedFlats().forEach(u=>{const fk=flatKey(u);if(DB.bills.some(b=>b.flat===fk&&b.month===month))return;const[y,mm]=month.split('-').map(Number);DB.bills.push({id:uid('b'),flat:fk,month,amount:chargeTotal(),items:DB.settings.charges.map(c=>({...c})),dueDate:new Date(y,mm-1,DB.settings.dueDay,23,59).toISOString(),status:'due'});n++});return n}
function ledger(n=6){const out=[];for(let i=n-1;i>=0;i--){const k=mshift(mkey(),-i);let inc=0,exp=0;DB.bills.filter(b=>b.status==='paid'&&(b.paidOn?mkey(D(b.paidOn)):b.month)===k).forEach(b=>inc+=billTotal(b));DB.entries.filter(e=>mkey(D(e.date))===k).forEach(e=>e.type==='income'?inc+=e.amount:exp+=e.amount);out.push({k,inc,exp})}return out}

/* ========== forecast ========== */
const KIND={event:['Event','var(--accent)'],maintenance:['Works','var(--info)'],due:['Due','var(--bad)'],meeting:['Meeting','var(--brand)'],booking:['Booking','var(--good)']};
function forecastItems(from=sod(new Date()),to=new Date(+from+31*DAY),opts={}){
 const out=[],inR=d=>{const t=+D(d);return t>=+from&&t<+to};
 DB.events.forEach(e=>{if(inR(e.date))out.push({at:e.date,kind:e.category==='Meeting'?'meeting':'event',title:e.title,sub:e.venue,link:'events',id:e.id})});
 DB.schedule.forEach(s=>{if(inR(s.date))out.push({at:s.date,kind:s.kind||'maintenance',title:s.title,sub:s.note,link:'forecast',id:s.id})});
 const m=me();
 if(m&&!isAdmin()&&!opts.publicOnly){unpaidOf(flatKey(m)).forEach(b=>{if(inR(b.dueDate))out.push({at:b.dueDate,kind:'due',title:'Maintenance due '+mlabel(b.month),sub:inr(billTotal(b)),link:'maintenance'})});
  DB.bookings.filter(b=>b.userId===m.id&&b.status!=='rejected'&&inR(b.date)).forEach(b=>out.push({at:b.date,kind:'booking',title:(DB.amenities.find(a=>a.id===b.amenityId)||{}).name+' booking',sub:b.slot,link:'amenities'}))}
 if(isAdmin()){DB.bills.length&&[mkey(),mshift(mkey(),1)].forEach(k=>{const[y,mm]=k.split('-').map(Number),d=new Date(y,mm-1,DB.settings.dueDay,23,59);if(inR(d))out.push({at:d,kind:'due',title:'Maintenance due date '+mlabel(k),sub:'Collected '+collection(k).pct+'%',link:'billing'})})}
 return out.sort((a,b)=>D(a.at)-D(b.at));
}

/* ========== seed (demo data) ========== */
async function seed(){
 const r=rng(42),ph=await sha('resident123'),ah=await sha('admin123'),now=Date.now();
 const at=(d,h,mi=0)=>{const x=new Date();x.setDate(x.getDate()+d);x.setHours(h,mi,0,0);return x.toISOString()};
 const FN=['Aarav','Priya','Sanjay','Meenakshi','Farhan','Ananya','Vikram','Sneha','Arjun','Kavya','Rohit','Divya','Karthik','Nisha','Manish','Pooja','Imran','Tara','Gaurav','Lakshmi','Deepak','Rina','Suresh','Anita','Harsh','Isha','Naveen','Shalini','Pranav','Mitali'];
 const LN=['Nair','Kulkarni','Iyer','Qureshi','Sharma','Mehta','Rao','Das','Banerjee','Gupta','Verma','Reddy','Singh','Joshi','Menon','Kapoor','Bose','Pillai','Chopra','Sen'];
 const users=[];let tIdx=0;const used=new Set(['A101']);
 const mk=(i,name,extra={})=>{let t,fl;do{t='ABCD'[tIdx++%4];fl=(1+Math.floor(r()*10))+'0'+(1+Math.floor(r()*4))}while(used.has(t+fl));used.add(t+fl);
  return{id:'u'+i,name,tower:t,flat:fl,mobile:'9876500'+String(i+1).padStart(3,'0'),email:name.toLowerCase().replace(/[^a-z]/g,'.')+'@example.com',type:r()<.82?'Owner':'Tenant',passHash:ph,status:'approved',role:'resident',title:'',members:1+Math.floor(r()*4),vehicle:r()<.7?'WB 0'+Math.floor(r()*9)+' '+String.fromCharCode(65+Math.floor(r()*20))+' '+(1000+Math.floor(r()*8999)):'',showPhone:r()<.5,created:now-(200+r()*600)*DAY,...extra}};
 for(let i=0;i<44;i++){const name=i===0?'Priya Nair':FN[(i*7)%FN.length]+' '+LN[(i*3+i%5)%LN.length];users.push(mk(i,name))}
 users[0].tower='A';users[0].flat='101';users[0].type='Owner';users[0].showPhone=true;
 users[1].role='committee';users[1].title='President';users[1].name='Sanjay Kulkarni';users[2].role='committee';users[2].title='Secretary';users[2].name='Meenakshi Iyer';users[3].role='committee';users[3].title='Treasurer';users[3].name='Farhan Qureshi';
 users.push({id:'g1',name:'Ramesh Yadav',tower:'',flat:'',mobile:'9876500099',email:'',type:'Security',passHash:await sha('guard123'),status:'staff',role:'security',title:'Security',members:1,vehicle:'',showPhone:false,ref:'',created:now-20*DAY});
 users.push({id:'u90',name:'Neha Bansal',tower:'B',flat:'704',mobile:'9876500901',email:'neha.bansal@example.com',type:'Owner',passHash:ph,status:'pending',role:'resident',title:'',members:3,vehicle:'',showPhone:false,ref:'Allotment letter 1187',created:now-1*DAY});
 users.push({id:'u91',name:'Imran Sheikh',tower:'C',flat:'305',mobile:'9876500902',email:'imran.sheikh@example.com',type:'Tenant',passHash:ph,status:'pending',role:'resident',title:'',members:2,vehicle:'',showPhone:false,ref:'Rent agreement 11 months',created:now-3*3600e3});
 const settings={name:'Queenstown Society',tagline:'Home, together.',address:'Queenstown Society, Main Gate Road',upi:'queenstown.society@upi',payMethods:{online:false,upi:true,bank:true},upiName:'Queenstown Society',charges:[{label:'Maintenance charges',amt:2200},{label:'Sinking fund',amt:300},{label:'Water and common electricity',amt:450},{label:'Security and housekeeping',amt:350}],dueDay:15,latePct:2,adRates:{banner:500,classified:0},adminUser:'admin',adminHash:ah,demo:true};
 const ev=(title,scene,d,h,venue,cat,fee,desc,o={})=>({id:uid('e'),title,scene,date:at(d,h),venue,category:cat,fee,desc,featured:true,rsvps:{},cover:null,photos:[],capacity:0,...o});
 const events=[
  ev('Yoga and Wellness Morning','yoga',3,6,'Central Lawn','Wellness',0,'A guided one hour yoga and breathing session for all ages, led by a certified instructor. Bring your own mat.'),
  ev('Winter Sports Fest','sports',9,8,'Sports Court and Cricket Pitch','Sports',100,'Badminton, box cricket, table tennis and a kids relay. Team entries close two days before the event. Fee covers refreshments and trophies.'),
  ev('Annual Day Cultural Evening','night',16,18,'Amphitheatre','Cultural',0,'Dance, music and skits by residents of all ages. Rehearsal slots open on the notice board. Dinner follows the show.'),
  ev('Annual General Meeting 2026','meeting',25,11,'Clubhouse Hall','Meeting',0,'Presentation of audited accounts, budget for next year, committee election and open floor. Every flat gets one vote.',{featured:false}),
  ev('Christmas Carnival and Kids Fair','kids',45,16,'Central Lawn','Festival',150,'Stalls, games, a puppet show, Santa visit and a food court run by residents. Stall booking is open in Marketplace.'),
  ev('New Year Gala Night','festival',51,20,'Amphitheatre and Clubhouse','Festival',600,'Live band, dinner buffet and midnight countdown with a lights show. Family passes are limited.',{capacity:300}),
  ev('Diwali Mela and Rangoli Night','festival',-2,18,'Central Lawn','Festival',0,'Thank you for a bright evening. Rangoli winners and the best decorated tower were announced on stage.',{rsvps:{}}),
  ev('Durga Puja Celebration','festival',-23,17,'Community Hall','Festival',0,'Four days of aarti, dhunuchi dance, bhog and cultural programmes.',{featured:false})
 ];
 users.filter(u=>u.status==='approved').forEach((u,i)=>events.forEach(e=>{if(r()<.35)e.rsvps[u.id]=r()<.8?'yes':'maybe'}));
 const mnow=mkey(),months=[0,1,2,3,4,5].map(i=>mshift(mnow,-i)),bills=[];
 users.filter(u=>u.status==='approved').forEach(u=>{const fk=flatKey(u);months.forEach((m,mi)=>{const[y,mm]=m.split('-').map(Number),due=new Date(y,mm-1,settings.dueDay,23,59);const b={id:uid('b'),flat:fk,month:m,amount:3300,items:settings.charges.map(c=>({...c})),dueDate:due.toISOString(),status:'paid'};
  if(mi===0){const x=r();b.status=u.id==='u0'?'due':x<.5?'paid':x<.58?'verifying':'due'}
  if(b.status==='paid'){const pd=new Date(due);pd.setDate(pd.getDate()-Math.floor(r()*8));b.paidOn=pd.toISOString();b.method=r()<.7?'UPI':'Bank transfer';b.ref=b.method==='UPI'?'UPI'+Math.floor(1e11+r()*9e11):'NEFT'+Math.floor(1e8+r()*9e8);b.lateFee=0}
  if(b.status==='verifying'){b.method='UPI';b.ref='UPI'+Math.floor(1e11+r()*9e11);b.submittedOn=new Date().toISOString()}
  bills.push(b)})});
 const notices=[
  {t:'Water tank cleaning on '+fdate(at(4,0),{weekday:'long',day:'numeric',month:'long'}),b:'The overhead tanks of all four towers will be cleaned between 9 am and 3 pm. Water supply will be interrupted. Please store water for essential use in advance. The work is done by the approved contractor under committee supervision.',c:'Maintenance',p:'high',pin:true,d:-1},
  {t:'Annual General Meeting notice',b:'The AGM is on '+fdate(at(25,0),{weekday:'long',day:'numeric',month:'long',year:'numeric'})+' at 11 am in the Clubhouse Hall. Agenda: audited accounts, budget 2027, election of committee members and any other matter with the Chair permission. Proxy forms are available in Documents.',c:'Finance',p:'high',pin:true,d:-3},
  {t:'Visitor pre-approval is now mandatory',b:'From this month, all expected visitors and delivery partners should be pre-approved in the Visitors section. Security will ask for the six digit code at the gate. Unexpected visitors are allowed only after a call to the flat.',c:'Security',p:'normal',pin:false,d:-6},
  {t:'Lift servicing for Tower B',b:'One lift in Tower B will be out of service from 10 am to 1 pm for the quarterly AMC service. The second lift will be running as usual.',c:'Maintenance',p:'normal',pin:false,d:-8},
  {t:'Festive decoration guidelines',b:'Please do not use open flames or diyas in corridors and staircases. Electric lights are permitted on balconies until 11 pm. Fire safety equipment must never be blocked.',c:'Emergency',p:'high',pin:false,d:-10},
  {t:'Parking sticker renewal',b:'Residents with expired parking stickers should apply at the society office with the vehicle RC copy. Vehicles without a valid sticker will not be allowed after the 30th.',c:'General',p:'normal',pin:false,d:-14},
  {t:'Clubhouse gym timings changed',b:'The gym is now open from 5:30 am to 10 pm. Children below 16 are allowed only with a guardian.',c:'General',p:'normal',pin:false,d:-20}
 ].map(n=>({id:uid('n'),title:n.t,body:n.b,category:n.c,priority:n.p,pinned:n.pin,date:at(n.d,10),author:'Society Office',readBy:users.filter(u=>r()<.4).map(u=>u.id).filter(x=>x!=='u0')}));
 const schedule=[
  {id:uid('s'),title:'Water tank cleaning',date:at(4,9),kind:'maintenance',note:'Supply off 9 am to 3 pm'},
  {id:uid('s'),title:'Tower B lift servicing',date:at(6,10),kind:'maintenance',note:'One lift out of service'},
  {id:uid('s'),title:'DG set load test',date:at(8,11),kind:'maintenance',note:'Short power cut, 20 minutes'},
  {id:uid('s'),title:'Pest control, all towers',date:at(12,10),kind:'maintenance',note:'Keep kitchen cabinets open'},
  {id:uid('s'),title:'Garden redevelopment begins',date:at(14,8),kind:'maintenance',note:'North lawn closed for 10 days'},
  {id:uid('s'),title:'Fire drill',date:at(19,17),kind:'maintenance',note:'All residents to assemble at Gate 2'},
  {id:uid('s'),title:'Committee meeting',date:at(7,19),kind:'meeting',note:'Clubhouse office'}
 ];
 const amenities=[
  {id:'am1',name:'Banquet Hall',rate:3000,unit:'per slot',capacity:120,hours:'8 am to 11 pm',desc:'Air conditioned hall with a pantry and stage. Cleaning charges included.',scene:'festival'},
  {id:'am2',name:'Clubhouse Lounge',rate:800,unit:'per slot',capacity:30,hours:'8 am to 10 pm',desc:'Ideal for birthday parties and small gatherings.',scene:'meeting'},
  {id:'am3',name:'Tennis Court',rate:150,unit:'per hour',capacity:4,hours:'6 am to 9 pm',desc:'Floodlit synthetic court. Racquets available at the desk.',scene:'sports'},
  {id:'am4',name:'Swimming Pool',rate:0,unit:'free for residents',capacity:40,hours:'6 am to 9 am, 4 pm to 8 pm',desc:'Swim cap compulsory. Lifeguard on duty. Guests need a pass.',scene:'yoga'},
  {id:'am5',name:'Guest Room',rate:1200,unit:'per night',capacity:3,hours:'Check-in 12 pm',desc:'Two guest rooms for visiting relatives. Book at least two days ahead.',scene:'garden'}
 ];
 const bookings=[{id:uid('k'),amenityId:'am3',userId:'u0',date:at(2,0),slot:'Evening',purpose:'Practice with friends',status:'approved',at:now-DAY},{id:uid('k'),amenityId:'am1',userId:'u5',date:at(18,0),slot:'Night',purpose:'Anniversary dinner',status:'pending',at:now-3600e3}];
 const complaints=[
  {id:uid('c'),userId:'u0',category:'Plumbing',title:'Water leakage from bathroom ceiling',body:'Seepage in the common bathroom ceiling since two days. It seems to come from the flat above.',priority:'normal',status:'in-progress',assignee:'Mr. Biswas, plumber',created:now-2*DAY,comments:[{by:'Society Office',text:'Plumber will visit tomorrow morning between 10 and 12.',at:now-DAY,admin:true}]},
  {id:uid('c'),userId:'u7',category:'Lift',title:'Tower C lift 2 making noise',body:'Grinding sound between floors 5 and 6.',priority:'high',status:'open',assignee:'',created:now-5*3600e3,comments:[]},
  {id:uid('c'),userId:'u9',category:'Housekeeping',title:'Garbage not collected on Sunday',body:'Tower A, third floor landing.',priority:'normal',status:'resolved',assignee:'Housekeeping',created:now-6*DAY,comments:[{by:'Society Office',text:'Staff briefed. Collection has resumed.',at:now-5*DAY,admin:true}]},
  {id:uid('c'),userId:'u12',category:'Parking',title:'Unknown car in visitor slot for 3 days',body:'Silver hatchback near Tower D gate.',priority:'normal',status:'open',assignee:'',created:now-DAY,comments:[]}
 ];
 const ads=[
  {id:uid('a'),userId:'u4',business:'Sharma Home Tuitions',title:'Maths and Science for classes 6 to 10',body:'Small batches of six. First week free. Located in Tower B.',category:'Tuition',contact:'98765 00005',price:'₹1,800 per month',type:'banner',weeks:4,fee:2000,feePaid:true,status:'live',hue:'#E39A1B',created:now-9*DAY},
  {id:uid('a'),userId:'u8',business:'FreshBite Cloud Kitchen',title:'Home style tiffin, lunch and dinner',body:'Weekly menu on WhatsApp. Free delivery inside the society.',category:'Food',contact:'98765 00009',price:'From ₹120 per meal',type:'banner',weeks:2,fee:1000,feePaid:true,status:'live',hue:'#2FA39B',created:now-5*DAY},
  {id:uid('a'),userId:'u14',business:'GreenLeaf Pharmacy',title:'Free home delivery for medicines',body:'Order before 6 pm for same day delivery. Senior citizens get 10 percent off.',category:'Health',contact:'98765 00015',price:'',type:'banner',weeks:4,fee:2000,feePaid:true,status:'live',hue:'#2B6CB0',created:now-3*DAY},
  {id:uid('a'),userId:'u6',business:'',title:'Dining table, 6 seater, teak',body:'Two years old, very good condition. Pickup from Tower D.',category:'Buy and Sell',contact:'98765 00007',price:'₹14,000',type:'classified',weeks:0,fee:0,feePaid:true,status:'live',hue:'#C77A0A',created:now-2*DAY},
  {id:uid('a'),userId:'u10',business:'',title:'2 BHK for rent in Tower C, 9th floor',body:'Semi furnished, east facing, available from next month.',category:'Real Estate',contact:'98765 00011',price:'₹22,000 per month',type:'classified',weeks:0,fee:0,feePaid:true,status:'live',hue:'#6B4FBB',created:now-DAY},
  {id:uid('a'),userId:'u16',business:'Glow Salon and Spa',title:'Festive offer on bridal and party makeup',body:'Home visits available inside the society.',category:'Beauty',contact:'98765 00017',price:'',type:'banner',weeks:1,fee:500,feePaid:false,status:'pending',hue:'#C23B3B',created:now-4*3600e3}
 ];
 const polls=[
  {id:uid('p'),question:'Should we install solar panels on the Tower roofs?',options:[{t:'Yes, go ahead'},{t:'Yes, but after the AGM discussion'},{t:'No'}],votes:{},closes:at(12,23),status:'open',by:'Committee'},
  {id:uid('p'),question:'Preferred time for the weekly yoga class',options:[{t:'5:30 am'},{t:'6:30 am'},{t:'7:30 am'}],votes:{},closes:at(-5,23),status:'closed',by:'Committee'}
 ];
 polls.forEach(p=>users.filter(u=>u.status==='approved'&&u.id!=='u0').forEach(u=>{if(r()<.55)p.votes[flatKey(u)]=Math.floor(r()*p.options.length)}));
 const docs=[
  {id:uid('d'),title:'Society Bye-laws',type:'Bye-laws',date:at(-400,0),desc:'Registered bye-laws including rules for renovation, pets, parking and common areas.',link:''},
  {id:uid('d'),title:'AGM 2025 Minutes',type:'Minutes',date:at(-330,0),desc:'Resolutions passed in the last annual general meeting.',link:''},
  {id:uid('d'),title:'Audited Accounts 2025 to 2026',type:'Audit',date:at(-60,0),desc:'Statement of income and expenditure, balance sheet and auditor remarks.',link:''},
  {id:uid('d'),title:'Proxy form for AGM',type:'Forms',date:at(-3,0),desc:'Fill and hand over to the office before the meeting.',link:''},
  {id:uid('d'),title:'Renovation permission form',type:'Forms',date:at(-120,0),desc:'Needed before starting any interior work. Timings are 9 am to 5 pm on weekdays.',link:''},
  {id:uid('d'),title:'Fire safety and evacuation plan',type:'Circulars',date:at(-90,0),desc:'Assembly points, extinguisher locations and emergency contacts for every tower.',link:''}
 ];
 const contacts=[
  {id:uid('t'),name:'Police',role:'Emergency',phone:'100',cat:'Emergency'},{id:uid('t'),name:'Fire brigade',role:'Emergency',phone:'101',cat:'Emergency'},{id:uid('t'),name:'Ambulance',role:'Emergency',phone:'102',cat:'Emergency'},{id:uid('t'),name:'Women helpline',role:'Emergency',phone:'1091',cat:'Emergency'},
  {id:uid('t'),name:'Main Gate Security',role:'24 x 7 desk (demo number)',phone:'9876543210',cat:'Society'},{id:uid('t'),name:'Society Office',role:'10 am to 6 pm (demo number)',phone:'9876543211',cat:'Society'},
  {id:uid('t'),name:'Mr. Biswas',role:'Plumber (demo number)',phone:'9876543212',cat:'Services'},{id:uid('t'),name:'Rafiq Electricals',role:'Electrician (demo number)',phone:'9876543213',cat:'Services'},{id:uid('t'),name:'Lift Care Service',role:'Lift AMC (demo number)',phone:'9876543214',cat:'Services'},{id:uid('t'),name:'CleanPro',role:'Housekeeping agency (demo number)',phone:'9876543215',cat:'Services'}
 ];
 const entries=[];
 months.forEach((m,i)=>{const d=k=>new Date(+m.split('-')[0],+m.split('-')[1]-1,k).toISOString();
  [['Salaries','Security and housekeeping staff',62000+Math.floor(r()*2000)],['Electricity','Common area electricity',26000+Math.floor(r()*6000)],['Lift AMC','Quarterly lift maintenance',9500],['Water','Tanker and treatment',10500+Math.floor(r()*2500)],['Garden','Gardener and supplies',4500],['Repairs','Plumbing and electrical repairs',3000+Math.floor(r()*9000)]].forEach(([c,t,a],j)=>entries.push({id:uid('x'),date:d(3+j*4),category:c,desc:t,amount:a,type:'expense'}));
  entries.push({id:uid('x'),date:d(11),category:'Hall rent',desc:'Banquet hall bookings',amount:3000+Math.floor(r()*6000),type:'income'})});
 const entriesDone=entries.filter(e=>+D(e.date)<=now);
 return{v:1,settings,users,notices,events,bills,schedule,amenities,bookings,complaints,ads,polls,docs,contacts,entries:entriesDone,visitors:[{id:uid('v'),userId:'u0',flat:users[0].tower+'-'+users[0].flat,name:'Amit (Amazon delivery)',phone:'9876512345',purpose:'Delivery',vehicle:'',photo:'',date:new Date(now-4*60e3).toISOString(),code:'',status:'waiting',by:'g1',byName:'Ramesh Yadav'},{id:uid('v'),userId:'u0',name:'Ravi (electrician)',purpose:'Repair visit',date:at(1,0),code:'482913',status:'expected'}],notifs:[{id:uid('n'),to:'admin',text:'New registration request from Neha Bansal (B-704)',link:'members',at:now-DAY,read:[]},{id:uid('n'),to:'admin',text:'New registration request from Imran Sheikh (C-305)',link:'members',at:now-3600e3*3,read:[]}],log:[{t:'Demo data loaded',at:now}]};
}
