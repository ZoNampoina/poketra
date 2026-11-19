import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root='.sites-runtime/test';
async function walk(dir){let files=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())files.push(...await walk(file));else if(/\.tsx?$/.test(file))files.push(file);}return files;}
const files=[...await walk('lib'),...await walk('app'),...await walk('tests')];
for(const file of files){const target=root+'/'+file.replace(/\.tsx?$/,'.mjs');await fs.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});const original=(await fs.readFile(file,'utf8')).replace(/(['"])@\/([^'"]+)\1/g,(_,q,p)=>q+path.relative(path.dirname(file),p).replaceAll('\\','/').replace(/^(?!\.)/,'./')+q);const modulePath=p=>/\.(mjs|js|json)$/.test(p)?p:p+'.mjs';const src=original.replace(/from (['"])(\.\.?\/[^'"]+)\1/g,(_,q,p)=>'from '+q+modulePath(p)+q).replace(/import\((['"])(\.\.?\/[^'"]+)\1\)/g,(_,q,p)=>'import('+q+modulePath(p)+q+')');const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;await fs.writeFile(target,code);}
const tests=files.filter(f=>f.endsWith('.test.ts')).map(f=>root+'/'+f.replace(/\.tsx?$/,'.mjs'));
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});process.exit(result.status??1);
