'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,CloudDownload,Download,RefreshCw,ShieldAlert,Smartphone} from 'lucide-react';
import * as F from '@/lib/finance';
import {getVaultStatus,loadState,type Stored} from '@/lib/storage';
import {unlockVault} from '@/lib/vault';
import {previewServerRecovery,applyServerRecovery,type RecoveryPreview} from '@/lib/recover-from-server';
import Account from '@/app/account';

type Phase='loading'|'login'|'ready'|'working'|'done';
const money=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(n)+' Ar';

export default function RecoverWizard(){
  const [phase,setPhase]=useState<Phase>('loading');
  const [review,setReview]=useState<RecoveryPreview|null>(null);
  const [saved,setSaved]=useState<Stored|null>(null);
  const [backupUrl,setBackupUrl]=useState('');
  const [backupConfirmed,setBackupConfirmed]=useState(false);
  const [replaceConfirmed,setReplaceConfirmed]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [locked,setLocked]=useState(false);
  const [code,setCode]=useState('');
  const lock=useRef(false);
  const url=useRef('');
  const replaceUrl=useCallback((next:string)=>{
    if(url.current)URL.revokeObjectURL(url.current);
    url.current=next;setBackupUrl(next);
  },[]);
  const refresh=useCallback(async()=>{
    if(lock.current)return;
    lock.current=true;setPhase('loading');setError('');setReview(null);
    setBackupConfirmed(false);setReplaceConfirmed(false);
    replaceUrl('');
    try{
      if(await getVaultStatus()){
        try{await loadState();}
        catch{setLocked(true);setPhase('ready');return;}
      }
      setLocked(false);
      const result=await previewServerRecovery();
      if(result.localBackup)replaceUrl(URL.createObjectURL(new Blob([result.localBackup],{type:'application/json'})));
      setReview(result);setPhase('ready');
      setMessage(result.same?'Les journaux sont déjà identiques.':result.local?
        'Deux journaux ont été trouvés. Vérifie-les avant de confirmer une récupération.':
        'Aucune donnée financière locale : tu peux récupérer ton journal depuis ton compte.');
    }catch(e){
      const msg=(e as Error).message;
      setError(msg);
      setPhase(/Connecte-toi|401|compte|autorisé/i.test(msg)?'login':'ready');
    }finally{lock.current=false;}
  },[replaceUrl]);
  useEffect(()=>{
    void refresh();
    return()=>{if(url.current)URL.revokeObjectURL(url.current);};
  },[refresh]);
  async function unlock(){
    if(lock.current)return;
    lock.current=true;setError('');
    try{
      const meta=await getVaultStatus();
      if(!meta)throw new Error('Aucun coffre actif.');
      await unlockVault(meta,code);
      setCode('');setLocked(false);
    }catch(e){setError((e as Error).message);}
    finally{lock.current=false;}
    if(!locked)return;
    await refresh();
  }
  async function recover(){
    if(!review||review.same||lock.current)return;
    if(review.local&&(!backupConfirmed||!replaceConfirmed)){
      setError('Télécharge la sauvegarde et confirme son remplacement avant de continuer.');
      return;
    }
    lock.current=true;setPhase('working');setError('');setMessage('Récupération locale et vérification en cours…');
    try{
      const result=await applyServerRecovery(review);
      setSaved(result);setPhase('done');
      setMessage(result.state.operations.length+' opérations récupérées et vérifiées sur cet appareil. Aucune donnée serveur n’a été modifiée.');
    }catch(e){
      setError((e as Error).message);setMessage('Aucune suppression automatique. Conserve les deux versions.');
      setPhase('ready');
    }finally{lock.current=false;}
  }
  const remote=review?.remote.state;
  const local=review?.local?.state;
  return <main className="pk-wizard">
    <header className="pk-wizard-header">
      <a className="pk-wizard-back" href="/"><ArrowLeft size={18}/> Retour à Poketra’ko</a>
      <span>TRANSFERT VERS ANDROID</span>
      <h1>Récupérer depuis mon compte</h1>
      <p>Retrouve sur ton téléphone le journal déjà synchronisé depuis ton PC. L’ancienne version locale est sauvegardée avant toute modification.</p>
    </header>
    <div className="pk-wizard-body">
      <section className="card pk-wizard-card">
        <div className="pk-wizard-label">01 / IDENTITÉ</div>
        <h2><Smartphone size={21}/> Même compte que sur le PC</h2>
        <Account onSignedIn={refresh}/>
        <p>Les données serveur sont privées. Connecte-toi avec la même adresse que sur le PC, puis lance la vérification.</p>
        <button type="button" className="button secondary" disabled={phase==='loading'||phase==='working'} onClick={()=>void refresh()}>
          <RefreshCw size={17}/> Vérifier mon compte et mes données
        </button>
      </section>
      {locked&&<section className="card pk-wizard-card">
        <h2>Déverrouiller le coffre local Android</h2>
        <form onSubmit={e=>{e.preventDefault();void unlock();}}>
          <label>Code de l’appareil<input type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)} required/></label>
          <button className="button primary" type="submit">Déverrouiller</button>
        </form>
      </section>}
      {(error||message)&&<div className="pk-wizard-feedback" role="status" aria-live="polite">
        {message&&<p className="pk-wizard-message"><CheckCircle2 size={18}/>{message}</p>}
        {error&&<p className="pk-wizard-error" role="alert"><ShieldAlert size={18}/>{error}</p>}
      </div>}
      {review&&!locked&&phase!=='done'&&<section className="card pk-wizard-card">
        <div className="pk-wizard-label">02 / COMPARAISON</div>
        <h2>Les deux journaux</h2>
        <div className="pk-wizard-compare">
          <div><span>Sur ce téléphone</span><strong>{local?.operations.length??0}</strong><small>opérations · {local?money(F.summary(local).total):'aucun journal'}</small></div>
          <div><span>Sur ton compte</span><strong>{remote?.operations.length??0}</strong><small>opérations · {remote?money(F.summary(remote).total):'aucun journal'}</small></div>
          <div><span>Après récupération</span><strong>{remote?.operations.length??0}</strong><small>opérations prévues</small></div>
        </div>
        <p>Version du serveur : {review.remote.revision} · Mise à jour : {new Date(review.remote.updatedAt).toLocaleString('fr-FR')}</p>
        {review.same?<p className="pk-wizard-safe">Le journal local est identique au journal distant. Aucun remplacement n’est nécessaire.</p>:
          <div className="pk-wizard-warning">
            <strong>La récupération est une action locale</strong>
            <p>Elle ne modifie pas ton compte Supabase. Les opérations du PC restent sur le serveur. Si tu avais des transactions uniquement sur Android, elles ne seront pas fusionnées automatiquement : conserve la sauvegarde avant de remplacer.</p>
          </div>}
        {review.local&&!review.same&&<div className="pk-wizard-backup">
          {backupUrl&&<a className="button secondary" download={'poketrako-android-avant-recuperation-'+F.today()+'.json'} href={backupUrl}>
            <Download size={18}/> Télécharger mes données Android actuelles
          </a>}
          <label><input type="checkbox" checked={backupConfirmed} onChange={e=>setBackupConfirmed(e.target.checked)}/>J’ai téléchargé et conservé cette sauvegarde Android.</label>
          <label><input type="checkbox" checked={replaceConfirmed} onChange={e=>setReplaceConfirmed(e.target.checked)}/>Je confirme le remplacement du journal local Android par celui de mon compte, sans fusionner les soldes initiaux.</label>
        </div>}
        {!review.same&&<div className="pk-wizard-actions"><button className="button primary" disabled={phase==='working'||(!!review.local&&(!backupConfirmed||!replaceConfirmed))} onClick={()=>void recover()}>
          <CloudDownload size={18}/> Récupérer le journal sur Android
        </button></div>}
      </section>}
      {phase==='done'&&<section className="card pk-wizard-card">
        <div className="pk-wizard-label">03 / CONFIRMATION</div>
        <h2><CheckCircle2 size={21}/> Journal récupéré</h2>
        <p>{saved?.state.operations.length??0} opérations vérifiées sur ce navigateur. Ouvre Poketra’ko pour consulter tes portefeuilles et ton historique.</p>
        <a href="/" className="button primary pk-wizard-finish">Ouvrir mes finances</a>
      </section>}
      <footer className="pk-wizard-footer">Les navigateurs, domaines et applications installées possèdent chacun leur stockage local. Utilise bien Poketra’ko sur poketra-rho.vercel.app et conserve la sauvegarde Android jusqu’à vérification de tes cinq soldes.</footer>
    </div>
  </main>;
}
