// Replace syncReceipts in the existing lib/receipts.ts; retain its other functions and imports.
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
