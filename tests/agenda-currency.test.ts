import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../lib/finance';
import * as A from '../lib/advanced-finance';
import {agendaEvents,monthBounds,shiftMonth} from '../lib/agenda';
import {CURRENCIES,currencySupported,estimateCurrency,ariaryImpact,fmtCurrency} from '../lib/currency';

function initial(){return F.initialize(F.emptyState(),{cash:500000,mvola:150000});}
test('Calendrier : début de semaine lundi, février bissextile et changement de mois',()=>{
  assert.deepEqual(monthBounds('2028-02'),{start:'2028-02-01',end:'2028-02-29',days:29,offset:1});
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  assert.equal(shiftMonth('2026-01',-1),'2025-12');
  assert.throws(()=>monthBounds('2026-13'),/Mois/);
  assert.throws(()=>shiftMonth('2026-11',900),/invalide/);
});
test('Agenda : échéances mensuelles au dernier jour et paiements marqués réalisés',()=>{
  let s=initial();
  s=F.addObligation(s,{name:'Loyer',amount:120000,due:'2026-01-31',anchorDay:31,categoryId:'essential',recurrence:'monthly'});
  assert.equal(agendaEvents(s,'2026-02').find(e=>e.kind==='scheduled')?.date,'2026-02-28');
  assert.equal(agendaEvents(s,'2026-03').find(e=>e.kind==='scheduled')?.date,'2026-03-31');
  s={...s,obligations:s.obligations.map(o=>({...o,paidDates:['2026-02-28']}))};
  const item=agendaEvents(s,'2026-02').find(e=>e.kind==='scheduled');
  assert.equal(item?.status,'paid');
  const oldCount=s.operations.length;agendaEvents(s,'2026-02');
  assert.equal(s.operations.length,oldCount);
});
test('Agenda : date de paiement de projet = montant attendu, jamais encaissé',()=>{
  let s=initial();
  s=F.addProject(s,{name:'Étude',client:'Client',description:'',agreed:300000,expectedDate:'2026-11-24'});
  const id=s.projects[0].id;
  s=F.income(s,{walletId:'mvola',amount:80000,label:'Acompte',date:'2026-11-01',projectId:id});
  const total=F.summary(s).total;
  const events=agendaEvents(s,'2026-11');
  const project=events.find(e=>e.kind==='project');
  assert.equal(project?.amount,220000);
  assert.equal(project?.status,'planned');
  assert.equal(events.find(e=>e.kind==='income')?.amount,80000);
  assert.equal(F.summary(s).total,total);
});
test('Agenda : dépenses annulées exclues et échéances futures sans écriture',()=>{
  let s=initial();
  s=F.allocate(s,F.UNASSIGNED,'e-transport',40000);
  s=F.expense(s,{walletId:'cash',fundId:'e-transport',categoryId:'transport',amount:7000,label:'Bus',date:'2026-11-06'});
  const id=s.operations.at(-1)!.id;
  assert.equal(agendaEvents(s,'2026-11').filter(e=>e.kind==='payment').length,1);
  s=F.reverse(s,id);
  assert.equal(agendaEvents(s,'2026-11').filter(e=>e.kind==='payment').length,0);
  assert.equal(agendaEvents(s,'2026-10').length,0);
});
test('Agenda : suivi du remboursement de prêt sans créer de revenu fictif',()=>{
  let s=initial();
  s=A.addLoan(s,{name:'Avance à rembourser',person:'X',direction:'borrowed',purpose:'loan',principal:150000,due:'2026-11-28',notes:''});
  const id=s.extra!.loans[0].id;
  s=A.loanMovement(s,{loanId:id,action:'issue',walletId:'cash',amount:150000,fundId:F.UNASSIGNED});
  const events=agendaEvents(s,'2026-11');
  assert.equal(events.find(e=>e.kind==='loan')?.amount,150000);
  const before=F.summary(s).total;
  agendaEvents(s,'2026-11');
  assert.equal(F.summary(s).total,before);
});
test('Conversion : codes admis, calculs purs et estimation en Ariary',()=>{
  assert.ok(currencySupported('MGA')&&currencySupported('EUR')&&currencySupported('CNY'));
  assert.ok(!currencySupported('BTC'));
  assert.ok(CURRENCIES.length>=6);
  assert.equal(estimateCurrency(100,5000),500000);
  assert.equal(ariaryImpact(800000,100,5000,'EUR','MGA')?.remainingMGA,300000);
  assert.equal(ariaryImpact(800000,100,5000,'EUR','MGA')?.purchaseMGA,500000);
  assert.equal(ariaryImpact(800000,200000,0.0002,'MGA','EUR')?.remainingMGA,600000);
  assert.equal(ariaryImpact(800000,100,1,'EUR','USD'),null);
  assert.ok(fmtCurrency(500000,'MGA').includes('MGA'));
});
test('Conversion : ni NaN, ni taux nul, négatif, infini ou montant démesuré',()=>{
  for(const n of [Number.NaN,Infinity,-1,1e20])
    assert.throws(()=>estimateCurrency(n,5000),/invalide/);
  for(const rate of [Number.NaN,Infinity,0,-1,1e15])
    assert.throws(()=>estimateCurrency(100,rate),/invalide/);
  assert.throws(()=>estimateCurrency(1e12,1e8),/trop élevé/);
});
