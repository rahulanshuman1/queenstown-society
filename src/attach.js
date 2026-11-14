/* ========== file attachments for notices and events ==========
   Admin picks a file in the notice or event form. With a server (REMOTE) the file is uploaded to the API and the notice keeps
   only a small description of it. In the offline demo the file stays inside the browser data.
   Residents see a card with Preview and Download. PDFs are drawn page by page, so previews work in the Android app too. */
const ATT_MAX=5*1024*1024,ATT_EXT=['pdf','png','jpg','jpeg','webp','doc','docx','xls','xlsx'];
const ATT_ACCEPT='.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*';
const ATT_MIME={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const attKind=a=>a.mime==='application/pdf'?'PDF':/^image\//.test(a.mime)?'Image':/word/.test(a.mime)?'Word':/sheet|excel/.test(a.mime)?'Excel':'File';
const attCanView=a=>a.mime==='application/pdf'||/^image\//.test(a.mime);
const fmtSize=n=>n<1024?n+' B':n<1048576?Math.round(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';
const attCard=(a,kind,id)=>`<div class="attcard"><span class="atti">${ic(/^image\//.test(a.mime)?'eye':'file')}</span><div class="attm"><b>${esc(a.name)}</b><small>${attKind(a)} · ${fmtSize(a.size||0)}</small></div>${kind?`<div class="attb">${attCanView(a)?btn('Preview','att-view',{sm:1,i:'eye',d:{k:kind,id}}):''}${btn('Download','att-dl',{sm:1,c:'pri',i:'download',d:{k:kind,id}})}</div>`:''}</div>`;
const attBlock=(a,kind,id)=>`<div class="stack" style="gap:6px"><small><b>${kind==='event'?'Event details':'Attached file'}</b></small>${attCard(a,kind,id)}</div>`;
const attachField=(id,att,label='Attach a file (optional)')=>`<label class="fld full"><span>${label}</span><input type="file" id="${id}" accept="${ATT_ACCEPT}"><em class="hint">PDF, image, Word or Excel, up to 5 MB. Residents can preview and download it.</em></label>${att?`<div class="full attrow">${attCard(att)}<label class="chk"><input type="checkbox" id="${id}_rm" name="${id}_rm">Remove the current file</label></div>`:''}`;
const attOf=d=>((d.k==='event'?DB.events:DB.notices).find(x=>x.id===d.id)||{}).attachment;

const fileToDataUrl=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('Could not read that file.'));r.readAsDataURL(f)});
/* Returns the attachment the notice or event should have after saving: the new file, the current one, or null. */
async function pickAttachment(form,id,cur,remove){
 const el=$('#'+id,form),file=el&&el.files&&el.files[0];
 if(!file)return remove?null:(cur||null);
 const ext=(file.name.split('.').pop()||'').toLowerCase();
 if(!ATT_EXT.includes(ext))throw new Error('Choose a PDF, image, Word or Excel file.');
 if(file.size>ATT_MAX)throw new Error('That file is larger than 5 MB.');
 if(!file.size)throw new Error('That file is empty.');
 toast('Uploading '+file.name+'…','info');
 const url=await fileToDataUrl(file);
 if(REMOTE){
  try{const r=await api('/api/files',{method:'POST',body:{name:file.name,data:url.slice(url.indexOf(',')+1)}});return r.file}
  catch(e){throw new Error(e.net?e.message:'The file was not uploaded. '+e.message)}
 }
 if(file.size>1.2*1024*1024)throw new Error('In demo mode files are limited to 1 MB. Connect the server for 5 MB files.');
 return{id:uid('f'),name:file.name,mime:ATT_MIME[ext],size:file.size,local:url};
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
ACT['att-view']=async d=>{
 const a=attOf(d);if(!a)return;
 modal(esc(a.name),`<div class="stack"><div class="attview" id="attview"><div class="boot" style="min-height:220px"><div class="spin"></div><small>Opening…</small></div></div><div class="row wrap-r">${btn('Back','att-back',{i:'arrow',d})}<span class="sp"></span>${btn('Download','att-dl',{c:'pri',i:'download',d})}</div></div>`,{wide:1,sub:attKind(a)+' · '+fmtSize(a.size||0)});
 const box=$('#attview');
 try{
  const url=await attUrl(a,false);
  if(!box||!box.isConnected)return;
  if(/^image\//.test(a.mime))box.innerHTML=`<img class="attimg" src="${esc(url)}" alt="${esc(a.name)}">`;
  else if(a.mime==='application/pdf')await drawPdf(box,url);
  else box.innerHTML=`<p class="muted" style="padding:24px;text-align:center">A preview is not available for this type of file. Download it to open it.</p>`;
 }catch(e){if(box&&box.isConnected)box.innerHTML=`<p class="muted" style="padding:24px;text-align:center">${esc(e.message||'The preview could not be shown.')} You can still download the file.</p>`}
};
ACT['att-back']=d=>ACT[d.k==='event'?'event-open':'notice-open']({id:d.id});
