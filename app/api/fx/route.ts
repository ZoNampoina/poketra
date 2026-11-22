import {currencySupported} from '@/lib/currency';
export const dynamic='force-dynamic';

export async function GET(request:Request) {
  const url=new URL(request.url);
  const from=url.searchParams.get('from')??'';
  const to=url.searchParams.get('to')??'';
  if(!currencySupported(from)||!currencySupported(to)){
    return Response.json({error:'Devise non prise en charge.'},{status:400,headers:{'Cache-Control':'no-store'}});
  }
  if(from===to)return Response.json({base:from,quote:to,rate:1,date:new Date().toISOString().slice(0,10),provider:'identique'});
  try{
    const response=await fetch('https://api.frankfurter.dev/v2/rate/'+from+'/'+to,{
      headers:{'Accept':'application/json'},next:{revalidate:3600},signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw new Error('Source indisponible');
    const data:unknown=await response.json();
    if(!data||typeof data!=='object')throw new Error('Format de taux invalide');
    const record=data as {rate?:unknown;date?:unknown;base?:unknown;quote?:unknown};
    if(typeof record.rate!=='number'||!Number.isFinite(record.rate)||record.rate<=0||
      typeof record.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.date)||
      record.base!==from||record.quote!==to)throw new Error('Réponse incohérente');
    return Response.json({base:from,quote:to,rate:record.rate,date:record.date,provider:'Frankfurter'},{
      headers:{'Cache-Control':'public, max-age=300, s-maxage=3600'}
    });
  }catch{
    return Response.json({error:'Taux indisponible. Tu peux saisir un taux manuel pour continuer hors connexion.'},{
      status:503,headers:{'Cache-Control':'no-store'}
    });
  }
}
