'use client';
import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {ArrowLeft,CheckCircle2,Download,FileJson,LockKeyhole,ShieldAlert,UploadCloud,RefreshCw} from 'lucide-react';
import * as F from '@/lib/finance';
import {canonical} from '@/lib/models';
import {getVaultStatus,loadState,type Stored} from '@/lib/storage';
import {unlockVault} from '@/lib/vault';
import {
  inspectImport,saveImportedJournal,uploadImportedJournal,type ImportAnalysis
} from '@/lib/import-wizard';

type Phase='loading'|'ready'|'reading'|'review'|'saving'|'saved'|'syncing'|'done';
const display=(amount:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(amount)+' Ar';

export default function ImportWizard(){
  const [phase,setPhase]=useState<Phase>('loading');
  const [analysis,setAnalysis]=useState<ImportAnalysis|null>(null);
  const [local,setLocal]=useState<Stored|null>(null);
  const [filename,setFilename]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [backupUrl,setBackupUrl]=useState('');
  const [hasSavedCopy,setHasSavedCopy]=useState(false);
  const [confirmReplace,setConfirmReplace]=useState(false);
  const [confirmServer,setConfirmServer]=useState(false);
  const [code,setCode]=useState('');
  const [locked,setLocked]=useState(false);
  const busy=useRef(false),reviewRef=useRef<HTMLDivElement>(null),urlRef=useRef('');
  function replaceUrl(url:string){
    if(urlRef.current)URL.revokeObjectURL(urlRef.current);
    urlRef.current=url;
    setBackupUrl(url);
  }
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const vault=await getVaultStatus();
        if(!active)return;
        if(vault){setLocked(true);setPhase('ready');return;}
        const stored=await loadState();
        if(active){setLocal(stored);setPhase('ready');}
      }catch(e){if(active){setError((e as Error).message);setPhase('ready');}}
    })();
    return()=>{active=false;if(urlRef.current)URL.revokeObjectURL(urlRef.current);};
  },[]);
  useEffect(()=>{if(phase==='review')reviewRef.current?.scrollIntoView?.({block:'start',behavior:'smooth'});},[phase]);
  async function unlock(){
    if(busy.current)return;
    busy.current=true;setError('');
    try{
      const meta=await getVaultStatus();
      if(!meta)throw new Error('Le coffre n’est plus actif. Réouvre cette page.');
      await unlockVault(meta,code);
      setCode('');setLocal(await loadState());setLocked(false);setMessage('Coffre déverrouillé pour la restauration.');
    }catch(e){setError((e as Error).message);}
    finally{busy.current=false;}
  }
  async function selectFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.currentTarget.files?.[0];
    if(!file){setMessage('Aucun fichier sélectionné.');return;}
    e.currentTarget.value='';
    if(busy.current)return;
    busy.current=true;
    setFilename(file.name);setError('');setMessage('Lecture et vérification du fichier '+file.name+'…');
    setAnalysis(null);setHasSavedCopy(false);setConfirmReplace(false);setConfirmServer(false);
    replaceUrl('');setPhase('reading');
    try{
      if(file.size>45_000_000)throw new Error('Fichier supérieur à 45 Mo : exporte une sauvegarde JSON plus petite.');
      const text=await file.text();
      const review=await inspectImport(file.name,text);
      if(review.originalBackup){
        const url=URL.createObjectURL(new Blob([review.originalBackup],{type:'application/json'}));
        replaceUrl(url);
      }
      setAnalysis(review);
      setLocal(review.expected);
      setMessage('Fichier reconnu : '+review.plan.importedOperations+' opérations. Vérifie le récapitulatif ci-dessous.');
      setPhase('review');
    }catch(e){
      setError((e as Error).message||'Impossible de lire cette sauvegarde.');
      setMessage('Importation non commencée : aucune donnée modifiée.');
      setPhase('ready');
    }finally{busy.current=false;}
  }
  async function save(){
    if(!analysis||busy.current)return;
    const plan=analysis.plan;
    if(plan.mode==='unchanged'){setPhase('saved');setMessage('Toutes les opérations sont déjà enregistrées sur cet appareil.');return;}
    if(plan.mode==='replace'&&(!hasSavedCopy||!confirmReplace)){
      setError('Conserve une copie de l’espace actuel et confirme la restauration avant de continuer.');
      return;
    }
    busy.current=true;setError('');setMessage('Sauvegarde de sécurité et enregistrement en cours…');setPhase('saving');
    try{
      const saved=await saveImportedJournal(analysis);
      setLocal(saved);setPhase('saved');
      setMessage('Importation locale terminée et vérifiée : '+saved.state.operations.length+' opérations. Tu peux maintenant les synchroniser avec ton compte.');
      setAnalysis(null);replaceUrl('');
    }catch(e){
      setError((e as Error).message||'Importation interrompue.');
      setMessage('Aucun effacement automatique. Relis le message d’erreur avant de réessayer.');
      setPhase('review');
    }finally{busy.current=false;}
  }
  async function sync(){
    if(busy.current||!confirmServer)return;
    busy.current=true;setError('');setPhase('syncing');setMessage('Vérification du compte et du journal serveur…');
    try{
      const result=await uploadImportedJournal();
      setMessage(result);setPhase('done');
    }catch(e){
      setError((e as Error).message||'Synchronisation indisponible.');
      setMessage('La sauvegarde locale reste présente ; le serveur n’a pas été remplacé.');
      setPhase('saved');
    }finally{busy.current=false;}
  }
  const saving=phase==='saving'||phase==='syncing'||phase==='reading'||phase==='loading';
  const before=analysis?.expected?.state;
  const plan=analysis?.plan;
  return <main className="pk-wizard">
    <header className="pk-wizard-header">
      <a href="/" className="pk-wizard-back"><ArrowLeft size={18}/> Revenir à Poketra’ko</a>
      <span>RÉCUPÉRATION DES DONNÉES</span>
      <h1>Importer l’ancien Poketra</h1>
      <p>Une vérification avant chaque opération. Aucun solde initial n’est additionné à un autre.</p>
    </header>
    <div className="pk-wizard-body">
      {locked?<section className="card pk-wizard-card">
        <h2><LockKeyhole size={20}/> Déverrouiller les données locales</h2>
        <p>Ton espace est protégé par un coffre. Son code est nécessaire pour comparer les journaux.</p>
        <form onSubmit={e=>{e.preventDefault();void unlock();}}>
          <label>Code du coffre<input type="password" autoComplete="current-password" value={code} onChange={e=>setCode(e.target.value)} required/></label>
          <button type="submit" className="button primary">Déverrouiller</button>
        </form>
      </section>:<section className="card pk-wizard-card">
        <div className="pk-wizard-label">01 / SÉLECTION DU FICHIER</div>
        <h2><FileJson size={21}/> Choisir la sauvegarde JSON</h2>
        <p>Sélectionne le fichier exporté depuis <strong>Sécurité et sauvegardes → Sauvegarde complète</strong> dans l’ancien Poketra. Utilise la sauvegarde la plus récente.</p>
        <label className="pk-wizard-file-label" htmlFor="poketra-backup-upload">Fichier de sauvegarde (.json)</label>
        <input id="poketra-backup-upload" className="pk-wizard-file" type="file" accept=".json,application/json" disabled={saving} onChange={e=>void selectFile(e)}/>
        {filename&&<p className="pk-wizard-selected">Fichier sélectionné : <strong>{filename}</strong></p>}
        {phase==='loading'&&<p>Chargement des données locales…</p>}
        {phase==='reading'&&<p role="status"><RefreshCw size={16}/> Analyse du fichier en cours…</p>}
      </section>}
      {(message||error)&&<div className="pk-wizard-feedback" role="status" aria-live="polite">
        {message&&<p className="pk-wizard-message"><CheckCircle2 size={18}/>{message}</p>}
        {error&&<p className="pk-wizard-error" role="alert"><ShieldAlert size={18}/>{error}</p>}
      </div>}
      {phase==='review'&&analysis&&plan&&<section className="card pk-wizard-card" ref={reviewRef} aria-label="Vérification de la sauvegarde">
        <div className="pk-wizard-label">02 / CONTRÔLE AVANT RESTAURATION</div>
        <h2>Vérifie les données</h2>
        <div className="pk-wizard-compare">
          <div><span>Actuellement</span><strong>{plan.localOperations}</strong><small>opérations · {display(F.summary(before??F.emptyState()).total)}</small></div>
          <div><span>Dans le fichier</span><strong>{plan.importedOperations}</strong><small>opérations · {display(F.summary(plan.state).total)}</small></div>
          <div><span>Après import</span><strong>{plan.resultingOperations}</strong><small>opérations prévues</small></div>
        </div>
        {plan.mode==='unchanged'?<p className="pk-wizard-safe">Cette sauvegarde est déjà présente sur cet appareil. Aucun doublon ne sera créé.</p>:
         plan.mode==='replace'?<div className="pk-wizard-warning"><strong>Deux historiques financiers différents</strong><p>Il ne faut pas additionner leurs soldes initiaux. L’import remplacera l’espace local actuel par les données du fichier. Une copie de récupération locale sera conservée.</p></div>:
         <p className="pk-wizard-safe">Les journaux sont compatibles : les opérations existantes seront conservées.</p>}
        {plan.mode==='replace'&&backupUrl&&<div className="pk-wizard-backup">
          <a className="button secondary" href={backupUrl} download={'poketrako-copie-avant-import-'+F.today()+'.json'}><Download size={18}/> Télécharger la copie de l’espace actuel</a>
          <label><input type="checkbox" checked={hasSavedCopy} onChange={e=>setHasSavedCopy(e.target.checked)}/>J’ai téléchargé et conservé cette copie.</label>
          <label><input type="checkbox" checked={confirmReplace} onChange={e=>setConfirmReplace(e.target.checked)}/>Je confirme le remplacement de l’espace local par ce fichier JSON.</label>
        </div>}
        <div className="pk-wizard-actions"><button type="button" className="button primary" disabled={saving||(plan.mode==='replace'&&(!hasSavedCopy||!confirmReplace))} onClick={()=>void save()}>
          <UploadCloud size={18}/>{plan.mode==='unchanged'?'Continuer vers la synchronisation':plan.mode==='replace'?'Restaurer le journal importé':'Importer les données manquantes'}
        </button></div>
      </section>}
      {(phase==='saved'||phase==='syncing'||phase==='done')&&!locked&&<section className="card pk-wizard-card">
        <div className="pk-wizard-label">03 / COMPTE ET SYNCHRONISATION</div>
        <h2><CheckCircle2 size={21}/> {phase==='done'?'Journal synchronisé':'Journal enregistré localement'}</h2>
        <p>{local?.state.operations.length??0} opérations actuellement enregistrées sur cet appareil. Le fichier JSON d’origine n’est pas supprimé.</p>
        {phase!=='done'&&<>
          <div className="pk-wizard-warning"><strong>Synchronisation avec ton compte</strong><p>Le serveur peut actuellement posséder son propre solde initial. Son remplacement est autorisé uniquement s’il n’existe aucune autre transaction ; l’ancienne version est archivée.</p></div>
          <label className="pk-wizard-consent"><input type="checkbox" checked={confirmServer} onChange={e=>setConfirmServer(e.target.checked)}/>Je souhaite envoyer ce journal sur mon compte Poketra’ko, uniquement si le serveur ne contient qu’un solde initial.</label>
          <button type="button" className="button primary" disabled={saving||!confirmServer} onClick={()=>void sync()}><UploadCloud size={18}/> Vérifier et synchroniser mon compte</button>
        </>}
        <a className="button secondary pk-wizard-finish" href="/">Ouvrir mes finances</a>
      </section>}
      <footer className="pk-wizard-footer">L’import fonctionne dans le stockage local de ce navigateur. Ne vide pas le cache, ne désinstalle pas l’ancienne application et garde le fichier source jusqu’à vérification des cinq soldes.</footer>
    </div>
  </main>;
}
