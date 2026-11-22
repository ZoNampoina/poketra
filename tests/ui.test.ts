import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createElement,act} from 'react';
import {upgrade,patchExtra} from '../lib/models';
import * as F from '../lib/finance';
import {saveState,loadState,readKV} from '../lib/storage';
const window=new Window({url:'https://poketra.test'});
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,HTMLInputElement:window.HTMLInputElement,Event:window.Event,MouseEvent:window.MouseEvent,PopStateEvent:window.PopStateEvent,FormData:window.FormData,localStorage:window.localStorage,sessionStorage:window.sessionStorage,history:window.history,matchMedia:window.matchMedia.bind(window),IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
const {default:QuickEntry}=await import('../app/quick-entry');
const {default:Poketra}=await import('../app/poketra');
const {duplicateDraft}=await import('../app/record-detail');
const {splitExpense}=await import('../lib/advanced-finance');
function initial(){let s=upgrade(F.initialize(F.emptyState(),{cash:100000,mvola:200000}));s=F.allocate(s,F.UNASSIGNED,'e-essential',100000);return s;}
async function mount(Component:any,props:any={}){const container=document.createElement('div');(document.body as any).append(container);const root=createRoot(container as any);await act(async()=>{root.render(createElement(Component,props));});return{container,root,async close(){await act(async()=>root.unmount());container.remove();}};}
test('Saisie favorite : le montant reste à vérifier et rien ne s’enregistre à l’ouverture',async()=>{const s=initial();let commits=0;const view=await mount(QuickEntry,{s,type:'expense',draft:{amount:5000,walletId:'cash',categoryId:'essential',label:'Transport habituel'},commit:async()=>{commits++;return true;},busy:false});assert.equal(commits,0);assert.equal((view.container.querySelector('[name=amount]') as unknown as HTMLInputElement).value,'5000');assert.ok(view.container.textContent!.includes('Enregistrer et fermer'));await view.close();});
test('Enregistrer et nouveau : une seule opération est créée et le montant est vidé',async()=>{let committed:F.State|undefined,stay:boolean|undefined;const view=await mount(QuickEntry,{s:initial(),type:'expense',draft:{amount:5000,walletId:'cash',categoryId:'essential',label:'Courses'},commit:async(s:F.State,_msg:string,keep:boolean)=>{committed=s;stay=keep;return true;},busy:false});const form=view.container.querySelector('form')!,button=view.container.querySelector('button[name=again]')!;await act(async()=>{form.dispatchEvent(new window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button as any}) as any);});assert.equal(stay,true);assert.equal(committed!.operations.length,3);assert.equal(F.summary(committed!).wallets.cash,95000);assert.equal((view.container.querySelector('[name=amount]') as unknown as HTMLInputElement).value,'');await view.close();});
test('L’application ouvre l’ancien espace sans réinitialiser les portefeuilles',async()=>{await new Promise<void>((resolve)=>{const r=indexedDB.deleteDatabase('poketra-v1');r.onsuccess=()=>resolve();});const old=F.initialize(F.emptyState(),{mvola:123456,cash:76543});await saveState(old,0);const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({error:'Hors connexion simulée'}),{status:503,headers:{'content-type':'application/json'}});const view=await mount(Poketra);await act(async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,10));});assert.ok(view.container.textContent!.includes('Tes finances'));
assert.ok(view.container.textContent!.includes('poketra’ko'));const after=(await loadState())!;assert.equal(F.summary(after.state).wallets.mvola,123456);assert.equal(F.summary(after.state).wallets.cash,76543);assert.ok(await readKV('checkpoint:before-v11'));await view.close();globalThis.fetch=originalFetch;});
test('Dupliquer une dépense conserve le principal et les frais séparément',()=>{let s=initial();s=F.allocate(s,F.UNASSIGNED,'e-financial',10000);s=splitExpense(s,{walletId:'cash',amount:5000,parts:[{amount:5000,categoryId:'essential',fundId:'e-essential'}],fee:1000});const draft=duplicateDraft(s,s.operations.at(-1)!.id);assert.equal(draft.amount,5000);assert.equal(draft.fee,1000);assert.equal(draft.parts,undefined);});
