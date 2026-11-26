import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../lib/finance';
import {forecast} from '../lib/advanced-finance';
import {addDays} from '../lib/schedule';

const initial = () => F.initialize(F.emptyState(), {cash: 150000});
type Plan = Parameters<typeof F.addObligation>[1];
function schedule(s: F.State, name: string, due: string, amount: number, options: Partial<Plan> = {}) {
  return F.addObligation(s, {name, due, amount, direction: 'income', recurrence: 'once',
    categoryId: 'other', walletId: 'cash', ...options});
}

test('Une rentrée tardive améliore la projection finale tout en laissant visible le manque avant encaissement', () => {
  const day = '2032-01-01', rentDay = addDays(day, 4), payDay = addDays(day, 12);
  let s = schedule(initial(), 'Loyer', rentDay, 200000, {direction: 'expense'});
  s = F.allocate(s, F.UNASSIGNED, 'o-' + s.obligations[0].id, 30000);
  s = schedule(s, 'Cachet', payDay, 80000, {walletId: 'mvola'});
  const before = structuredClone(s), result = forecast(s, 30, day);
  assert.equal(result.usable, 120000);
  assert.equal(result.planned, 200000);
  assert.equal(result.funded, 30000);
  assert.equal(result.unfunded, 170000);
  assert.equal(result.expectedIncome, 80000);
  assert.equal(result.projectedAvailable, 30000);
  assert.deepEqual(result.shortfall, {date: rentDay, amount: 50000});
  assert.deepEqual(result.rows.map(r => [r.name, r.direction, r.walletId]), [
    ['Loyer', 'expense', 'cash'], ['Cachet', 'income', 'mvola']
  ]);
  assert.deepEqual(s, before);
});

test('Les horizons incluent les contrats aux dates limites et respectent la fin du contrat', () => {
  const day = '2032-01-01';
  let s = schedule(initial(), 'Mensuel', '2032-01-31', 25000, {recurrence: 'monthly', endsOn: '2032-03-31'});
  s = schedule(s, 'Hebdomadaire', '2032-01-24', 10000, {recurrence: 'weekly', endsOn: '2032-02-07'});
  s = schedule(s, 'Prime', '2032-12-31', 20000);
  s = schedule(s, 'Année suivante', '2033-01-01', 1000000);
  for (const [horizon, expected] of [[30, 45000], [90, 105000], [365, 125000]]) {
    const result = forecast(s, horizon, day);
    assert.equal(result.expectedIncome, expected);
    assert.equal(result.projectedAvailable, 150000 + expected);
  }
  assert.deepEqual(forecast(s, 90, day).rows.filter(r => r.name === 'Mensuel').map(r => r.date),
    ['2032-01-31', '2032-02-29', '2032-03-31']);
});

test('Une entrée variable reste à préciser. Une validation transfère le montant vers le réel une seule fois', () => {
  const day = F.today();
  let s = schedule(initial(), 'Facturation', day, 50000);
  s = schedule(s, 'Prime variable', day, 0, {variableAmount: true});
  s = schedule(s, 'Dépense variable', day, 0, {direction: 'expense', variableAmount: true});
  const [fixed, variable] = s.obligations;
  const before = forecast(s);
  assert.equal(before.unpricedIncome, 1);
  assert.equal(before.unpricedExpense, 1);
  assert.equal(before.rows.find(r => r.name === 'Prime variable')?.amount, null);
  assert.equal(before.projectedAvailable, 200000);
  const received = F.settleObligation(s, fixed.id, 'cash', undefined, day);
  const after = forecast(received);
  assert.equal(after.expectedIncome, 0);
  assert.equal(after.usable, 200000);
  assert.equal(after.projectedAvailable, before.projectedAvailable);
  assert.equal(after.rows.some(r => r.name === fixed.name), false);
  const final = forecast(F.settleObligation(received, variable.id, 'cash', 12500, day));
  assert.equal(final.projectedAvailable, 212500);
  assert.equal(final.unpricedIncome, 0);
  assert.equal(final.expectedIncome, 0);
  const reopened = forecast(F.reverse(received, received.operations.at(-1)!.id));
  assert.equal(reopened.expectedIncome, 50000);
  assert.equal(reopened.projectedAvailable, before.projectedAvailable);
});

test('Le report et l’annulation modifient seulement les occurrences concernées', () => {
  const day = F.today(), due = addDays(day, 5), postponed = addDays(day, 45);
  let s = schedule(initial(), 'Revenu', due, 40000, {recurrence: 'weekly', endsOn: addDays(due, 7)});
  const id = s.obligations[0].id;
  s = F.changeOccurrence(s, id, due, 'postpone', postponed);
  assert.deepEqual(forecast(s, 30).rows.map(r => r.date), [addDays(due, 7)]);
  assert.equal(forecast(s, 90).expectedIncome, 80000);
  s = F.changeOccurrence(s, id, due, 'skip');
  assert.equal(forecast(s, 90).expectedIncome, 40000);
  s = F.changeOccurrence(s, id, s.obligations[0].due, 'stop');
  assert.equal(forecast(s, 90).rows.length, 0);
  assert.equal(F.summary(s).total, 150000);
});

test('Les mouvements du même jour et les retards sont regroupés avant de calculer le manque', () => {
  const day = F.today();
  let s = schedule(initial(), 'Facture', addDays(day, -1), 180000, {direction: 'expense'});
  s = schedule(s, 'Versement', day, 35000);
  const result = forecast(s);
  assert.equal(result.rows[0].date, addDays(day, -1));
  assert.equal(result.projectedAvailable, 5000);
  assert.equal(result.shortfall, null);
});
