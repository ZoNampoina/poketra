import * as F from './finance';
import {canonical,upgrade} from './models';
import {
  adoptRemote,checkpointState,loadState,readKV,
  type Stored,type SyncMeta,type Outbox
} from './storage';
import {fullBackup,validatePortableBackup} from './receipts';

export type ServerJournal={
  ownerId:string;
  revision:number;
  updatedAt:string;
  state:F.State;
};
export type RecoveryPreview={
  local:Stored|null;
  remote:ServerJournal;
  same:boolean;
  localBackup:string|null;
};

async function retrieve():Promise<ServerJournal>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  let response:Response;
  try{
    response=await fetch('/api/sync',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
  }finally{clearTimeout(timer);}
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const message=typeof data==='object'&&data!==null&&'error'in data&&typeof data.error==='string'
      ?data.error:'Connexion au compte indisponible. Les données locales sont conservées.';
    throw new Error(message);
  }
  if(!data||typeof data!=='object')throw new Error('Réponse du serveur non reconnue.');
  const d=data as Partial<ServerJournal>;
  if(!d.ownerId||typeof d.ownerId!=='string'||!Number.isSafeInteger(d.revision)||Number(d.revision)<0||
    !d.state||!d.updatedAt||typeof d.updatedAt!=='string')
    throw new Error('Le serveur ne possède pas encore de journal financier récupérable.');
  F.validateState(d.state);
  return d as ServerJournal;
}

/** Lecture seule de l'état distant et préparation d'une sauvegarde indépendante du téléphone. */
export async function previewServerRecovery():Promise<RecoveryPreview>{
  const remote=await retrieve();
  const meta=await readKV<SyncMeta>('sync');
  if(meta?.ownerId && meta.ownerId!==remote.ownerId)
    throw new Error('Cet appareil a déjà été lié à un autre compte. Aucune restauration autorisée.');
  const local=await loadState();
  const same=!!local&&canonical(local.state)===canonical(remote.state);
  let localBackup:string|null=null;
  if(local && !same){
    localBackup=await fullBackup(local.state);
    const verified=await validatePortableBackup(localBackup);
    if(canonical(verified.state)!==canonical(local.state))
      throw new Error('La copie de sécurité locale n’est pas vérifiable. Récupération annulée.');
  }
  return {local,remote,same,localBackup};
}

/**
 * Restauration sur le téléphone UNIQUEMENT ; ne modifie aucune table serveur.
 * Refuse si le navigateur ou le serveur a évolué depuis l'aperçu.
 */
export async function applyServerRecovery(review:RecoveryPreview):Promise<Stored>{
  if(review.same)throw new Error('Les deux journaux sont déjà identiques.');
  if(review.local && !review.localBackup)throw new Error('La sauvegarde préalable de cet appareil est absente.');
  const actual=await loadState();
  if(!!actual!==!!review.local ||
    (actual&&review.local&&(actual.revision!==review.local.revision||
       canonical(actual.state)!==canonical(review.local.state))))
    throw new Error('Le journal Android a changé depuis la comparaison. Recharge les deux versions avant de continuer.');
  const fresh=await retrieve();
  if(fresh.ownerId!==review.remote.ownerId||
    fresh.revision!==review.remote.revision||
    canonical(fresh.state)!==canonical(review.remote.state))
    throw new Error('Le journal serveur a changé. Actualise la comparaison, sans effacer les données Android.');
  const meta=await readKV<SyncMeta>('sync');
  if(meta?.ownerId && meta.ownerId!==fresh.ownerId)
    throw new Error('Compte différent détecté sur Android : récupération refusée.');
  if(actual)await checkpointState('before-server-recovery');
  const saved=await adoptRemote({...fresh,state:upgrade(fresh.state)},actual?.revision??0);
  const verified=await loadState();
  if(!verified||verified.revision!==saved.revision||
    canonical(verified.state)!==canonical(upgrade(fresh.state))||
    canonical(F.summary(verified.state))!==canonical(F.summary(fresh.state)))
    throw new Error('La vérification du journal récupéré a échoué. Conserve tes sauvegardes.');
  const latest=await readKV<SyncMeta>('sync');
  const pending=await readKV<Outbox>('outbox');
  if(latest?.ownerId!==fresh.ownerId||latest.remoteRevision!==fresh.revision||pending)
    throw new Error('La récupération locale est enregistrée, mais la confirmation de synchronisation est à vérifier.');
  return verified;
}
