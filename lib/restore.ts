import * as F from './finance';
import {canonical,extra,upgrade} from './models';
export function restoreMerge(current:F.State,backup:F.State):F.State{F.validateState(backup);if(!current.initialized&&!current.operations.length)return upgrade(backup);const first=current.operations[0],restored=backup.operations[0];if(first?.kind!=='opening'||restored?.kind!=='opening'||canonical(first)!==canonical(restored))throw new Error('Les deux espaces ont des soldes initiaux différents. Une restauration contrôlée est nécessaire, pas une fusion.');const ids=new Map(current.operations.map(o=>[o.id,o]));for(const o of backup.operations){const existing=ids.get(o.id);if(existing&&canonical(existing)!==canonical(o))throw new Error('Une opération existante a le même identifiant avec un contenu différent.');}
 const union=<T extends {id:string}>(a:T[],b:T[])=>[...a,...b.filter(v=>!a.some(w=>w.id===v.id))];const c=extra(current),b=extra(backup),state:F.State={...current,wallets:union(current.wallets,backup.wallets),categories:union(current.categories,backup.categories),funds:union(current.funds,backup.funds),projects:union(current.projects,backup.projects),obligations:union(current.obligations,backup.obligations),operations:union(current.operations,backup.operations),extra:{...c,loans:union(c.loans,b.loans),attachments:union(c.attachments,b.attachments),beneficiaries:union(c.beneficiaries,b.beneficiaries),favorites:union(c.favorites,b.favorites),feeModels:union(c.feeModels,b.feeModels),details:{...b.details,...c.details}}};F.validateState(state);return state;}

/** Analyse une importation sans écrire dans le stockage et sans fusionner deux soldes de départ. */
export type RestorePlan = {
  mode:'merge'|'replace'|'unchanged';
  state:F.State;
  reason:string;
  localOperations:number;
  importedOperations:number;
  resultingOperations:number;
};
export function planRestore(current:F.State,backup:F.State):RestorePlan{
  F.validateState(backup);
  F.validateState(current);
  const base={localOperations:current.operations.length,importedOperations:backup.operations.length};
  if(!current.initialized&&!current.operations.length)
    return{...base,mode:'merge',state:upgrade(backup),resultingOperations:backup.operations.length,reason:'Premier import dans un espace sans écritures.'};
  if(canonical(current)===canonical(backup))
    return{...base,mode:'unchanged',state:current,resultingOperations:current.operations.length,reason:'Toutes les données de cette sauvegarde sont déjà présentes.'};
  try{
    const merged=restoreMerge(current,backup);
    return{...base,mode:canonical(merged)===canonical(current)?'unchanged':'merge',state:merged,
      resultingOperations:merged.operations.length,
      reason:canonical(merged)===canonical(current)?'Aucune donnée manquante à ajouter.':'Journaux compatibles : les opérations existantes seront conservées.'};
  }catch{
    return{...base,mode:'replace',state:upgrade(backup),resultingOperations:backup.operations.length,
      reason:'Les historiques ou soldes de départ sont différents. Un remplacement explicite avec une sauvegarde de sécurité est nécessaire.'};
  }
}
