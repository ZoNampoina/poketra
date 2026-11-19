import type {SupabaseClient} from '@supabase/supabase-js';
import * as F from './finance';
import {canonical} from './models';
import {ApiError} from './server-store';
import {supabaseServer} from './supabase-server';
export async function authenticated() {
  const client=await supabaseServer();
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user)throw new ApiError(401,'Connecte-toi dans Sécurité & sauvegardes pour synchroniser ton compte.');
  const {data:access,error:denied}=await client.from('poketra_access').select('owner_id').eq('owner_id',user.id).maybeSingle();
  if(denied)throw new ApiError(503,'La vérification du compte est temporairement indisponible.');
  if(!access)throw new ApiError(403,'Ce compte ne dispose pas de cet espace Poketra.');
  return {client,owner:user.id,user};
}
export function storeError(error:{code?:string;message?:string}):never {
  const status=error.code==='42501'?403:['23505','23514'].includes(error.code??'')?409:error.code==='22023'?400:503;
  throw new ApiError(status,status===503?'Sauvegarde serveur temporairement indisponible. Données locales conservées.':error.message??'Commande refusée.');
}
export async function readDocument(client:SupabaseClient,owner:string) {
  const {data,error}=await client.from('poketra_documents').select('revision,state,last_mutation,updated_at').eq('owner_id',owner).maybeSingle();
  if(error)storeError(error);
  if(data?.state)F.validateState(data.state);
  return {ownerId:owner,revision:data?.revision??0,state:(data?.state??null) as F.State|null,updatedAt:data?.updated_at??'',mutationId:data?.last_mutation};
}
export async function saveDocument(client:SupabaseClient,input:{mutationId:string;expectedRemote:number;state:F.State}) {
  if(!input||!/^[a-f0-9-]{36}$/i.test(input.mutationId)||!Number.isSafeInteger(input.expectedRemote)||input.expectedRemote<0)throw new ApiError(400,'Commande invalide.');
  F.validateState(input.state);
  if(new TextEncoder().encode(canonical(input.state)).length>10_000_000)throw new ApiError(413,'La sauvegarde est trop volumineuse.');
  const {data,error}=await client.rpc('poketra_save_document',{p_mutation:input.mutationId,p_expected:input.expectedRemote,p_state:input.state});
  if(error)storeError(error);
  return data as {conflict?:boolean;revision:number;state:F.State;ownerId:string;updatedAt:string};
}
export const privateHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
export function apiFailure(e:unknown) {
  return Response.json({error:e instanceof ApiError?e.message:'Service temporairement indisponible. Données locales conservées.'},{status:e instanceof ApiError?e.status:503,headers:privateHeaders});
}
