import type {State} from './finance';
import {extra,patchExtra,digest,type Attachment} from './models';
import {readKV,writeKV,parseBackup,exportBackup} from './storage';
import {toBase64,fromBase64} from './vault';
export type ReceiptData={base64:string;mime:string;digest:string;uploaded?:boolean};
export function sniff(bytes:Uint8Array):string|null{if(bytes[0]===255&&bytes[1]===216)return'image/jpeg';if(bytes[0]===137&&String.fromCharCode(...bytes.slice(1,4))==='PNG')return'image/png';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return'image/webp';if(String.fromCharCode(...bytes.slice(0,5))==='%PDF-')return'application/pdf';return null;}
export async function prepareReceipt(file:File,operationId:string){if(file.size>15_000_000)throw new Error('Choisis un fichier de moins de 15 Mo.');let bytes=new Uint8Array(await file.arrayBuffer()),mime=sniff(bytes);if(!mime)throw new Error('Formats acceptés : photo JPEG, PNG, WebP ou PDF.');
 if(mime.startsWith('image/')&&typeof createImageBitmap==='function'){const bitmap=await createImageBitmap(new Blob([bytes],{type:mime}));const ratio=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Compression image indisponible.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Compression impossible.')),'image/jpeg',.87));bytes=new Uint8Array(await blob.arrayBuffer());mime='image/jpeg';}
 if(bytes.length>6_000_000)throw new Error('Le justificatif doit faire moins de 6 Mo après compression.');const hash=await digest(bytes),id=crypto.randomUUID();const metadata:Attachment={id,operationId,name:file.name,mime:mime as Attachment['mime'],size:bytes.length,digest:hash,createdAt:new Date().toISOString()};const data:ReceiptData={base64:toBase64(bytes),mime,digest:hash};await writeKV('receipt:'+id,data);return metadata;
}
export function attach(s:State,metadata:Attachment):State{return patchExtra(s,{attachments:[...extra(s).attachments,metadata]});}
export async function receiptData(s:State,id:string):Promise<ReceiptData>{const a=extra(s).attachments.find(a=>a.id===id);if(!a)throw new Error('Justificatif introuvable.');let data=await readKV<ReceiptData>('receipt:'+id);if(!data){const response=await fetch('/api/receipts?id='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Le justificatif n’est pas disponible localement. Reconnecte-toi pour le récupérer.');const bytes=new Uint8Array(await response.arrayBuffer());data={base64:toBase64(bytes),mime:a.mime,digest:await digest(bytes),uploaded:true};if(data.digest!==a.digest)throw new Error('Le justificatif ne correspond pas à son empreinte.');await writeKV('receipt:'+id,data);}if(await digest(fromBase64(data.base64))!==a.digest)throw new Error('Justificatif endommagé.');return data;}
export async function syncReceipts(s:State){
 for(const a of extra(s).attachments.filter(a=>!a.removed)){
  const data=await readKV<ReceiptData>('receipt:'+a.id);if(!data||data.uploaded)continue;
  const post=(body:object)=>fetch('/api/receipts',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const prepared=await post({id:a.id,prepare:true});if(!prepared.ok)throw new Error('Un justificatif reste en attente de synchronisation.');
  const target=await prepared.json() as {saved?:boolean;uploadUrl?:string};
  if(!target.saved){
   if(!target.uploadUrl)throw new Error('Autorisation de fichier indisponible.');
   const upload=await fetch(target.uploadUrl,{method:'PUT',headers:{'Content-Type':a.mime,'x-upsert':'false'},body:new Blob([fromBase64(data.base64)],{type:a.mime})});
   if(!upload.ok&&upload.status!==409&&upload.status!==400)throw new Error('Envoi interrompu. Le justificatif local est conservé.');
   const ack=await post({id:a.id,complete:true});if(!ack.ok)throw new Error('Le justificatif reste en attente de confirmation.');
  }
  await writeKV('receipt:'+a.id,{...data,uploaded:true});
 }
}

export async function fullBackup(s:State){const base=JSON.parse(exportBackup(s)),files:Record<string,ReceiptData>={};for(const a of extra(s).attachments){try{files[a.id]=await receiptData(s,a.id);}catch(e){if(!a.removed)throw e;}}return JSON.stringify({...base,backupVersion:2,files},null,2);}
export async function validatePortableBackup(text:string){const state=parseBackup(text),raw=JSON.parse(text),files:Record<string,ReceiptData>=raw.files??{};for(const a of extra(state).attachments.filter(a=>!a.removed)){const data=files[a.id];if(!data||sniff(fromBase64(data.base64))!==a.mime||await digest(fromBase64(data.base64))!==a.digest)throw new Error('La sauvegarde est incomplète ou un justificatif est endommagé.');}return{state,files};}
export async function stageBackupFiles(files:Record<string,ReceiptData>){for(const [id,value]of Object.entries(files)){const current=await readKV<ReceiptData>('receipt:'+id);if(current&&current.digest!==value.digest)throw new Error('Un justificatif existant a le même identifiant avec un contenu différent.');if(!current)await writeKV('receipt:'+id,{...value,uploaded:false});}}
