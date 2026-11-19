import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function supabaseServer() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Synchronisation en cours de configuration. Données locales conservées.');
  const jar=await cookies();
  return createServerClient(url,key,{
    cookieOptions:{sameSite:'lax',secure:process.env.NODE_ENV==='production',httpOnly:true},
    cookies:{getAll:()=>jar.getAll(),setAll:values=>{for(const {name,value,options} of values)jar.set(name,value,options);}}
  });
}
