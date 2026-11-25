import * as F from './finance';
import {canonical,upgrade} from './models';
export class MergeConflict extends Error{constructor(public path:string){super('Conflit à vérifier : '+path);this.name='MergeConflict';}}
function mergeValue(base:any,local:any,remote:any,path:string):any{if(canonical(local)===canonical(remote))return local;if(canonical(local)===canonical(base))return remote;if(canonical(remote)===canonical(base))return local;
 if(path==='extra.preferences')return local;
 if(Array.isArray(local)&&Array.isArray(remote)&&Array.isArray(base)&&[...local,...remote,...base].every(v=>v&&typeof v==='object'&&typeof v.id==='string')){const bm=new Map(base.map(v=>[v.id,v])),lm=new Map(local.map(v=>[v.id,v])),rm=new Map(remote.map(v=>[v.id,v]));const ids=[...new Set([...remote.map(v=>v.id),...local.map(v=>v.id)])];return ids.map(id=>mergeValue(bm.get(id),lm.get(id),rm.get(id),path+'.'+id)).filter(v=>v!==undefined);}
 if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){const keys=new Set([...Object.keys(base??{}),...Object.keys(local),...Object.keys(remote)]);return Object.fromEntries([...keys].map(k=>[k,mergeValue(base?.[k],local[k],remote[k],path?path+'.'+k:k)]).filter(([,v])=>v!==undefined));}
 throw new MergeConflict(path);
}
export function mergeStates(base:F.State|undefined,local:F.State,remote:F.State):F.State{if(!base){if(canonical(local)===canonical(remote))return local;const ids=new Map(remote.operations.map(o=>[o.id,o]));if(local.operations.every(o=>canonical(ids.get(o.id))===canonical(o))&&local.operations.length===remote.operations.length)return mergeValue(upgrade(local),upgrade(local),upgrade(remote),'');throw new MergeConflict('Aucun état commun entre les deux appareils.');}
 const b=upgrade(base),l=upgrade(local),r=upgrade(remote);for(const op of b.operations){if(canonical(l.operations.find(o=>o.id===op.id))!==canonical(op)||canonical(r.operations.find(o=>o.id===op.id))!==canonical(op))throw new MergeConflict('journal '+op.id);}
 const remoteById=new Map(r.operations.map(o=>[o.id,o]));
 for(const op of l.operations){
   const other=remoteById.get(op.id);
   if(other&&op.id.startsWith('plan:')&&canonical({...op,createdAt:''})!==canonical({...other,createdAt:''}))
     throw new MergeConflict('Deux validations différentes pour '+op.label);
 }
 const operations=[...r.operations,...l.operations.filter(o=>!remoteById.has(o.id))];const result=mergeValue({...b,operations:[]},{...l,operations:[]},{...r,operations:[]},'') as F.State;result.operations=operations;F.validateState(result);return result;
}
