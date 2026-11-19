import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
test('Le manifeste PWA déclare l’application, la devise et des icônes existantes',async()=>{const m=JSON.parse(await fs.readFile('public/manifest.webmanifest','utf8'));assert.equal(m.display,'standalone');assert.equal(m.start_url,'/');for(const icon of m.icons)assert.ok((await fs.stat('public'+icon.src)).size>0);});
test('Le service worker précache toute l’interface et reprend une navigation hors connexion',async()=>{
 const handlers=new Map<string,(event:any)=>void>(),saved=new Map<string,Response>();let offline=false,claimed=false;
 const cache={put:async(key:string,res:Response)=>{saved.set(key,res);},match:async(req:string|{url:string})=>saved.get(typeof req==='string'?req:new URL(req.url).pathname)};
 const context={self:{location:{origin:'https://poketra.test'},clients:{claim:async()=>{claimed=true;},matchAll:async()=>[]},skipWaiting:async()=>{},addEventListener:(kind:string,handler:(event:any)=>void)=>handlers.set(kind,handler)},caches:{open:async()=>cache,keys:async()=>['poketra-old'],delete:async()=>true},fetch:async(input:string|{url:string})=>{if(offline)throw new Error('No network');const path=typeof input==='string'?input:new URL(input.url).pathname;if(path==='/offline-assets.json')return Response.json(['/bundle.js']);return new Response(path==='/'?'<html>Poketra</html>':'asset',{headers:{'content-type':path==='/'?'text/html':'application/javascript'}});},URL,Response,Set};
 vm.runInNewContext(await fs.readFile('public/sw.js','utf8'),context);
 let pending:Promise<unknown>|undefined;handlers.get('install')!({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;assert.ok(saved.has('/bundle.js'));assert.ok(saved.has('/'));
 handlers.get('activate')!({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;assert.equal(claimed,true);
 offline=true;handlers.get('fetch')!({request:{method:'GET',url:'https://poketra.test/',mode:'navigate'},respondWith:(p:Promise<unknown>)=>{pending=p;}});assert.equal(await (await pending as Response).text(),'<html>Poketra</html>');
 let intercepted=false;handlers.get('fetch')!({request:{method:'POST',url:'https://poketra.test/api/pay',mode:'same-origin'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
});
