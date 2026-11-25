import {createClient} from 'npm:@supabase/supabase-js@2.119.1';
import webpush from 'npm:web-push@3.6.7';
import {trustedPushEndpoint,validPushKeys} from '../../../lib/push-subscription.ts';

type Plan={id:string;name:string;amount:number;walletId?:string;projectId?:string;categoryId:string;useAvailable?:boolean;variableAmount?:boolean;direction?:string;beneficiary?:string};
type Job={delivery:string;attempt:number;device:string;endpoint:string;keys:{auth:string;p256dh:string};plan:Plan;occurrence:string;due_at:string;hide_amounts:boolean};
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
async function config(){
  const {data,error}=await db.from('poketra_push_config').select('dispatch_secret,vapid_public,vapid_private').single();
  if(error||!data)throw new Error('config');
  return data;
}
async function deliver(job:Job,publicKey:string,privateKey:string){
  let status=0;
  try{
    if(!trustedPushEndpoint(job.endpoint)||!validPushKeys(job.keys))status=410;
    else{
      const p=job.plan,incoming=p.direction==='income';
      const fields=[p.amount,!!p.variableAmount,p.walletId??'',p.projectId??'',p.categoryId,!!p.useAvailable,p.name,p.direction??'expense',p.beneficiary??''];
      const hashed=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(fields))));
      const signature=Array.from(hashed,b=>b.toString(16).padStart(2,'0')).join('');
      const date=new Date(job.due_at).toISOString();
      const title=job.hide_amounts?'Rappel Poketra':incoming?'Entrée prévue':'Dépense prévue';
      const body=job.hide_amounts?'Un programme attend ta validation.':p.name.slice(0,100)+' · '+(p.variableAmount?'Montant à préciser':new Intl.NumberFormat('fr-FR').format(p.amount)+' Ar');
      const payload={type:'poketra-plan',plan:p.id,occurrence:job.occurrence,at:date,signature,title,body,quick:!!p.walletId&&!p.variableAmount&&!job.hide_amounts};
      const request=webpush.generateRequestDetails({endpoint:job.endpoint,keys:job.keys},JSON.stringify(payload),{
        TTL:86400,urgency:'normal',vapidDetails:{subject:'https://poketra-rho.vercel.app',publicKey,privateKey}
      });
      const reply=await fetch(job.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(10000)});
      status=reply.status;await reply.body?.cancel();
    }
  }catch{/* The lease permits a later retry if encryption or the push service fails. */}
  if(status===404||status===410){
    const {error}=await db.from('poketra_push_devices').delete().eq('id',job.device);
    if(error)throw error;
  }else{
    const sent=status>=200&&status<300,delay=Math.min(60,2**Math.min(job.attempt,6))*60000;
    const update=sent?{sent_at:new Date().toISOString()}:{next_try:new Date(Date.now()+delay).toISOString()};
    const {error}=await db.from('poketra_push_deliveries').update(update).eq('id',job.delivery).eq('attempts',job.attempt);
    if(error)throw error;
  }
}
Deno.serve(async request=>{
  const secret=request.headers.get('x-poketra-dispatch');
  if(request.method!=='POST'||!secret||secret.length!==36)return new Response(null,{status:403});
  try{
    let cfg=await config();
    if(secret!==cfg.dispatch_secret)return new Response(null,{status:403});
    if(!cfg.vapid_public){
      const pair=webpush.generateVAPIDKeys();
      const {error}=await db.from('poketra_push_config').update({vapid_public:pair.publicKey,vapid_private:pair.privateKey}).eq('singleton',true).is('vapid_public',null);
      if(error)throw error;
      cfg=await config();
    }
    const {data,error}=await db.rpc('poketra_claim_reminders');
    if(error)throw error;
    const jobs=(data??[]) as Job[];
    for(let i=0;i<jobs.length;i+=8)await Promise.all(jobs.slice(i,i+8).map(job=>deliver(job,cfg.vapid_public,cfg.vapid_private)));
    return Response.json({processed:jobs.length});
  }catch(error){console.error('Poketra reminders:',error instanceof Error?error.name:'Storage error');return new Response('Service indisponible',{status:503});}
});
