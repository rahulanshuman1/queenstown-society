/* ========== file attachments for notices and events ==========
   Admin picks a file in the notice or event form. With a server (REMOTE) the file is uploaded to the API and the notice keeps
   only a small description of it. In the offline demo the file stays inside the browser data.
   Residents see a card with Preview and Download (PDF, images, Word .docx and Excel can be previewed). PDFs are drawn page by page, so previews work in the Android app too. */
const ATT_MAX=5*1024*1024,ATT_EXT=['pdf','png','jpg','jpeg','webp','doc','docx','xls','xlsx'];
const ATT_ACCEPT='.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*';
const ATT_MIME={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const attKind=a=>a.mime==='application/pdf'?'PDF':/^image\//.test(a.mime)?'Image':/word/.test(a.mime)?'Word':/sheet|excel/.test(a.mime)?'Excel':'File';
const attIsDocx=a=>/wordprocessingml/.test(a.mime),attIsSheet=a=>/spreadsheetml|ms-excel/.test(a.mime);
/* PDF, images, .docx and Excel files can be previewed. The old binary .doc format can only be downloaded. */
const attCanView=a=>a.mime==='application/pdf'||/^image\//.test(a.mime)||attIsDocx(a)||attIsSheet(a);
const fmtSize=n=>n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';
const attCard=(a,kind,id)=>`<div class="attcard"><span class="atti">${ic(/^image\//.test(a.mime)?'eye':'file')}</span><div class="attm"><b>${esc(a.name)}</b><small>${attKind(a)} · ${fmtSize(a.size||0)}</small></div>${kind?`<div class="attb">${attCanView(a)?btn('Preview','att-view',{sm:1,i:'eye',d:{k:kind,id}}):''}${btn('Download','att-dl',{sm:1,c:'pri',i:'download',d:{k:kind,id}})}</div>`:''}</div>`;
const attBlock=(a,kind,id)=>`<div class="stack" style="gap:6px"><small><b>${kind==='event'?'Event details':'Attached file'}</b></small>${attCard(a,kind,id)}</div>`;
const attachField=(id,att,label='Attach a file (optional)')=>`<label class="fld full"><span>${label}</span><input type="file" id="${id}" accept="${ATT_ACCEPT}"><em class="hint">PDF, image, Word or Excel, up to 5 MB. Residents can preview and download it. Old .doc files can only be downloaded.</em></label>${att?`<div class="full attrow">${attCard(att)}<label class="chk"><input type="checkbox" id="${id}_rm" name="${id}_rm">Remove the current file</label></div>`:''}`;
const attOf=d=>d.k==='proof'?(DB.users.find(x=>x.id===d.id)||{}).proof:d.k==='ad'?(DB.ads.find(x=>x.id===d.id)||{}).attachment:((d.k==='event'?DB.events:DB.notices).find(x=>x.id===d.id)||{}).attachment;

const fileToDataUrl=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('Could not read that file.'));r.readAsDataURL(f)});
/* Returns the attachment the notice or event should have after saving: the new file, the current one, or null. */
async function pickAttachment(form,id,cur,remove){
 const el=$('#'+id,form),file=el&&el.files&&el.files[0];
 if(!file)return remove?null:(cur||null);
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(!ATT_EXT.includes(ext))throw new Error('Choose a PDF, image, Word or Excel file.');
 if(!file.size)throw new Error('That file is empty.');
 toast('Uploading '+file.name+'…','info');
 /* phone photos are often bigger than the 5 MB limit, so large photos are shrunk first */
 let url=null,name=file.name,e2=ext;
 if(['png','jpg','jpeg','webp'].includes(ext)&&file.size>900*1024){try{url=await readImage(file,1800,.8);name=name.replace(/\.[^.]+$/,'')+'.jpg';e2='jpg'}catch(e){url=null}}
 if(!url){if(file.size>ATT_MAX)throw new Error('That file is larger than 5 MB.');url=await fileToDataUrl(file)}
 const data=url.slice(url.indexOf(',')+1),size=Math.floor(data.length*3/4);
 if(size>ATT_MAX)throw new Error('That file is larger than 5 MB.');
 if(REMOTE){
  try{const r=await api('/api/files',{method:'POST',body:{name,data}});return r.file}
  catch(e){throw new Error(e.net?e.message:'The file was not uploaded. '+e.message)}
 }
 if(size>1.2*1024*1024)throw new Error('In demo mode files are limited to 1 MB. Connect the server for 5 MB files.');
 return{id:uid('f'),name,mime:ATT_MIME[e2],size,local:url};
}

