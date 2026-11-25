import {authenticated,apiFailure,privateHeaders,storeError} from '@/lib/supabase-store';
import {sameOrigin,ApiError} from '@/lib/server-store';
import {trustedPushEndpoint,validPushKeys} from '@/lib/push-subscription';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const {client}=await authenticated();
    const {data,error}=await client.from('poketra_push_config').select('vapid_public').single();
    if(error)storeError(error);
    if(!data?.vapid_public)throw new ApiError(503,'Le service de rappels démarre. Réessaie dans une minute.');
    return Response.json({key:data.vapid_public},{headers:privateHeaders});
  }catch(e){return apiFailure(e);}
}
export async function POST(request:Request){
  try{
    sameOrigin(request);
    const {client,owner}=await authenticated(),input=await request.json();
    if(!trustedPushEndpoint(input?.endpoint)||!validPushKeys(input?.keys))throw new ApiError(400,'Abonnement aux notifications invalide.');
    const {error}=await client.from('poketra_push_devices').upsert({owner_id:owner,endpoint:input.endpoint,keys:input.keys},{onConflict:'owner_id,endpoint'});
    if(error)storeError(error);
    return Response.json({ok:true},{headers:privateHeaders});
  }catch(e){return apiFailure(e);}
}
export async function DELETE(request:Request){
  try{
    sameOrigin(request);const {client,owner}=await authenticated(),input=await request.json();
    if(!trustedPushEndpoint(input?.endpoint))throw new ApiError(400,'Appareil inconnu.');
    const {error}=await client.from('poketra_push_devices').delete().eq('owner_id',owner).eq('endpoint',input.endpoint);
    if(error)storeError(error);
    return Response.json({ok:true},{headers:privateHeaders});
  }catch(e){return apiFailure(e);}
}
