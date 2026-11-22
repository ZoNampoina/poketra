import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../lib/finance';
import {splitExpense} from '../lib/advanced-finance';
import {canonical} from '../lib/models';
import {evaluateScenario,localInsights,suggestExpenseCategory} from '../lib/decision-support';

function ready() {
  let s=F.initialize(F.emptyState(),{cash:500000,mvola:200000});
  s=F.allocate(s,F.UNASSIGNED,F.RESERVE,100000);
  s={...s,settings:{...s.settings,essentialMonthly:300000,reserveTarget:150000}};
  F.validateState(s);
  return s;
}
test('Le scénario ne modifie ni les écritures, ni les soldes, ni les affectations',()=>{
  const s=ready(),previous=canonical(s),summary=F.summary(s);
  const result=evaluateScenario(s,{purchase:50000,extraEssentialMonthly:0,horizon:30});
  assert.equal(result.usableToday,600000);
  assert.equal(result.afterPurchase,550000);
  assert.equal(result.daysOfEssentialNeeds,55);
  assert.equal(result.reserveUntouched,100000);
  assert.equal(result.freeAfterUnfunded,550000);
  assert.equal(result.gap,0);
  assert.deepEqual(F.summary(s),summary);
  assert.equal(canonical(s),previous);
});
test('Les échéances non provisionnées diminuent seulement la projection',()=>{
  let s=ready();
  s=F.addObligation(s,{name:'Facture test',amount:100000,due:F.today(),categoryId:'essential',recurrence:'once'});
  const before=F.summary(s).total,ledger=canonical(s.operations);
  const result=evaluateScenario(s,{purchase:550000,extraEssentialMonthly:0,horizon:30});
  assert.equal(result.unfundedCommitments,100000);
  assert.equal(result.afterPurchase,50000);
  assert.equal(result.freeAfterUnfunded,0);
  assert.equal(result.gap,50000);
  assert.equal(F.summary(s).total,before);
  assert.equal(canonical(s.operations),ledger);
});
test('Une provision existante n’est pas déduite deux fois',()=>{
  let s=ready();
  s=F.addObligation(s,{name:'Échéance provisionnée',amount:100000,due:F.today(),categoryId:'essential',recurrence:'once'});
  const id=s.obligations[0].id;
  s=F.allocate(s,F.UNASSIGNED,'o-'+id,60000);
  const result=evaluateScenario(s,{purchase:500000,extraEssentialMonthly:0,horizon:30});
  assert.equal(result.alreadyProvisioned,60000);
  assert.equal(result.unfundedCommitments,40000);
  assert.equal(result.usableToday,540000);
  assert.equal(result.afterPurchase,40000);
  assert.equal(result.gap,0);
  assert.equal(result.freeAfterUnfunded,0);
});
test('La variation de besoin mensuel affecte l’autonomie mais pas le journal',()=>{
  const s=ready(),before=canonical(s);
  const result=evaluateScenario(s,{purchase:0,extraEssentialMonthly:300000,horizon:90});
  assert.equal(result.daysOfEssentialNeeds,30);
  assert.equal(result.estimatedEssentialMonthly,600000);
  assert.equal(F.summary(s).total,700000);
  assert.equal(canonical(s),before);
});
test('Le simulateur refuse les sommes dangereuses, négatives et décimales',()=>{
  const s=ready();
  for(const purchase of [-1,1.1,Number.NaN,Infinity,Number.MAX_SAFE_INTEGER+1])
    assert.throws(()=>evaluateScenario(s,{purchase,extraEssentialMonthly:0,horizon:30}),/entier/);
  assert.throws(()=>evaluateScenario(s,{purchase:0,extraEssentialMonthly:-10,horizon:30}),/entier/);
  assert.throws(()=>evaluateScenario(s,{purchase:0,extraEssentialMonthly:0,horizon:31 as 30}),/Horizon/);
});
test('Catégorisation : seulement si deux dépenses actives partagent un libellé et une catégorie',()=>{
  let s=ready();
  assert.equal(suggestExpenseCategory(s,'Taxi'),null);
  s=F.allocate(s,F.UNASSIGNED,'e-transport',70000);
  s=F.expense(s,{walletId:'cash',fundId:'e-transport',categoryId:'transport',amount:10000,label:'Taxi'});
  assert.equal(suggestExpenseCategory(s,'Taxi'),null);
  s=F.expense(s,{walletId:'cash',fundId:'e-transport',categoryId:'transport',amount:9000,label:'TAXI'});
  const hint=suggestExpenseCategory(s,'  Táxi ! ');
  assert.equal(hint?.categoryId,'transport');
  assert.equal(hint?.matchingOperations,2);
  const id=s.operations.at(-1)!.id;
  s=F.reverse(s,id);
  assert.equal(suggestExpenseCategory(s,'Taxi'),null);
});
test('Des catégories contradictoires ne produisent pas de suggestion',()=>{
  let s=ready();
  s=F.allocate(s,F.UNASSIGNED,'e-transport',40000);
  s=F.allocate(s,F.UNASSIGNED,'e-free',40000);
  for(const amount of [5000,6000])s=F.expense(s,{walletId:'cash',fundId:'e-transport',categoryId:'transport',amount,label:'Taxi'});
  s=F.expense(s,{walletId:'cash',fundId:'e-free',categoryId:'free',amount:5000,label:'Taxi'});
  assert.equal(suggestExpenseCategory(s,'Taxi'),null);
  assert.equal(suggestExpenseCategory(s,''),null);
});
test('Les repères locaux n’effectuent aucune opération et signalent les engagements insuffisants',()=>{
  let s=ready();
  s=F.addObligation(s,{name:'Échéance importante',amount:650000,due:F.today(),categoryId:'essential',recurrence:'once'});
  const before=canonical(s);
  const hints=localInsights(s,30);
  assert.ok(hints.some(h=>h.id==='commitments'&&h.severity==='attention'));
  assert.ok(hints.some(h=>h.id==='reserve'));
  assert.equal(canonical(s),before);
});

test('Une dépense ventilée entre plusieurs catégories rend la suggestion ambiguë',()=>{
  let s=ready();
  s=F.allocate(s,F.UNASSIGNED,'e-transport',50000);
  s=F.allocate(s,F.UNASSIGNED,'e-free',10000);
  for(const amount of [5000,6000])s=F.expense(s,{walletId:'cash',fundId:'e-transport',categoryId:'transport',amount,label:'Taxi'});
  s=splitExpense(s,{walletId:'cash',amount:6000,label:'Taxi',parts:[
    {amount:5000,categoryId:'transport',fundId:'e-transport'},
    {amount:1000,categoryId:'free',fundId:'e-free'}
  ]});
  assert.equal(suggestExpenseCategory(s,'Taxi'),null);
});
