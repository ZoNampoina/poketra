'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
export default function Account({onSignedIn}:{onSignedIn:()=>Promise<void>}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[account,setAccount]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{void fetch('/api/auth',{cache:'no-store',credentials:'same-origin'}).then(async r=>{if(r.ok){const data=await r.json() as {email?:string};setAccount(data.email??null);}}).catch(()=>{});},[]);
 async function act(action:string){if(busy)return;setBusy(true);setError('');setMessage('');try{
  const registration=action==='logout'?await navigator.serviceWorker?.getRegistration().catch(()=>undefined):undefined;
  const subscription=await registration?.pushManager?.getSubscription().catch(()=>null);
  const r=await fetch('/api/auth',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,password,token,pushEndpoint:subscription?.endpoint})});
  const result=await r.json() as {email?:string;error?:string;message?:string};if(!r.ok)throw new Error(result.error??'Connexion indisponible.');
  setPassword('');setToken('');
  if(action==='logout'){
    localStorage.removeItem('poketra-push-enabled');
    await subscription?.unsubscribe().catch(()=>false);
    if(registration)for(const n of await registration.getNotifications().catch(()=>[]))if(n.data?.plan)n.close();
    setAccount(null);setMessage('Compte déconnecté. Les données de cet appareil restent conservées.');
  }
  else if(result.email){setAccount(result.email);await onSignedIn();setMessage('Compte connecté. Consulte le statut de synchronisation ci-dessous.');}
  else setMessage(result.message??'Vérification terminée.');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="card account-card"><h2><ShieldCheck size={20}/>Mon compte Poketra</h2>{account?<><p className="muted">Connecté : {account}</p><button className="button secondary" disabled={busy} onClick={()=>void act('logout')}>Déconnecter le compte</button><p className="form-help">Le journal local reste sur cet appareil. Un autre compte ne pourra pas le synchroniser.</p></>:<>
 <p className="muted">Connecte ton compte existant pour retrouver ton journal et synchroniser tes appareils. Les saisies hors connexion restent enregistrées sur cet appareil.</p>
 <form className="form-grid" onSubmit={e=>{e.preventDefault();void act('password');}}>
 <label className="wide">Adresse e-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
 <label className="wide">Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
 <button className="button primary wide" disabled={busy}>Se connecter</button></form>
 <button className="link" disabled={busy||!email} onClick={()=>void act('link')}>Recevoir un lien de connexion à cette adresse</button>
 <details><summary>J'ai reçu un code par e-mail</summary><form className="form-grid" onSubmit={e=>{e.preventDefault();void act('verify');}}><label className="wide">Code reçu<input inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e=>setToken(e.target.value)} required/></label><button className="button secondary wide" disabled={busy||!email}>Vérifier le code</button></form></details>
 </>}{message&&<p role="status" className="notice">{message}</p>}{error&&<p role="alert" className="form-error">{error}</p>}</section>;
}
