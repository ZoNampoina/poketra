import {ApiError} from '@/lib/server-store';
import {authenticated,readDocument,storeError,privateHeaders,apiFailure} from '@/lib/supabase-store';
import {extra,digest} from '@/lib/models';
import {toBase64} from '@/lib/vault';
import {validateState} from '@/lib/finance';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const {client,owner}=await authenticated(),url=new URL(request.url),revision=url.searchParams.get('revision');
  if(url.searchParams.get('list')==='1'){
    const {data,error}=await client.from('poketra_snapshots').select('revision,created_at').eq('owner_id',owner).order('revision',{ascending:false}).limit(30);
    if(error)storeError(error);return Response.json({snapshots:data},{headers:privateHeaders});
  }
  let state=(await readDocument(client,owner)).state;
  if(revision){
    if(!/^\d+$/.test(revision))throw new ApiError(400,'Révision invalide.');
    const {data,error}=await client.from('poketra_snapshots').select('state').eq('owner_id',owner).eq('revision',Number(revision)).maybeSingle();
    if(error)storeError(error);if(!data)throw new ApiError(404,'Version serveur introuvable.');state=data.state;
  }
  if(!state)throw new ApiError(404,'Aucune sauvegarde serveur confirmée.');validateState(state);
  const files:Record<string,unknown>={};
  for(const a of extra(state).attachments){
    const {data:file,error}=await client.from('poketra_files').select('object_key').eq('owner_id',owner).eq('id',a.id).eq('digest',a.digest).maybeSingle();
    if(error)storeError(error);if(!file){if(a.removed)continue;throw new ApiError(409,'Un justificatif est en attente. La sauvegarde locale protège la version complète.');}
    const {data:object,error:missing}=await client.storage.from('poketra-receipts').download(file.object_key);
    if(missing||!object)throw new ApiError(503,'Un fichier est temporairement indisponible.');
    const bytes=new Uint8Array(await object.arrayBuffer());if(await digest(bytes)!==a.digest)throw new ApiError(503,'Empreinte de fichier incorrecte.');
    files[a.id]={base64:toBase64(bytes),mime:a.mime,digest:a.digest,uploaded:true};
  }
  return new Response(JSON.stringify({format:'poketra-backup',backupVersion:2,exportedAt:new Date().toISOString(),state,files}),{headers:{...privateHeaders,'Content-Type':'application/json','Content-Disposition':'attachment; filename="poketra-sauvegarde-serveur.json"'}});
}catch(e){return apiFailure(e);}}
