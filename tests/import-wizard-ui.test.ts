import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createElement,act} from 'react';
import * as F from '../lib/finance';
import {canonical,upgrade} from '../lib/models';
import {loadState,saveState,snapshots} from '../lib/storage';
import {exportBackup} from '../lib/storage';
const window=new Window({url:'https://poketra.test/auth/import'});
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
Object.assign(globalThis,{
 window,document:window.document,HTMLElement:window.HTMLElement,HTMLInputElement:window.HTMLInputElement,
 Event:window.Event,MouseEvent:window.MouseEvent,FormData:window.FormData,
 IS_REACT_ACT_ENVIRONMENT:true
});
const {createRoot}=await import('react-dom/client');
const {default:ImportWizard}=await import('../app/import/import-wizard');
async function clear(){await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('poketra-v1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
async function mount(){
 const container=document.createElement('div');(document.body as any).append(container);
 const root=createRoot(container);
 await act(async()=>{root.render(createElement(ImportWizard));});
 await act(async()=>{await new Promise(r=>setTimeout(r,20));});
 return{container,close:async()=>{await act(async()=>root.unmount());container.remove();}};
}
function journal(){
 let s=upgrade(F.initialize(F.emptyState(),{cash:200000,mvola:100000}));
 s=F.income(s,{walletId:'cash',amount:5000,label:'Ancien encaissement'});
 return s;
}
async function choose(container:HTMLElement,data:string,name='ancien-poketra.json'){
 const input=container.querySelector('#poketra-backup-upload') as HTMLInputElement;
 assert.ok(input,'Le sélecteur de fichier est affiché');
 const file=new window.File([data],name,{type:'application/json'});
 Object.defineProperty(input,'files',{configurable:true,value:[file]});
 await act(async()=>{input.dispatchEvent(new window.Event('change',{bubbles:true}) as any);await new Promise(r=>setTimeout(r,25));});
}

test('Import Android : cliquer sur le JSON affiche un résumé, puis restaure après confirmation',async()=>{
 await clear();
 const initial=upgrade(F.initialize(F.emptyState(),{cash:20000}));
 await saveState(initial,0);
 const view=await mount();
 assert.ok(view.container.textContent?.includes('Choisir la sauvegarde JSON'));
 await choose(view.container,exportBackup(journal()));
 assert.ok(view.container.textContent?.includes('Vérifie les données'),view.container.textContent??'');
 assert.ok(view.container.textContent?.includes('Dans le fichier'));
 assert.ok(view.container.textContent?.includes('Deux historiques financiers'));
 const oldBalance=F.summary((await loadState())!.state).total;
 assert.equal(oldBalance,20000,'La seule sélection du fichier ne modifie pas les soldes');
 const checkboxes=[...view.container.querySelectorAll('input[type=checkbox]')] as HTMLInputElement[];
 assert.equal(checkboxes.length,2);
 await act(async()=>{checkboxes[0].click();checkboxes[1].click();});
 const action=[...view.container.querySelectorAll('button')].find(b=>b.textContent?.includes('Restaurer le journal'))!;
 assert.ok(!action.hasAttribute('disabled'));
 await act(async()=>{action.click();await new Promise(r=>setTimeout(r,25));});
 const saved=(await loadState())!;
 assert.equal(saved.state.operations.length,2);
 assert.equal(F.summary(saved.state).total,F.summary(journal()).total);
 assert.ok(view.container.textContent?.includes('Importation locale terminée'),view.container.textContent??'');
 assert.ok((await snapshots()).length>=1);
 await view.close();
});
test('Import invalide : signaler l’erreur en regard du sélecteur, sans écriture',async()=>{
 await clear();
 const start=journal();
 await saveState(start,0);
 const view=await mount();
 await choose(view.container,'{bad json','invalide.json');
 assert.ok(view.container.querySelector('[role=alert]'),'Une erreur visible doit être affichée');
 assert.equal(canonical((await loadState())!.state),canonical(start));
 await view.close();
});
test('Service worker : route autonome non remplacée par l’ancien accueil caché',async()=>{
 const sw=await fs.readFile('public/sw.js','utf8');
 assert.ok(sw.includes("const BASIC=['/','/import'"));
 assert.ok(sw.includes("path==='/import'"));
 assert.ok(sw.includes("fetch(request,{cache:'no-store'})"));
 assert.ok(!sw.includes("saved=await cache.match('/');if(saved)return saved"));
 const page=await fs.readFile('app/auth/import/page.tsx','utf8');
 const security=await fs.readFile('app/security.tsx','utf8');
 assert.ok(page.includes('ImportWizard'));
 assert.ok(security.includes('href="/auth/import"'));
 assert.ok(sw.includes("url.pathname.startsWith('/auth/')"));
});
