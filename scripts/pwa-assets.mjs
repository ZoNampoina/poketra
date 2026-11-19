import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
async function walk(dir){const result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await walk(file));else result.push(file);}return result;}
const staticRoot=path.resolve('.next/static'),publicRoot=path.resolve('public');
const staticFiles=(await walk(staticRoot)).filter(f=>/\.(js|css|woff2?)$/.test(f));
const publicFiles=(await walk(publicRoot)).filter(f=>/\.(png|svg|webmanifest|md)$/.test(f));
const assets=[...staticFiles.map(f=>'/_next/static/'+path.relative(staticRoot,f).split(path.sep).join('/')),
  ...publicFiles.map(f=>'/'+path.relative(publicRoot,f).split(path.sep).join('/'))].sort();
const hash=crypto.createHash('sha256');
const original=(await fs.readFile('public/sw.js','utf8')).replace(/const CACHE='poketra-[^']*';/,"const CACHE='poketra-__BUILD__';");
hash.update(original);for(const file of [...staticFiles,...publicFiles].sort())hash.update(await fs.readFile(file));
const build=hash.digest('hex').slice(0,16);
await fs.writeFile('public/offline-assets.json',JSON.stringify(assets));
await fs.writeFile('public/sw.js',original.replace('__BUILD__',build));
console.log(JSON.stringify({offlineAssets:assets.length,cacheVersion:build}));
