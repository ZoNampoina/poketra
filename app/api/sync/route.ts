import {sameOrigin} from '@/lib/server-store';
import {authenticated,readDocument,saveDocument,privateHeaders,apiFailure} from '@/lib/supabase-store';
export const dynamic='force-dynamic';
export async function GET(){try{const {client,owner}=await authenticated();return Response.json(await readDocument(client,owner),{headers:privateHeaders});}catch(e){return apiFailure(e);}}
export async function POST(request:Request){try{sameOrigin(request);const {client}=await authenticated();const result=await saveDocument(client,await request.json());return Response.json(result,{status:result.conflict?409:200,headers:privateHeaders});}catch(e){return apiFailure(e);}}
