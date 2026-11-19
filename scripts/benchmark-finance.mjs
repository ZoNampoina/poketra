// Execute after pnpm test; all inputs are synthetic, never user data.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as before from '../.sites-runtime/test/tests/fixtures/finance-v01.mjs';
import * as after from '../.sites-runtime/test/lib/finance.mjs';
import {upgrade} from '../.sites-runtime/test/lib/models.mjs';
const state=before.initialize(before.emptyState(),{cash:100000});
for(let i=0;i<5000;i++)state.operations.push({id:crypto.randomUUID(),kind:'income',label:'Mesure synthétique '+i,date:before.today(),createdAt:new Date().toISOString(),wallets:[{id:'cash',delta:1000}],funds:[{id:'unassigned',delta:1000}],expenses:[]});
before.validateState(state);const upgraded=upgrade(state);after.validateState(upgraded);assert.deepEqual(before.summary(state),after.summary(upgraded));
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function measure(engine,s){const cold=[],renders=[];for(let i=0;i<11;i++){const clone=structuredClone(s);let start=performance.now();engine.validateState(clone);engine.summary(clone);cold.push(performance.now()-start);start=performance.now();for(let j=0;j<100;j++){engine.summary(clone);for(const fund of clone.funds.filter(f=>f.kind==='envelope'))engine.envelopeStats(clone,fund.id);engine.autonomy(clone,300000);}renders.push(performance.now()-start);}return{loadValidationMedianMs:Math.round(median(cold)*100)/100,repeatedDashboard100MedianMs:Math.round(median(renders)*100)/100,coldSamplesMs:cold,rendersSamplesMs:renders};}
const result={environment:'Node '+process.version+', conteneur de réalisation ; pas un téléphone Android',date:new Date().toISOString(),transactions:state.operations.length,samples:11,before:measure(before,state),after:measure(after,upgraded),balancesIdentical:true};
await fs.mkdir('.sites-runtime/benchmarks',{recursive:true});await fs.writeFile('.sites-runtime/benchmarks/finance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
