import {sameOrigin,ApiError} from '@/lib/server-store';
import {authenticated,readDocument,storeError,privateHeaders,apiFailure} from '@/lib/supabase-store';
import {extra,digest} from '@/lib/models';
import {sniff} from '@/lib/receipts';
export const dynamic='force-dynamic';
const bucket='poketra-receipts';
export async function GET(request:Request){try{
  const {client,owner}=await authenticated(),id=new URL(request.url).searchParams.get('id');
  const {data:file,error}=await client.from('poketra_files').select('object_key,mime,name').eq('owner_id',owner).eq('id',id).maybeSingle();
  if(error)storeError(error);if(!file)throw new ApiError(404,'Justificatif en attente.');
  const {data:object,error:failed}=await client.storage.from(bucket).createSignedUrl(file.object_key,60);
  if(failed||!object)throw new ApiError(503,'Fichier temporairement indisponible.');
  return new Response(null,{status:302,headers:{...privateHeaders,Location:object.signedUrl}});
}catch(e){return apiFailure(e);}}
export async function POST(request:Request){try{
  sameOrigin(request);const {client,owner}=await authenticated();
  const input=await request.json() as {id:string;prepare?:boolean;complete?:boolean};
  const remote=await readDocument(client,owner),a=remote.state?extra(remote.state).attachments.find(a=>a.id===input.id&&!a.removed):undefined;
  if(!a)throw new ApiError(409,'La transaction doit être synchronisée avant le justificatif.');
  const key=owner+'/'+a.id+'/'+a.digest;
  const {data:existing,error:lookup}=await client.from('poketra_files').select('digest').eq('owner_id',owner).eq('id',a.id).maybeSingle();
  if(lookup)storeError(lookup);
  if(existing){if(existing.digest!==a.digest)throw new ApiError(409,'Un justificatif différent porte cet identifiant.');return Response.json({saved:true,id:a.id},{headers:privateHeaders});}
  if(input.prepare){
    const {data,error}=await client.storage.from(bucket).createSignedUploadUrl(key);
    if(error||!data)throw new ApiError(503,'Envoi du fichier temporairement indisponible.');
    return Response.json({uploadUrl:data.signedUrl},{headers:privateHeaders});
  }
  if(!input.complete)throw new ApiError(400,'Commande invalide.');
  const {data:object,error:missing}=await client.storage.from(bucket).download(key);
  if(missing||!object)throw new ApiError(409,'Le fichier est encore en attente.');
  const bytes=new Uint8Array(await object.arrayBuffer());
  if(bytes.length!==a.size||sniff(bytes)!==a.mime||await digest(bytes)!==a.digest)throw new ApiError(400,'Le fichier ne correspond pas au justificatif.');
  const {error}=await client.from('poketra_files').insert({owner_id:owner,id:a.id,object_key:key,digest:a.digest,name:a.name,mime:a.mime,size:a.size,operation_id:a.operationId,created_at:a.createdAt});
  if(error&&error.code!=='23505')storeError(error);
  return Response.json({saved:true,id:a.id},{headers:privateHeaders});
}catch(e){return apiFailure(e);}}
