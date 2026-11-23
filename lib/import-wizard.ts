import * as F from './finance';
import {canonical,upgrade} from './models';
import {planRestore,type RestorePlan} from './restore';
import {fullBackup,stageBackupFiles,validatePortableBackup,type ReceiptData} from './receipts';
import {
  loadState,saveState,checkpointState,readKV,acknowledgeSync,
  type Stored,type SyncMeta,type Outbox
} from './storage';
import {syncNow,syncStatus} from './sync';

export type ImportAnalysis={
  name:string;
  plan:RestorePlan;
  files:Record<string,ReceiptData>;
  expected:Stored|null;
  originalBackup:string|null;
};

export async function inspectImport(name:string,text:string):Promise<ImportAnalysis>{
  if(!text.trim())throw new Error('Le fichier sélectionné est vide. Exporte une sauvegarde complète JSON depuis l’ancien Poketra.');
  let parsed:Awaited<ReturnType<typeof validatePortableBackup>>;
  try{parsed=await validatePortableBackup(text);}
  catch(e){const msg=(e as Error).message;
    throw new Error(msg.includes('JSON')||msg.includes('Unexpected token')?'Fichier non reconnu. Sélectionne « Sauvegarde complète » (.json) dans l’ancien Poketra.':msg);
  }
  const expected=await loadState();
  const plan=planRestore(expected?.state??F.emptyState(),parsed.state);
  let originalBackup:string|null=null;
  if(expected && plan.mode==='replace'){
    originalBackup=await fullBackup(expected.state);
    const check=await validatePortableBackup(originalBackup);
    if(canonical(check.state)!==canonical(expected.state))throw new Error('Impossible de préparer une copie exacte de cet espace. Import annulé.');
  }
  return {name,plan,files:parsed.files,expected,originalBackup};
}

/**
 * Sauvegarder l'état existant AVANT tout remplacement ; comparer la révision
 * attendue pour éviter qu'un autre onglet écrase une saisie récente.
 */
export async function saveImportedJournal(review:ImportAnalysis):Promise<Stored>{
  const {plan,expected,files}=review;
  if(plan.mode==='unchanged')throw new Error('La sauvegarde est déjà intégralement présente.');
  const actual=await loadState();
  if((actual?.revision??0)!==(expected?.revision??0)||
    (actual&&expected&&canonical(actual.state)!==canonical(expected.state))||
    (!!actual!==!!expected))
    throw new Error('Cet espace a changé depuis l’analyse du fichier. Analyse à nouveau le JSON avant de restaurer.');
  if(actual){
    await checkpointState('before-guided-import');
    if(plan.mode==='replace'&&!review.originalBackup)
      throw new Error('Copie de sécurité manquante : restauration refusée.');
  }
  await stageBackupFiles(files);
  const saved=await saveState(upgrade(plan.state),actual?.revision??0,'before-guided-import');
  const verified=await loadState();
  if(!verified || verified.revision!==saved.revision ||
     canonical(verified.state)!==canonical(saved.state) ||
     canonical(F.summary(verified.state))!==canonical(F.summary(plan.state)))
    throw new Error('Restauration locale non confirmée. Garde le JSON et ton ancien Poketra.');
  return verified;
}

type Remote={ownerId:string;revision:number;state:F.State|null;updatedAt?:string};
async function serverResponse(url:string,init?:RequestInit){
  const response=await fetch(url,{...init,cache:'no-store',credentials:'same-origin'});
  const data:unknown=await response.json().catch(()=>({}));
  if(!response.ok){
    const message=data&&typeof data==='object'&&'error'in data&&typeof data.error==='string'
      ?data.error:'Le compte serveur ne répond pas. Le journal reste sauvegardé sur cet appareil.';
    throw new Error(message);
  }
  return data as Remote;
}
/** La synchronisation distante n'est jamais lancée sans un clic et un consentement explicites. */
export async function uploadImportedJournal(){
  const pending=await readKV<Outbox>('outbox');
  const local=await loadState();
  if(!local)throw new Error('Aucun journal local importé.');
  if(!pending)throw new Error('Aucune sauvegarde en attente. Vérifie l’état de synchronisation.');
  if(canonical(pending.state)!==canonical(local.state))
    throw new Error('Une saisie a été faite depuis l’import. Recharge la page et vérifie le journal.');
  const remote=await serverResponse('/api/sync');
  const meta=await readKV<SyncMeta>('sync');
  if(meta?.ownerId&&meta.ownerId!==remote.ownerId)
    throw new Error('Ce téléphone est associé à un autre compte. Aucune donnée envoyée.');
  if(!Number.isSafeInteger(remote.revision)||remote.revision<0)
    throw new Error('Révision serveur non reconnue.');
  if(remote.state&&canonical(remote.state)===canonical(local.state)){
    await acknowledgeSync(pending,{revision:remote.revision,state:remote.state,ownerId:remote.ownerId,updatedAt:remote.updatedAt??new Date().toISOString()});
    return 'Le journal est déjà présent sur ton compte serveur.';
  }
  if(remote.state&&!(remote.state.operations.length===1&&remote.state.operations[0]?.kind==='opening'))
    throw new Error('Le compte serveur contient déjà des opérations. Aucun remplacement effectué ; préserve les deux sauvegardes.');
  if(!remote.state){
    await syncNow(true);
    const synced=await syncStatus();
    if(synced.status!=='synced')throw new Error(synced.error??'La synchronisation normale reste en attente.');
    return 'Journal envoyé sur le serveur et confirmé.';
  }
  const ack=await serverResponse('/api/restore-initial',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      confirmation:'restore-initial-only',
      mutationId:pending.mutationId,expectedRemote:remote.revision,state:local.state
    })
  });
  if(!ack.state||!Number.isSafeInteger(ack.revision)||ack.ownerId!==remote.ownerId)
    throw new Error('Le serveur n’a pas confirmé la version restaurée.');
  await acknowledgeSync(pending,{
    revision:ack.revision,state:ack.state,ownerId:ack.ownerId,
    updatedAt:ack.updatedAt??new Date().toISOString()
  });
  return 'Journal transféré et confirmé. Le solde initial précédent est archivé sur le serveur.';
}
