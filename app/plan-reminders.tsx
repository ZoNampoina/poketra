'use client';
import {useEffect,useState} from 'react';
import {Bell} from 'lucide-react';
import type {Obligation} from '@/lib/finance';

async function api(method:string,body?:unknown){
  const response=await fetch('/api/reminders',{method,cache:'no-store',credentials:'same-origin',
    headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const result=await response.json() as {key?:string;error?:string};
  if(!response.ok)throw new Error(result.error??'Connexion au service de rappels impossible.');
  return result;
}
export function NotificationSettings({demo}:{demo:boolean}){
  const [supported,setSupported]=useState(false),[active,setActive]=useState(false),[working,setWorking]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const available='Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(available);
    if(available&&!demo)void navigator.serviceWorker.getRegistration().then(r=>r?.pushManager.getSubscription()).then(s=>setActive(!!s&&localStorage.getItem('poketra-push-enabled')==='1')).catch(()=>{});
  },[demo]);
  async function toggle(){
    setWorking(true);setMessage('');
    try{
      if(!active && Notification.permission!=='granted' && await Notification.requestPermission()!=='granted')throw new Error('Pour recevoir les notifications, autorise-les dans les réglages du navigateur.');
      const registration=await navigator.serviceWorker.getRegistration();
      if(!registration?.active)throw new Error('L’installation des rappels est en cours. Réessaie après le chargement.');
      let subscription=await registration.pushManager.getSubscription();
      if(active){
        if(subscription){await api('DELETE',{endpoint:subscription.endpoint});await subscription.unsubscribe();}
        localStorage.removeItem('poketra-push-enabled');setActive(false);
      }else{
        const {key}=await api('GET');
        if(!key)throw new Error('Le service de rappels est indisponible.');
        const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
        subscription??=await registration.pushManager.subscribe({applicationServerKey:bytes,userVisibleOnly:true});
        await api('POST',subscription.toJSON());localStorage.setItem('poketra-push-enabled','1');setActive(true);
      }
    }catch(ex){setMessage((ex as Error).message);}
    finally{setWorking(false);}
  }
  if(demo)return null;
  return <section className="plan-notifications"><Bell size={19}/><div><strong>Rappels sur cet appareil</strong>
    <small>{active?'Notifications activées':supported?'Avec ton compte connecté, Poketra peut te prévenir même une fois fermé.':'Les rappels sont disponibles dans la cloche de Poketra.'}</small>
    {message&&<small role="alert">{message}</small>}</div>
    {supported&&<button type="button" className="button secondary" disabled={working} onClick={()=>void toggle()}>{working?'En cours…':active?'Désactiver':'Activer'}</button>}
  </section>;
}

export type ReminderIntent={plan:string;occurrence:string;at:string;action:'open'|'confirm'|'snooze';signature?:string};
export async function readReminderIntent(token:string):Promise<ReminderIntent|undefined>{
  if(!/^[0-9a-f-]{36}$/i.test(token)||!('caches' in window))return;
  const cache=await caches.open('pk-reminder-clicks'),key='/__reminder_click__/'+token;
  const response=await cache.match(key);
  if(!response)return;
  await cache.delete(key);
  const item=await response.json() as ReminderIntent & {created:number};
  if(!item||typeof item.plan!=='string'||typeof item.occurrence!=='string'||!Number.isFinite(Date.parse(item.at))||
    !Number.isFinite(item.created)||Date.now()-item.created>86400000||!['confirm','snooze','open'].includes(item.action))return;
  return item;
}
export async function planSignature(o:Obligation){
  const value=JSON.stringify([o.amount,!!o.variableAmount,o.walletId??'',o.projectId??'',o.categoryId,!!o.useAvailable,o.name,o.direction??'expense',o.beneficiary??'']);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
