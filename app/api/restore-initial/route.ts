import * as F from '@/lib/finance';
import {canonical} from '@/lib/models';
import {sameOrigin,ApiError} from '@/lib/server-store';
import {authenticated,storeError,privateHeaders,apiFailure} from '@/lib/supabase-store';
export const dynamic='force-dynamic';

/**
 * Reconstitution explicite d'un journal personnel.
 * Autorisée uniquement pour remplacer une version serveur contenant UN SEUL
 * solde initial, archivée en snapshot par la fonction SQL transactionnelle.
 * Un journal contenant au moins une vraie opération reste immuable.
 */
export async function POST(request:Request){
  try{
    sameOrigin(request);
    const {client}=await authenticated();
    const raw=await request.json() as {
      mutationId?:string;expectedRemote?:number;state?:F.State;
      confirmation?:string;
    };
    if(raw?.confirmation!=='restore-initial-only'||
      !raw.mutationId||!/^[a-f0-9-]{36}$/i.test(raw.mutationId)||
      !Number.isSafeInteger(raw.expectedRemote)||Number(raw.expectedRemote)<0||
      !raw.state||typeof raw.state!=='object')
      throw new ApiError(400,'Confirmation de restauration manquante ou invalide.');
    F.validateState(raw.state);
    if(new TextEncoder().encode(canonical(raw.state)).length>10_000_000)
      throw new ApiError(413,'La sauvegarde est trop volumineuse.');
    const {data,error}=await client.rpc('poketra_restore_initial_document',{
      p_mutation:raw.mutationId,p_expected:raw.expectedRemote,p_state:raw.state
    });
    if(error)storeError(error);
    return Response.json(data,{status:data?.conflict?409:200,headers:privateHeaders});
  }catch(e){return apiFailure(e);}
}
