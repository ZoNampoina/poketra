import {supabaseServer} from '@/lib/supabase-server';
import {authenticated,privateHeaders,apiFailure} from '@/lib/supabase-store';
import {sameOrigin,ApiError} from '@/lib/server-store';
import {trustedPushEndpoint} from '@/lib/push-subscription';
export const dynamic='force-dynamic';
export async function GET(){try{const {user}=await authenticated();return Response.json({email:user.email},{headers:privateHeaders});}catch(e){return apiFailure(e);}}
export async function POST(request:Request){try{
  sameOrigin(request);const input=await request.json() as {action:string;email?:string;password?:string;token?:string;pushEndpoint?:unknown};
  const client=await supabaseServer();
  if(input.action==='logout'){
    if(trustedPushEndpoint(input.pushEndpoint))await client.from('poketra_push_devices').delete().eq('endpoint',input.pushEndpoint);
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw new ApiError(503,'Déconnexion temporairement indisponible.');
    return Response.json({ok:true},{headers:privateHeaders});
  }
  if(input.action==='password'){
    const {error}=await client.auth.signInWithPassword({email:input.email??'',password:input.password??''});
    if(error)throw new ApiError(401,'Connexion refusée. Vérifie ton adresse et ton mot de passe.');
  }else if(input.action==='link'){
    const {error}=await client.auth.signInWithOtp({email:input.email??'',options:{shouldCreateUser:false,emailRedirectTo:new URL('/auth/callback',request.url).toString()}});
    if(error)throw new ApiError(400,'Lien indisponible. Réessaie plus tard ou utilise ton mot de passe.');
    return Response.json({message:'Si cette adresse possède un compte, un lien de connexion lui a été envoyé.'},{headers:privateHeaders});
  }else if(input.action==='verify'){
    const {error}=await client.auth.verifyOtp({email:input.email??'',token:input.token??'',type:'email'});
    if(error)throw new ApiError(401,'Ce code est invalide ou expiré.');
  }else throw new ApiError(400,'Commande invalide.');
  const {user}=await authenticated();return Response.json({email:user.email},{headers:privateHeaders});
}catch(e){return apiFailure(e);}}