/* address that opens the file: a signed link from the server, or a blob made from the demo data */
async function attUrl(a,dl){
 if(a.local){const b=await (await fetch(a.local)).blob();return URL.createObjectURL(b)}
 const r=await api('/api/files/'+encodeURIComponent(a.id)+'/link',{method:'POST'});
 return API+r.url+(dl?'&dl=1':'');
}
ACT['att-dl']=async d=>{
 const a=attOf(d);if(!a)return;
 try{const url=await attUrl(a,true),el=document.createElement('a');el.href=url;el.rel='noopener';
  if(a.local)el.download=a.name;else if(isNativeApp())el.target='_blank';
  document.body.appendChild(el);el.click();el.remove();toast('Download started','download')}
 catch(e){toast(e.message||'Could not open the file.','x')}
};
let PDFLIB=null;
async function pdfLib(){
 if(PDFLIB)return PDFLIB;
 const base='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
 if(!window.pdfjsLib)await new Promise((ok,no)=>{const s=document.createElement('script');s.src=base+'pdf.min.js';s.onload=ok;s.onerror=()=>no(new Error('The viewer could not load.'));document.head.appendChild(s)});
 const code=await (await fetch(base+'pdf.worker.min.js')).text();
 pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
 return PDFLIB=pdfjsLib;
}
async function drawPdf(box,url){
 const lib=await pdfLib(),buf=await (await fetch(url)).arrayBuffer(),pdf=await lib.getDocument({data:buf}).promise;
 box.innerHTML='';const w=Math.max(260,box.clientWidth-20),dpr=Math.min(2,window.devicePixelRatio||1),n=Math.min(pdf.numPages,40);
 for(let i=1;i<=n;i++){
  if(!box.isConnected)return;
  const pg=await pdf.getPage(i),sc=w/pg.getViewport({scale:1}).width,v=pg.getViewport({scale:sc*dpr}),cv=document.createElement('canvas');
  cv.width=v.width;cv.height=v.height;cv.className='attpage';box.appendChild(cv);
  await pg.render({canvasContext:cv.getContext('2d'),viewport:v}).promise;
 }
 if(pdf.numPages>n)box.insertAdjacentHTML('beforeend',`<p class="muted" style="text-align:center">Showing the first ${n} of ${pdf.numPages} pages. Download the file to read the rest.</p>`);
}
/* Word and Excel previews. The files are turned into plain HTML in the browser and shown in a locked iframe
   (sandbox with no permissions), so nothing inside a document can run code or reach the app. */
const ATT_LIBS={
 mammoth:['https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js','https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.2/mammoth.browser.min.js'],
 XLSX:['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']
};
async function attLoadLib(name){
 if(window[name])return window[name];
 for(const src of ATT_LIBS[name]){
  try{await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>{s.remove();no()};document.head.appendChild(s)});if(window[name])return window[name]}catch(e){}
 }
 throw new Error('The viewer could not load.');
}
const ATT_DOC_CSS='body{font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#fff;margin:0;padding:18px 20px;word-wrap:break-word}img{max-width:100%;height:auto}table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid #c9cfd4;padding:4px 8px;vertical-align:top;font-size:13px}h1,h2,h3{line-height:1.25}h2.sh{font-size:15px;margin:22px 0 6px;color:#0f4c4a}p{margin:0 0 .8em}';
const attFrame=(box,html,name)=>{box.innerHTML=`<iframe class="attframe" sandbox="" title="${esc(name)}" srcdoc="${esc('<!doctype html><meta charset="utf-8"><base target="_blank"><style>'+ATT_DOC_CSS+'</style>'+html)}"></iframe>`};
async function drawDocx(box,url,a){
 const lib=await attLoadLib('mammoth'),buf=await (await fetch(url)).arrayBuffer(),r=await lib.convertToHtml({arrayBuffer:buf});
 if(!box.isConnected)return;
 attFrame(box,r.value||'<p>This document has no text to show.</p>',a.name);
}
async function drawSheet(box,url,a){
 const X=await attLoadLib('XLSX'),buf=await (await fetch(url)).arrayBuffer(),wb=X.read(buf,{type:'array'}),names=wb.SheetNames.slice(0,6);
 if(!box.isConnected)return;
 const parts=names.map(n=>{const ws=wb.Sheets[n];if(ws&&ws['!ref']){const rg=X.utils.decode_range(ws['!ref']);if(rg.e.r>399){rg.e.r=399;ws['!ref']=X.utils.encode_range(rg)}}return(names.length>1?`<h2 class="sh">${esc(n)}</h2>`:'')+X.utils.sheet_to_html(ws,{header:'',footer:''})});
 attFrame(box,parts.join('')+(wb.SheetNames.length>names.length?'<p>More sheets are in the file. Download it to see them.</p>':''),a.name);
}
ACT['att-view']=async d=>{
 const a=attOf(d);if(!a)return;
 modal(esc(a.name),`<div class="stack"><div class="attview" id="attview"><div class="boot" style="min-height:220px"><div class="spin"></div><small>Opening…</small></div></div><div class="row wrap-r">${btn('Back','att-back',{i:'arrow',d})}<span class="sp"></span>${btn('Download','att-dl',{c:'pri',i:'download',d})}</div></div>`,{wide:1,sub:attKind(a)+' · '+fmtSize(a.size||0)});
 const box=$('#attview');
 try{
  const url=await attUrl(a,false);
  if(!box||!box.isConnected)return;
  if(/^image\//.test(a.mime))box.innerHTML=`<img class="attimg" src="${esc(url)}" alt="${esc(a.name)}">`;
  else if(a.mime==='application/pdf')await drawPdf(box,url);
  else if(attIsDocx(a))await drawDocx(box,url,a);
  else if(attIsSheet(a))await drawSheet(box,url,a);
  else box.innerHTML=`<p class="muted" style="padding:24px;text-align:center">A preview is not available for this type of file. Download it to open it.</p>`;
 }catch(e){if(box&&box.isConnected)box.innerHTML=`<p class="muted" style="padding:24px;text-align:center">${esc(e.message||'The preview could not be shown.')} You can still download the file.</p>`}
};
ACT['att-back']=d=>d.k==='proof'||d.k==='ad'?closeModal():ACT[d.k==='event'?'event-open':'notice-open']({id:d.id});
