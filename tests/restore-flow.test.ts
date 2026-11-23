import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as F from '../lib/finance';
import {canonical,upgrade} from '../lib/models';
import {planRestore,restoreMerge} from '../lib/restore';
import {readKV,saveState,checkpointState,snapshot,type Stored} from '../lib/storage';
import {fullBackup,validatePortableBackup} from '../lib/receipts';

async function clear(){await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('poketra-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
function currentSpace(){return upgrade(F.initialize(F.emptyState(),{cash:35000,mvola:5000}));}
function historicalSpace(){let s=upgrade(F.initialize(F.emptyState(),{cash:200000,mvola:120000}));s=F.income(s,{walletId:'cash',amount:25000,label:'Revenu précédent'});s=F.allocate(s,F.UNASSIGNED,'e-essential',100000);s=F.expense(s,{walletId:'cash',fundId:'e-essential',categoryId:'essential',amount:20000,label:'Courses'});return s;}

test('L’espace sans journal importe directement une sauvegarde sans point de récupération inexistant',async()=>{
 await clear();
 const old=historicalSpace(),plan=planRestore(F.emptyState(),old);
 assert.equal(plan.mode,'merge');
 assert.equal(plan.importedOperations,4);
 assert.equal(await readKV<Stored>('workspace'),null);
 const saved=await saveState(plan.state,0);
 assert.equal(canonical(saved.state.operations),canonical(old.operations));
 assert.equal(F.summary(saved.state).total,F.summary(old).total);
});
test('Deux ouvertures financières distinctes ne sont jamais additionnées silencieusement',()=>{
 const current=currentSpace(),backup=historicalSpace(),before=canonical(current);
 assert.throws(()=>restoreMerge(current,backup),/soldes initiaux différents/);
 const plan=planRestore(current,backup);
 assert.equal(plan.mode,'replace');
 assert.equal(plan.localOperations,1);
 assert.equal(plan.importedOperations,4);
 assert.equal(plan.resultingOperations,4);
 assert.equal(canonical(current),before);
 assert.equal(F.summary(plan.state).total,F.summary(backup).total);
});
test('Une restauration explicite archive l’ancien solde et retrouve strictement le journal importé',async()=>{
 await clear();
 const current=currentSpace(),backup=historicalSpace();
 await saveState(current,0);
 const review=planRestore(current,backup);
 assert.equal(review.mode,'replace');
 const checkpoint=await checkpointState('before-import');
 await saveState(review.state,1);
 const now=(await readKV<Stored>('workspace'))!;
 const archived=await snapshot(checkpoint.id);
 assert.equal(canonical(now.state),canonical(backup));
 assert.equal(canonical(archived.state),canonical(current));
 assert.equal(now.state.operations.length,backup.operations.length);
 assert.equal(F.summary(now.state).total,F.summary(backup).total);
});
test('Un journal provenant du même espace conserve les opérations et évite les doublons',()=>{
 const shared=currentSpace(),extended=F.income(shared,{walletId:'cash',amount:4000,label:'Règlement'});
 const plan=planRestore(shared,extended);
 assert.equal(plan.mode,'merge');
 assert.equal(plan.resultingOperations,2);
 const unchanged=planRestore(extended,shared);
 assert.equal(unchanged.mode,'unchanged');
 assert.equal(unchanged.resultingOperations,2);
 assert.equal(canonical(unchanged.state),canonical(extended));
});
test('Une sauvegarde complète V2 et une sauvegarde historique simple sont reconnues',async()=>{
 const s=historicalSpace();
 const portable=await validatePortableBackup(await fullBackup(s));
 assert.equal(canonical(portable.state),canonical(s));
 assert.equal(Object.keys(portable.files).length,0);
 const legacy=await import('../lib/storage');
 const parsed=legacy.parseBackup(legacy.exportBackup(s));
 assert.equal(planRestore(F.emptyState(),parsed).resultingOperations,s.operations.length);
});
test('L’API et la migration de restauration exigent une confirmation et préservent les journaux',async()=>{
 const route=await fs.readFile('app/api/restore-initial/route.ts','utf8');
 const sql=await fs.readFile('supabase/poketra-restore-initial.sql','utf8');
 assert.match(route,/confirmation:?.*restore-initial-only|confirmation!=='restore-initial-only'/);
 assert.match(sql,/jsonb_array_length\(v_doc\.state->'operations'\)<>1/);
 assert.match(sql,/insert into public\.poketra_snapshots/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/revoke all on function public\.poketra_restore_initial_document/);
});
