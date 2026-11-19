export const dynamic='force-dynamic';
export async function GET(){return Response.json({version:'1.1.1',ready:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY),offline:true},{headers:{'Cache-Control':'no-store'}});}
