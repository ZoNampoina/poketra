import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../lib/finance';
import {forecast} from '../lib/advanced-finance';
import {agendaEvents} from '../lib/agenda';
import {mergeStates} from '../lib/merge';
import {advancePlan,isPending,occurrenceDate,reminderAt} from '../lib/schedule';
import {trustedPushEndpoint,validPushKeys} from '../lib/push-subscription';
const start=()=>F.initialize(F.emptyState(),{cash:500000});
function planned(extra:Partial<F.Obligation>={}){
  return F.addObligation(start(),{direction:'income',name:'Cachet',walletId:'mvola',amount:90000,
    categoryId:'other',recurrence:'weekly',due:'2026-10-02',...extra});
}
test('Un contrat hebdomadaire produit une seule entrée par validation et finit au dernier vendredi inclus',()=>{
  const s=planned({endsOn:'2026-10-09'}),p=s.obligations[0];
  assert.deepEqual(F.summary(s),F.summary(start()));assert.equal(forecast(s).unfunded,0);
  assert.deepEqual(agendaEvents(s,'2026-10').filter(x=>x.kind==='expectedIncome').map(x=>x.date),['2026-10-02','2026-10-09']);
  const first=F.settleObligation(s,p.id,'mvola',undefined,p.due);
  assert.equal(F.balances(first,'wallets').mvola,90000);
  assert.throws(()=>F.settleObligation(first,p.id,'mvola',undefined,p.due));
  const second=F.settleObligation(first,p.id,'mvola',undefined,'2026-10-09');
  assert.equal(F.balances(second,'wallets').mvola,180000);assert.equal(isPending(second.obligations[0]),false);
  const undo=F.reverse(second,second.operations.at(-1)!.id);
  assert.equal(isPending(undo.obligations[0]),true);assert.equal(undo.obligations[0].due,'2026-10-09');
  const retry=F.settleObligation(undo,p.id,'mvola');assert.equal(F.balances(retry,'wallets').mvola,180000);
});
test('Un montant variable exige le montant réel. L’encaissement alimente le projet et passe dans l’historique',()=>{
  const base=F.addProject(start(),{name:'Concert',client:'Client',agreed:200000,description:''});
  const s=F.addObligation(base,{name:'Solde concert',direction:'income',projectId:base.projects[0].id,
    amount:0,variableAmount:true,walletId:'cash',due:F.today(),recurrence:'once',categoryId:'other'});
  const p=s.obligations[0];assert.throws(()=>F.settleObligation(s,p.id,'cash'));
  const posted=F.settleObligation(s,p.id,'cash',150000);
  assert.equal(F.projectSummary(posted,base.projects[0].id).received,150000);
  const events=agendaEvents(posted,F.today().slice(0,7)).filter(e=>e.title==='Solde concert');
  assert.equal(events.length,1);assert.equal(events[0].status,'recorded');
});
test('Rappeler, reporter et annuler conservent les soldes et l’ancrage mensuel',()=>{
  const s=planned({due:'2028-01-31',recurrence:'monthly'}),p=s.obligations[0];
  assert.equal(reminderAt(p),'2028-01-31T06:00:00.000Z');
  const later=new Date(Date.now()+3600000).toISOString();
  const snoozed=F.changeOccurrence(s,p.id,p.due,'snooze',later);
  assert.equal(snoozed.obligations[0].due,p.due);assert.equal(reminderAt(snoozed.obligations[0]),later);
  const postponed=F.changeOccurrence(snoozed,p.id,p.due,'postpone','2028-02-05');
  assert.equal(occurrenceDate(postponed.obligations[0]),p.due);
  const skipped=F.changeOccurrence(postponed,p.id,p.due,'skip');
  assert.equal(skipped.obligations[0].due,'2028-02-29');assert.equal(advancePlan(skipped.obligations[0],false).due,'2028-03-31');
  const stopped=F.changeOccurrence(skipped,p.id,'2028-02-29','stop');
  assert.equal(isPending(stopped.obligations[0]),false);assert.deepEqual(stopped.operations,s.operations);
});
test('Dépense variable : provision partielle, complément explicite et refus atomique du découvert',()=>{
  let s=planned({direction:'expense',variableAmount:true,amount:0,walletId:'cash',useAvailable:true});
  const p=s.obligations[0];s=F.allocate(s,F.UNASSIGNED,'o-'+p.id,30000);
  const paid=F.settleObligation(s,p.id,'cash',50000,p.due);assert.equal(F.summary(paid).total,450000);
  assert.equal(F.summary(paid).committed,0);assert.equal(paid.operations.length,s.operations.length+1);
  assert.throws(()=>F.settleObligation(s,p.id,'cash',550000,p.due));assert.equal(s.obligations[0].due,p.due);
});
test('Deux appareils confirment une occurrence : dédoublonnage ou conflit explicite de montant',()=>{
  const s=planned({variableAmount:true,amount:0}),p=s.obligations[0];
  const a=F.settleObligation(s,p.id,'mvola',5000),b=F.settleObligation(s,p.id,'mvola',5000);
  assert.equal(F.balances(mergeStates(s,a,b),'wallets').mvola,5000);
  assert.throws(()=>mergeStates(s,a,F.settleObligation(s,p.id,'mvola',6000)),/validations différentes/);
});
test('Le service de rappels ne contacte que les fournisseurs Push prévus',()=>{
  assert.equal(trustedPushEndpoint('https://fcm.googleapis.com/fcm/send/demo'),true);
  assert.equal(trustedPushEndpoint('https://fcm.googleapis.com.example.org/send/test'),false);
  assert.equal(trustedPushEndpoint('http://localhost/test'),false);
  assert.equal(validPushKeys({p256dh:'a'.repeat(87),auth:'b'.repeat(22)}),true);
});
