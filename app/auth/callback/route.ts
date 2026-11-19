import {supabaseServer} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const url=new URL(request.url),code=url.searchParams.get('code');
  if(code){const client=await supabaseServer();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return Response.redirect(new URL('/',url.origin));}
  return Response.redirect(new URL('/?connexion=expiree',url.origin));
}
