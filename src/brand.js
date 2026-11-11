/* ========== Queenstown brand: animated logo, splash screen, "get the Android app" ========== */
Object.assign(IP,{
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
const appCard=()=>canOfferApp()?`<div class="card flat appcard"><span class="ai">${ic('app')}</span><div class="sp"><b>Get the Android app</b><br><small>Pay bills, read notices and see events from your home screen.</small></div><button type="button" class="btn sm pri" data-act="app-dl">${ic('download')}Get the app</button></div>`:'';
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
