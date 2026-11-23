import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createElement,act} from 'react';
import * as F from '../lib/finance';
import {canonical,upgrade} from '../lib/models';
import {
 loadState,saveState,snapshots,readKV,writeKV,
 type Stored,type Outbox,type SyncMeta
} from '../lib/storage';
import {previewServerRecovery,applyServerRecovery} from '../lib/recover-from-server';

const win=new Window({url:'https://poketra.test/auth/recover'});
Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
Object.assign(globalThis,{
 window:win,document:win.document,HTMLElement:win.HTMLElement,
 HTMLInputElement:win.HTMLInputElement,Event:win.Event,FormData:win.FormData,
 IS_REACT_ACT_ENVIRONMENT:true
});
const {createRoot}=await import('react-dom/client');
const {default:RecoverWizard}=await import('../app/recover/recover-wizard');
async function clear(){await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('poketra-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
function mobileOpening(){return upgrade(F.initialize(F.emptyState(),{cash:1000}));}
function historic(){
 let s=upgrade(F.initialize(F.emptyState(),{cash:100000,mvola:25000}));
 s=F.income(s,{walletId:'mvola',amount:3000,label:'Ancien versement'});
 return s;
}
const owner='8f070887-089b-43a7-b216-510481505640';
const previousFetch=globalThis.fetch;
function server(state:F.State,revision=2){
 const requests:string[]=[];
 globalThis.fetch=async(url:any,init:any={})=>{
  requests.push(String(url)+(init?.method?' '+init.method:''));
  if(String(url)==='/api/auth')return Response.json({email:'test@example.org'});
  if(String(url)==='/api/sync')return Response.json({ownerId:owner,revision,state,updatedAt:'2026-11-23T07:23:04.544Z'});
  return Response.json({error:'Introuvable'},{status:404});
 };
 return requests;
}
test('Android : le journal serveur peut être comparé et restauré sans aucune écriture distante',async()=>{
 await clear();
 const initial=mobileOpening(),remote=historic();
 await saveState(initial,0);
 const requests=server(remote);
 const review=await previewServerRecovery();
 assert.equal(review.local?.state.operations.length,1);
 assert.equal(review.remote.state.operations.length,2);
 assert.equal(review.same,false);
 assert.ok(review.localBackup?.includes('poketra-backup'));
 assert.equal((await loadState())?.state.operations.length,1);
 const recovered=await applyServerRecovery(review);
 assert.equal(recovered.state.operations.length,2);
 assert.equal(F.summary(recovered.state).total,F.summary(remote).total);
 assert.equal(canonical((await loadState())!.state),canonical(remote));
 assert.equal(await readKV<Outbox>('outbox'),null);
 assert.ok((await snapshots()).length>=1);
 const meta=await readKV<SyncMeta>('sync');
 assert.equal(meta?.status,'synced');
 assert.equal(meta?.ownerId,owner);
 assert.equal(meta?.remoteRevision,2);
 assert.deepEqual(requests,['/api/sync','/api/sync']);
 globalThis.fetch=previousFetch;
});
test('Android : un autre compte ne peut pas importer ce journal',async()=>{
 await clear();await saveState(mobileOpening(),0);
 await writeKV('sync',{status:'local',ownerId:'autre-compte',remoteRevision:0});
 server(historic());
 await assert.rejects(()=>previewServerRecovery(),/autre compte/);
 assert.equal((await loadState())!.state.operations.length,1);
 globalThis.fetch=previousFetch;
});
test('Android : une mise à jour serveur entre l’aperçu et l’action bloque tout remplacement',async()=>{
 await clear();const opening=mobileOpening();await saveState(opening,0);
 server(historic(),2);
 const preview=await previewServerRecovery();
 const changed=F.income(historic(),{walletId:'cash',amount:1000,label:'Autre opération'});
 server(changed,3);
 await assert.rejects(()=>applyServerRecovery(preview),/journal serveur a changé/);
 assert.equal(canonical((await loadState())!.state),canonical(opening));
 globalThis.fetch=previousFetch;
});
test('Android : récupération avec aucun stockage local',async()=>{
 await clear();const remote=historic();server(remote,5);
 const preview=await previewServerRecovery();
 assert.equal(preview.local,null);assert.equal(preview.localBackup,null);
 const stored=await applyServerRecovery(preview);
 assert.equal(stored.state.operations.length,remote.operations.length);
 assert.equal((await readKV<SyncMeta>('sync'))?.status,'synced');
 globalThis.fetch=previousFetch;
});
test('Page Android : connexion, historique serveur et confirmation séparée',async()=>{
 await clear();await saveState(mobileOpening(),0);server(historic(),2);
 const container=document.createElement('div');
 (document.body as any).append(container);
 const root=createRoot(container as any);
 await act(async()=>{root.render(createElement(RecoverWizard));});
 await act(async()=>{await new Promise(r=>setTimeout(r,30));});
 assert.ok(container.textContent?.includes('Récupérer depuis mon compte'));
 assert.ok(container.textContent?.includes('Les deux journaux'));
 assert.ok(container.textContent?.includes('Télécharger mes données Android actuelles'));
 assert.ok(container.textContent?.includes('Récupérer le journal sur Android'));
 assert.ok(!container.textContent?.includes('Journal récupéré'));
 await act(async()=>root.unmount());container.remove();
 globalThis.fetch=previousFetch;
});
test('La page /auth/recover contourne l’ancien service worker et reste accessible',async()=>{
 const page=await fs.readFile('app/auth/recover/page.tsx','utf8');
 const sw=await fs.readFile('public/sw.js','utf8');
 const security=await fs.readFile('app/security.tsx','utf8');
 assert.ok(page.includes('RecoverWizard'));
 assert.ok(sw.includes("url.pathname.startsWith('/auth/')"));
 assert.ok(security.includes('href="/auth/recover"'));
});
