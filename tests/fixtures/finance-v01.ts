export type Kind = 'opening' | 'income' | 'expense' | 'transfer' | 'allocation' | 'reversal';
export type Wallet = { id: string; name: string; group: 'mobile' | 'cash' | 'bank'; color: string };
export type Category = { id: string; name: string; color: string; icon: string; essential: boolean; children: string[] };
export type Fund = { id: string; name: string; kind: 'unassigned' | 'reserve' | 'envelope' | 'provision'; categoryId?: string; projectId?: string; obligationId?: string };
export type Project = { id: string; name: string; client: string; description: string; agreed: number; created: string };
export type Obligation = { id: string; name: string; amount: number; due: string; categoryId: string; recurrence: 'once' | 'monthly'; paidDates: string[] };
export type Entry = { id: string; delta: number };
export type ExpenseLine = { amount: number; categoryId: string; fundId: string; projectId?: string; subcategory?: string; beneficiary?: string; label: string };
export type Operation = { id: string; createdAt: string; date: string; kind: Kind; label: string; wallets: Entry[]; funds: Entry[]; expenses: ExpenseLine[]; projectId?: string; beneficiary?: string; reversalOf?: string; obligationId?: string; obligationDue?: string; reserveAuthorized?: boolean };
export type State = { version: 1; wallets: Wallet[]; categories: Category[]; funds: Fund[]; projects: Project[]; obligations: Obligation[]; operations: Operation[]; settings: { reserveTarget: number; essentialMonthly: number; name: string }; initialized: boolean };
export const UNASSIGNED = 'unassigned';
export const RESERVE = 'reserve';
export const FINANCIAL = 'financial';
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Indian/Antananarivo' });
export const money = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' Ar';
const validDate = (d: string) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d+'T12:00:00Z').getTime()) && new Date(d+'T12:00:00Z').toISOString().slice(0,10) === d;
export function amount(v: unknown, positive = true): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s\u00a0\u202f]/g, ''));
  if (!Number.isSafeInteger(n) || (positive ? n <= 0 : n < 0)) throw new Error('Saisis un montant entier en Ariary' + (positive ? ', supérieur à zéro.' : '.'));
  return n;
}
export function emptyState(): State {
  const categories: Category[] = [
    { id: 'essential', name: 'Essentielles', color: '#3b8664', icon: 'home', essential: true, children: ['Alimentation', 'Logement', 'Factures'] },
    { id: 'personal', name: 'Personnelles', color: '#8d76b5', icon: 'user', essential: false, children: ['Vêtements', 'Coiffure', 'Achats personnels'] },
    { id: 'family', name: 'Famille', color: '#e5a057', icon: 'heart', essential: false, children: ['Parents', 'Frères et sœurs', 'Voiture familiale', 'Aides'] },
    { id: 'free', name: 'Libres', color: '#759eca', icon: 'coffee', essential: false, children: ['Loisirs', 'Sorties', 'Divertissements'] },
    { id: 'transport', name: 'Transport', color: '#cfb057', icon: 'car', essential: true, children: ['Carburant', 'Taxi', 'Bus'] },
    { id: 'health', name: 'Santé et éducation', color: '#bf7b8e', icon: 'medical', essential: true, children: ['Soins', 'Médicaments', 'Formation'] },
    { id: FINANCIAL, name: 'Frais financiers', color: '#8c9a90', icon: 'bank', essential: false, children: ['Retrait', 'Transfert', 'Banque'] },
    { id: 'other', name: 'Imprévus et autres', color: '#ac9480', icon: 'sparkles', essential: false, children: ['Imprévu', 'Autre'] },
  ];
  return { version: 1, initialized: false,
    wallets: [{ id: 'mvola', name: 'MVola', group: 'mobile', color: '#e5bb36' }, { id: 'orange', name: 'Orange Money', group: 'mobile', color: '#ee8841' }, { id: 'airtel', name: 'Airtel Money', group: 'mobile', color: '#cf5757' }, { id: 'cash', name: 'Espèces', group: 'cash', color: '#618b70' }, { id: 'bank', name: 'Banque', group: 'bank', color: '#618cb0' }],
    categories, funds: [{ id: UNASSIGNED, name: 'Non attribué', kind: 'unassigned' }, { id: RESERVE, name: 'Réserve de sécurité', kind: 'reserve' }, ...categories.map(c => ({ id: 'e-' + c.id, name: c.name, kind: 'envelope' as const, categoryId: c.id }))],
    projects: [], obligations: [], operations: [], settings: { reserveTarget: 0, essentialMonthly: 0, name: 'Mon espace' },
  };
}
function checkedSum(values: number[]): number {
  let result = 0;
  for (const value of values) { result += value; if (!Number.isSafeInteger(result)) throw new Error('Montant total trop élevé.'); }
  return result;
}
export const sum = checkedSum;
export function balances(s: State, axis: 'wallets' | 'funds'): Record<string, number> {
  const result = Object.fromEntries(s[axis].map(x => [x.id, 0]));
  for (const op of s.operations) for (const e of op[axis]) result[e.id] = checkedSum([result[e.id] ?? 0, e.delta]);
  return result;
}
export function summary(s: State) {
  const w = balances(s, 'wallets'), f = balances(s, 'funds');
  const total = checkedSum(Object.values(w));
  const budget = checkedSum(s.funds.filter(x => x.kind === 'envelope').map(x => f[x.id]));
  const committed = checkedSum(s.funds.filter(x => x.kind === 'provision').map(x => f[x.id]));
  return { wallets: w, funds: f, total, budget, reserve: f[RESERVE], unassigned: checkedSum(s.funds.filter(x=>x.kind==='unassigned').map(x=>f[x.id])), committed, usable: total - f[RESERVE] - committed };
}
export function validateState(s: State): void {
  if (s.version !== 1 || !Array.isArray(s.operations) || !s.settings) throw new Error('Sauvegarde incompatible.');
  for (const axis of ['wallets', 'funds', 'categories', 'projects', 'obligations'] as const) {
    if (!Array.isArray(s[axis]) || new Set(s[axis].map(x => x.id)).size !== s[axis].length || s[axis].some(x => !x.id || typeof x.name !== 'string')) throw new Error('Structure de données invalide.');
  }
  if (!s.funds.some(x => x.id === UNASSIGNED && x.kind === 'unassigned') || !s.funds.some(x => x.id === RESERVE && x.kind === 'reserve')) throw new Error('Réserve ou fonds non attribué manquant.');
  amount(s.settings.reserveTarget, false); amount(s.settings.essentialMonthly, false);
  if (typeof s.settings.name !== 'string' || typeof s.initialized !== 'boolean') throw new Error('Paramètres invalides.');
  for (const w of s.wallets) if (!['mobile','cash','bank'].includes(w.group) || !/^#[a-fA-F0-9]{6}$/.test(w.color)) throw new Error('Portefeuille invalide.');
  for (const c of s.categories) if (!Array.isArray(c.children) || c.children.some(v=>typeof v!=='string') || !/^#[a-fA-F0-9]{6}$/.test(c.color) || typeof c.icon!=='string' || typeof c.essential!=='boolean') throw new Error('Catégorie invalide.');
  for (const p of s.projects) { amount(p.agreed, false); if (typeof p.client!=='string' || typeof p.description!=='string' || !validDate(p.created)) throw new Error('Projet invalide.'); }
  for (const o of s.obligations) { amount(o.amount); if (!validDate(o.due) || !['once','monthly'].includes(o.recurrence) || !Array.isArray(o.paidDates) || o.paidDates.some(d=>!validDate(d)) || !s.categories.some(c=>c.id===o.categoryId)) throw new Error('Échéance invalide.'); }
  for (const f of s.funds) if (!['unassigned','reserve','envelope','provision'].includes(f.kind) || (f.kind==='envelope'&&!s.categories.some(c=>c.id===f.categoryId)) || (f.projectId&&!s.projects.some(p=>p.id===f.projectId)) || (f.obligationId&&!s.obligations.some(o=>o.id===f.obligationId))) throw new Error('Affectation invalide.');
  for (const id of ['mvola','orange','airtel','cash','bank']) if(!s.wallets.some(w=>w.id===id)) throw new Error('Portefeuille principal manquant.');
  for (const id of ['essential','personal','family','free','transport','health','financial','other']) if(!s.categories.some(c=>c.id===id)) throw new Error('Catégorie principale manquante.');
  for (const c of s.categories) if(!s.funds.some(f=>f.id==='e-'+c.id&&f.kind==='envelope'&&f.categoryId===c.id)) throw new Error('Enveloppe principale manquante.');
  for (const p of s.projects) if(!s.funds.some(f=>f.id==='p-'+p.id&&f.kind==='provision'&&f.projectId===p.id)||!s.funds.some(f=>f.id==='u-p-'+p.id&&f.kind==='unassigned'&&f.projectId===p.id)) throw new Error('Fonds de projet manquant.');
  if (s.funds.filter(f=>f.kind==='reserve').length!==1) throw new Error('Réserve dupliquée.');
  const w = Object.fromEntries(s.wallets.map(x => [x.id, 0])), f = Object.fromEntries(s.funds.map(x => [x.id, 0]));
  const seen = new Map<string, Operation>();
  const reversed = new Set<string>();
  for (const op of s.operations) {
    if (!op.id || seen.has(op.id) || !['opening','income','expense','transfer','allocation','reversal'].includes(op.kind)) throw new Error('Écriture dupliquée ou invalide.');
    if (!validDate(op.date) || typeof op.label!=='string' || typeof op.createdAt!=='string' || !Array.isArray(op.wallets) || !Array.isArray(op.funds) || !Array.isArray(op.expenses)) throw new Error('Écriture invalide.');
    if (op.projectId && !s.projects.some(p => p.id === op.projectId)) throw new Error('Projet introuvable.');
    for (const [axis, ledger] of [['wallets', w], ['funds', f]] as const) {
      for (const e of op[axis]) {
        if (!Object.hasOwn(ledger,e.id) || !Number.isSafeInteger(e.delta)) throw new Error('Référence ou montant invalide.');
        ledger[e.id] = checkedSum([ledger[e.id], e.delta]);
      }
      if (Object.values(ledger).some(v => v < 0)) throw new Error(axis === 'wallets' ? 'Solde du portefeuille insuffisant.' : 'Fonds insuffisants. Réaffecte de l’argent avant cette opération.');
    }
    if (checkedSum(op.wallets.map(e => e.delta)) !== checkedSum(op.funds.map(e => e.delta))) throw new Error('Les écritures ne sont pas équilibrées.');
    for (const e of op.expenses) {
      amount(e.amount); if (!s.categories.some(c => c.id === e.categoryId) || !s.funds.some(x => x.id === e.fundId)) throw new Error('Catégorie ou fonds inconnu.');
      if (e.projectId && !s.projects.some(p => p.id === e.projectId)) throw new Error('Projet de dépense inconnu.');
    }
    if (op.kind === 'reversal') {
      const original = seen.get(op.reversalOf ?? '');
      if (!original || original.kind === 'reversal' || reversed.has(original.id) || op.expenses.length) throw new Error('Annulation invalide.');
      for (const axis of ['wallets', 'funds'] as const) if (JSON.stringify(op[axis]) !== JSON.stringify(original[axis].map(e => ({ ...e, delta: -e.delta })))) throw new Error('Contre-écriture incorrecte.');
      reversed.add(original.id);
    } else {
      const spent = checkedSum(op.expenses.map(e => e.amount)), net = checkedSum(op.wallets.map(e => e.delta));
      if ((op.kind === 'expense' || op.kind === 'transfer') && net !== -spent) throw new Error('Dépenses et mouvements incohérents.');
      if (op.kind === 'allocation' && (op.wallets.length || checkedSum(op.funds.map(e => e.delta)) !== 0 || spent)) throw new Error('Réallocation incohérente.');
      if ((op.kind === 'income' || op.kind === 'opening') && (net < 0 || spent)) throw new Error('Entrée incohérente.');
      if (op.kind==='opening' && (seen.size || op.wallets.some(e=>e.delta<0) || op.funds.length!==1 || op.funds[0].id!==UNASSIGNED)) throw new Error('Solde initial incohérent.');
      if (op.kind==='income' && (net<=0 || op.wallets.length!==1 || op.funds.length!==1 || s.funds.find(f=>f.id===op.funds[0].id)?.kind!=='unassigned')) throw new Error('Revenu incohérent.');
      if (op.kind==='expense' && (op.wallets.length!==1 || op.wallets[0].delta>=0 || !op.expenses.length)) throw new Error('Dépense incohérente.');
      if (op.kind==='transfer' && (op.wallets.length!==2 || op.wallets[0].id===op.wallets[1].id || op.wallets[0].delta>=0 || op.wallets[1].delta<=0 || op.expenses.some(e=>e.categoryId!==FINANCIAL))) throw new Error('Transfert incohérent.');
      if (op.kind==='allocation' && (op.funds.length!==2 || op.funds[0].id===op.funds[1].id || op.funds[0].delta>=0 || op.funds[1].delta<=0)) throw new Error('Réaffectation incohérente.');
      if (op.kind==='expense' || op.kind==='transfer') {
        const used:Record<string,number>={}; for(const e of op.expenses) used[e.fundId]=(used[e.fundId]||0)-e.amount;
        const debits:Record<string,number>={}; for(const e of op.funds) debits[e.id]=(debits[e.id]||0)+e.delta;
        if (Object.keys(used).length!==Object.keys(debits).length || Object.entries(used).some(([id,v])=>debits[id]!==v)) throw new Error('Affectations de dépenses incohérentes.');
      }
      if (op.funds.some(e=>e.id===RESERVE&&e.delta<0) && !op.reserveAuthorized) throw new Error('Utilisation de réserve non confirmée.');
    }
    seen.set(op.id, op);
  }
  if (checkedSum(Object.values(w)) !== checkedSum(Object.values(f))) throw new Error('Trésorerie incohérente.');
}
function base(kind: Kind, label: string, date = today()): Operation {
  if (!label.trim()) throw new Error('Ajoute un libellé.');
  if (date > today()) throw new Error('Une opération réelle ne peut pas être datée dans le futur. Utilise une obligation pour une échéance.');
  return { id: uid(), createdAt: new Date().toISOString(), date, kind, label: label.trim(), wallets: [], funds: [], expenses: [] };
}
function append(s: State, op: Operation): State {
  if (s.operations.some(x => x.id === op.id)) return s;
  const next = { ...s, operations: [...s.operations, op] };
  validateState(next); return next;
}
export function initialize(s: State, values: Record<string, number>): State {
  if (s.initialized || s.operations.length) throw new Error('Les soldes initiaux sont déjà enregistrés.');
  const op = base('opening', 'Soldes de départ');
  op.wallets = s.wallets.map(w => ({ id: w.id, delta: amount(values[w.id] ?? 0, false) })).filter(e => e.delta);
  op.funds = [{ id: UNASSIGNED, delta: checkedSum(op.wallets.map(x => x.delta)) }];
  return { ...append(s, op), initialized: true };
}
export function income(s: State, args: { walletId: string; amount: number; label: string; date?: string; projectId?: string }): State {
  const n = amount(args.amount), op = base('income', args.label, args.date);
  op.wallets = [{ id: args.walletId, delta: n }]; op.funds = [{ id: args.projectId ? 'u-p-'+args.projectId : UNASSIGNED, delta: n }]; op.projectId = args.projectId;
  return append(s, op);
}
export function allocate(s: State, from: string, to: string, value: number, confirmed = false): State {
  const n = amount(value); if (from === to) throw new Error('Choisis deux affectations différentes.');
  if (from === RESERVE && !confirmed) throw new Error('Confirme l’utilisation de la réserve protégée.');
  const a = s.funds.find(f => f.id === from), b = s.funds.find(f => f.id === to);
  if (!a || !b) throw new Error('Affectation inconnue.');
  const op = base('allocation', a.name + ' → ' + b.name); op.funds = [{ id: from, delta: -n }, { id: to, delta: n }]; if(from===RESERVE)op.reserveAuthorized=true;
  return append(s, op);
}
export function expense(s: State, args: { walletId: string; fundId: string; categoryId: string; amount: number; label: string; date?: string; projectId?: string; beneficiary?: string; subcategory?: string; reserveConfirmed?: boolean }): State {
  const n = amount(args.amount), fund = s.funds.find(f => f.id === args.fundId);
  if (!fund || fund.kind === 'unassigned') throw new Error('Attribue d’abord l’argent à une enveloppe ou à une provision.');
  if (fund.kind === 'envelope' && fund.categoryId !== args.categoryId) throw new Error('La catégorie doit correspondre à l’enveloppe.');
  if (fund.projectId && fund.projectId !== args.projectId) throw new Error('Cette provision appartient à un autre projet.');
  if (fund.kind === 'reserve' && !args.reserveConfirmed) throw new Error('Confirme l’utilisation de la réserve protégée.');
  const op = base('expense', args.label, args.date); op.wallets = [{ id: args.walletId, delta: -n }]; op.funds = [{ id: args.fundId, delta: -n }];
  op.expenses = [{ amount: n, categoryId: args.categoryId, fundId: args.fundId, projectId: args.projectId, beneficiary: args.beneficiary, subcategory: args.subcategory, label: args.label }];
  op.projectId = args.projectId; op.beneficiary = args.beneficiary; if(args.fundId===RESERVE)op.reserveAuthorized=true; return append(s, op);
}
export function transfer(s: State, args: { from: string; to: string; amount: number; fee: number; feeFundId: string; reserveConfirmed?: boolean; date?: string; label?: string }): State {
  if (args.from === args.to) throw new Error('Choisis deux portefeuilles différents.');
  const n = amount(args.amount), fee = amount(args.fee, false);
  if (fee && args.feeFundId === RESERVE && !args.reserveConfirmed) throw new Error('Confirme l’utilisation de la réserve.');
  const feeFund = s.funds.find(f => f.id === args.feeFundId);
  if (fee && (!feeFund || (feeFund.kind === 'envelope' && feeFund.categoryId !== FINANCIAL))) throw new Error('Utilise l’enveloppe Frais financiers, le non attribué ou la réserve.');
  const op = base('transfer', args.label || 'Transfert entre portefeuilles', args.date);
  op.wallets = [{ id: args.from, delta: -checkedSum([n, fee]) }, { id: args.to, delta: n }];
  if (fee) { op.funds = [{ id: args.feeFundId, delta: -fee }]; op.expenses = [{ amount: fee, categoryId: FINANCIAL, fundId: args.feeFundId, label: 'Frais de transfert / retrait' }]; if(args.feeFundId===RESERVE)op.reserveAuthorized=true; }
  return append(s, op);
}
export function reverse(s: State, id: string): State {
  const original = s.operations.find(x => x.id === id);
  if (!original || original.kind === 'reversal' || original.kind === 'opening' || s.operations.some(x => x.reversalOf === id)) throw new Error('Cette opération ne peut pas être annulée.');
  const op = base('reversal', 'Annulation · ' + original.label); op.reversalOf = id;
  op.wallets = original.wallets.map(e => ({ ...e, delta: -e.delta })); op.funds = original.funds.map(e => ({ ...e, delta: -e.delta }));
  if (original.obligationId && activeOperations(s).some(x=>x.obligationId===original.obligationId && s.operations.indexOf(x)>s.operations.indexOf(original))) throw new Error('Annule d’abord les paiements suivants de cette échéance.');
  const next=append(s, op);
  if (original.obligationId) return {...next,obligations:next.obligations.map(o=>o.id!==original.obligationId?o:{...o,due:original.obligationDue!,paidDates:o.paidDates.filter(d=>d!==original.obligationDue)})};
  return next;
}
export function activeOperations(s: State): Operation[] {
  const reversed = new Set(s.operations.filter(x => x.kind === 'reversal').map(x => x.reversalOf));
  return s.operations.filter(x => x.kind !== 'reversal' && !reversed.has(x.id));
}
export function addProject(s: State, input: Omit<Project, 'id' | 'created'>): State {
  if (!input.name.trim()) throw new Error('Ajoute un nom au projet.');
  const p = { ...input, name: input.name.trim(), agreed: amount(input.agreed, false), id: uid(), created: today() };
  const next: State = { ...s, projects: [...s.projects, p], funds: [...s.funds, { id: 'p-' + p.id, name: 'Provision · ' + p.name, kind: 'provision', projectId: p.id }, { id:'u-p-'+p.id, name:'Non attribué · '+p.name, kind:'unassigned', projectId:p.id }] }; validateState(next); return next;
}
export function projectSummary(s: State, id: string) {
  const p = s.projects.find(p => p.id === id)!;
  const ops = activeOperations(s);
  const received = checkedSum(ops.filter(x => x.kind === 'income' && x.projectId === id).flatMap(x => x.wallets.map(e => e.delta)));
  const spent = checkedSum(ops.flatMap(x => x.expenses).filter(e => e.projectId === id).map(e => e.amount));
  const provision = balances(s, 'funds')['p-' + id] ?? 0;
  return { received, spent, provision, remaining: Math.max(0, p.agreed - received), surplus: Math.max(0, received - p.agreed), realized: received - spent, projected: p.agreed - spent - provision, contribution: received-spent-provision, available: balances(s,'funds')['u-p-'+id]??0 };
}
export function addObligation(s: State, input: Omit<Obligation, 'id' | 'paidDates'>): State {
  if (!input.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.due)) throw new Error('Précise le nom et l’échéance.');
  const o = { ...input, amount: amount(input.amount), id: uid(), paidDates: [] };
  const next: State = { ...s, obligations: [...s.obligations, o], funds: [...s.funds, { id: 'o-' + o.id, name: 'Échéance · ' + o.name, kind: 'provision', obligationId: o.id }] }; validateState(next); return next;
}
export function settleObligation(s: State, id: string, walletId: string): State {
  const o = s.obligations.find(x => x.id === id); if (!o) throw new Error('Échéance inconnue.');
  const next = expense(s, { walletId, fundId: 'o-' + id, categoryId: o.categoryId, amount: o.amount, label: o.name });
  if (o.recurrence==='once'&&o.paidDates.includes(o.due)) throw new Error('Cette échéance est déjà payée.');
  const latest=next.operations.at(-1)!;
  return { ...next, operations:[...next.operations.slice(0,-1),{...latest,obligationId:id,obligationDue:o.due}], obligations: next.obligations.map(x => x.id !== id ? x : { ...x, paidDates: [...x.paidDates, x.due], due: x.recurrence === 'monthly' ? nextMonth(x.due) : x.due }) };
}
export function nextMonth(date: string): string {
  const [y,m,d] = date.split('-').map(Number), end = new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return new Date(Date.UTC(y,m,Math.min(d,end))).toISOString().slice(0,10);
}
export function envelopeStats(s: State, id: string) {
  const f = balances(s, 'funds')[id] ?? 0;
  const spent = checkedSum(activeOperations(s).flatMap(x => x.expenses).filter(x => x.fundId === id).map(x => x.amount));
  const capacity = checkedSum([f, spent]);
  return { balance: f, spent, capacity, percent: capacity ? spent / capacity * 100 : 0 };
}
export function autonomy(s: State, monthly: number) {
  const a = amount(monthly, false), t = summary(s);
  if (!a) return null;
  return { ordinaryDays: Math.floor(t.usable / (a / 30)), withReserveDays: Math.floor((t.total - t.committed) / (a / 30)), reserveDays: Math.floor(t.reserve / (a / 30)), daily: a / 30 };
}
export function demoState(): State {
  let s = initialize(emptyState(), { mvola: 640000, orange: 285000, airtel: 175000, cash: 150000, bank: 1250000 });
  s.settings = { name: 'Mon espace', reserveTarget: 1200000, essentialMonthly: 390000 };
  s = addProject(s, { name: 'Prestation musicale', client: 'Client exemple', description: 'Animation et accompagnement musical', agreed: 1200000 });
  s = income(s, { walletId: 'mvola', amount: 600000, label: 'Acompte · prestation musicale', projectId: s.projects[0].id });
  for (const [to,n] of [[RESERVE,900000],['e-essential',390000],['e-personal',100000],['e-family',180000],['e-free',80000],['e-transport',90000],['e-health',60000],['e-financial',25000],['e-other',100000]] as [string,number][]) s = allocate(s, UNASSIGNED,to,n);
  s=allocate(s,'u-p-'+s.projects[0].id,'p-'+s.projects[0].id,180000);
  s = expense(s, { walletId:'cash', fundId:'e-essential', categoryId:'essential', amount:65000, label:'Courses alimentaires', subcategory:'Alimentation' });
  s = expense(s, { walletId:'mvola', fundId:'e-family', categoryId:'family', amount:45000, label:'Aide aux parents', beneficiary:'Parents' });
  s = transfer(s, { from:'mvola', to:'cash', amount:100000, fee:2000, feeFundId:'e-financial' });
  s = expense(s, { walletId:'cash', fundId:'e-transport', categoryId:'transport', amount:20000, label:'Déplacements', subcategory:'Taxi' });
  return s;
}
