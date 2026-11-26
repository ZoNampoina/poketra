import * as F from './finance';
import {addDays, isIncomePlan, occurrences} from './schedule';
import { extra, patchExtra, effective, type Details, type Loan, type FeeModel } from './models';
export type Part={amount:number;categoryId:string;fundId:string;beneficiary?:string;subcategory?:string;projectId?:string};
export function annotate(s:F.State,id:string,details:Details):F.State{if(!s.operations.some(o=>o.id===id))throw new Error('Transaction introuvable.');const x=extra(s),next=patchExtra(s,{details:{...x.details,[id]:{...x.details[id],...details}}});F.validateState(next);return next;}
export function splitExpense(s:F.State,a:{walletId:string;amount:number;parts:Part[];label?:string;date?:string;fundingSource?:string;reserveConfirmed?:boolean;fee?:number;feeFundId?:string;details?:Details}):F.State{
 const total=F.amount(a.amount);if(!a.parts.length||F.sum(a.parts.map(p=>F.amount(p.amount)))!==total)throw new Error('La somme des parts doit correspondre exactement au montant.');
 const fee=F.amount(a.fee??0,false),parts=[...a.parts];if(fee)parts.push({amount:fee,categoryId:F.FINANCIAL,fundId:a.feeFundId??'e-financial',projectId:a.parts.every(p=>p.projectId===a.parts[0].projectId)?a.parts[0].projectId:undefined});
 const op=F.base('expense',a.label?.trim()||s.categories.find(c=>c.id===parts[0].categoryId)?.name||'Dépense',a.date);op.wallets=[{id:a.walletId,delta:-F.sum([total,fee])}];op.funding=[];
 const available={...F.balances(s,'funds')};for(const p of parts){const amount=F.amount(p.amount),fund=s.funds.find(f=>f.id===p.fundId);if(!fund||!s.categories.some(c=>c.id===p.categoryId))throw new Error('Catégorie ou affectation inconnue.');if(fund.kind==='envelope'&&fund.categoryId!==p.categoryId)throw new Error('Catégorie et enveloppe doivent correspondre.');if(fund.projectId&&fund.projectId!==p.projectId&&fund.kind==='provision')throw new Error('La provision appartient à un autre projet.');
  const short=Math.max(0,amount-available[p.fundId]);if(short&&a.fundingSource){if(a.fundingSource===p.fundId)throw new Error('Choisis une autre source de financement.');op.funding.push({from:a.fundingSource,to:p.fundId,amount:short});op.funds.push({id:a.fundingSource,delta:-short},{id:p.fundId,delta:short});available[a.fundingSource]-=short;available[p.fundId]+=short;}
  op.expenses.push({...p,label:op.label,role:fee&&p===parts.at(-1)?'fee':undefined});op.funds.push({id:p.fundId,delta:-amount});available[p.fundId]-=amount;
 }
 if(a.reserveConfirmed)op.reserveAuthorized=true;const projectIds=new Set(a.parts.map(p=>p.projectId).filter(Boolean));if(projectIds.size===1)op.projectId=[...projectIds][0];if(a.parts.length===1)op.beneficiary=a.parts[0].beneficiary;
 let next=F.append(s,op);if(a.details)next=annotate(next,op.id,a.details);return next;
}
export function reconcile(s:F.State,walletId:string,actual:number,reason:string,fundId=F.UNASSIGNED,confirmed=false):F.State{
 const before=F.balances(s,'wallets')[walletId];if(before===undefined)throw new Error('Portefeuille inconnu.');F.amount(actual,false);if(!reason.trim())throw new Error('Précise le motif de la correction.');const delta=actual-before;if(!delta)throw new Error('Les soldes correspondent déjà.');const op=F.base('adjustment','Correction · '+reason.trim());op.wallets=[{id:walletId,delta}];op.funds=[{id:delta>0?F.UNASSIGNED:fundId,delta}];op.correction={before,actual,reason:reason.trim()};if(confirmed)op.reserveAuthorized=true;return F.append(s,op);
}
export function reconciliationCandidates(s:F.State,walletId:string,difference:number){return F.activeOperations(s).filter(o=>o.wallets.some(e=>e.id===walletId)).map(o=>({operation:o,exact:o.wallets.some(e=>e.id===walletId&&Math.abs(e.delta)===Math.abs(difference)),fee:o.expenses.some(e=>e.categoryId===F.FINANCIAL&&e.amount===Math.abs(difference))})).sort((a,b)=>Number(b.exact||b.fee)-Number(a.exact||a.fee)||b.operation.date.localeCompare(a.operation.date)).slice(0,8);}
export function addLoan(s:F.State,input:Omit<Loan,'id'|'created'>):F.State{const loan={...input,id:F.uid(),created:F.today(),principal:F.amount(input.principal)};const next=patchExtra(s,{loans:[...extra(s).loans,loan]});const result={...next,funds:[...next.funds,{id:'l-'+loan.id,name:'Prêt · '+loan.name,kind:'provision' as const,loanId:loan.id}]};F.validateState(result);return result;}
export function loanSummary(s:F.State,id:string){const loan=extra(s).loans.find(l=>l.id===id);if(!loan)throw new Error('Prêt inconnu.');const ops=F.activeOperations(s).filter(o=>o.capital?.loanId===id);const issued=F.sum(ops.filter(o=>o.kind==='loan_issue'||o.kind==='loan_borrow').map(o=>o.capital!.amount)),returned=F.sum(ops.filter(o=>o.kind==='loan_collect'||o.kind==='loan_repay').map(o=>o.capital!.amount));return{issued,returned,remaining:issued-returned,unissued:loan.principal-issued,interestPaid:F.sum(ops.flatMap(o=>o.expenses).map(e=>e.amount)),interestReceived:F.sum(ops.map(o=>o.receivedInterest??0)),provision:F.balances(s,'funds')['l-'+id]??0};}
export function loanMovement(s:F.State,a:{loanId:string;action:'issue'|'repay';walletId:string;amount:number;interest?:number;fundId:string;interestFundId?:string;date?:string;reserveConfirmed?:boolean;label?:string}):F.State{
 const loan=extra(s).loans.find(l=>l.id===a.loanId);if(!loan)throw new Error('Prêt inconnu.');const value=F.amount(a.amount),interest=F.amount(a.interest??0,false),incoming=loan.direction==='lent'?a.action==='repay':a.action==='issue';
 if(a.action==='issue'&&interest)throw new Error('Les intérêts se saisissent lors d’un remboursement.');const kind=loan.direction==='lent'?(a.action==='issue'?'loan_issue':'loan_collect'):(a.action==='issue'?'loan_borrow':'loan_repay');
 const source=incoming?F.UNASSIGNED:a.fundId;const op=F.base(kind,a.label||((a.action==='issue'?'Capital · ':'Remboursement · ')+loan.name),a.date);op.capital={loanId:loan.id,amount:value,fundId:source};op.beneficiary=loan.person;op.wallets=[{id:a.walletId,delta:(incoming?1:-1)*F.sum([value,interest])}];op.funds=[{id:source,delta:(incoming?1:-1)*(incoming?F.sum([value,interest]):value)}];
 if(incoming)op.receivedInterest=interest;else if(interest){const fund=a.interestFundId??'e-financial';op.funds.push({id:fund,delta:-interest});op.expenses=[{amount:interest,categoryId:F.FINANCIAL,fundId:fund,label:'Intérêts · '+loan.name,beneficiary:loan.person}];}
 if(a.reserveConfirmed)op.reserveAuthorized=true;return F.append(s,op);
}
type ForecastRow = {
  id: string;
  name: string;
  date: string;
  direction: 'income' | 'expense';
  amount: number | null;
  walletId?: string;
  provision: number;
  unfunded: number;
  essential: boolean;
};

export function forecast(s: F.State, horizon = 30, today = F.today()) {
  const until = addDays(today, horizon);
  const funds = F.balances(s, 'funds'), rows: ForecastRow[] = [];

  for (const plan of s.obligations) {
    const income = isIncomePlan(plan);
    const amount = plan.variableAmount ? null : plan.amount;
    const paid = new Set(plan.paidDates);
    // A postponed occurrence can fall after the next contractual date.
    const dates = [...occurrences(plan, '', until)]
      .filter(({original}) => !paid.has(original))
      .sort((a, b) => a.date.localeCompare(b.date));
    const essential = !income && (s.categories.find(c => c.id === plan.categoryId)?.essential ?? false);
    let available = income ? 0 : funds['o-' + plan.id] ?? 0;
    for (const {original, date} of dates) {
      const provision = Math.min(amount ?? 0, available);
      available -= provision;
      rows.push({id: plan.id + ':' + original, name: plan.name, date, walletId: plan.walletId,
        direction: income ? 'income' : 'expense', amount, provision, essential,
        unfunded: income ? 0 : (amount ?? 0) - provision});
    }
  }

  for (const loan of extra(s).loans) {
    if (loan.direction !== 'borrowed' || !loan.due || loan.due > until) continue;
    const remaining = loanSummary(s, loan.id).remaining;
    if (!remaining) continue;
    const provision = Math.min(remaining, funds['l-' + loan.id] ?? 0);
    rows.push({id: 'loan:' + loan.id, name: loan.name, date: loan.due, direction: 'expense',
      amount: remaining, provision, unfunded: remaining - provision, essential: true});
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'fr'));

  const expenses = rows.filter(r => r.direction === 'expense');
  const incomes = rows.filter(r => r.direction === 'income');
  const expectedIncome = F.sum(incomes.map(r => r.amount ?? 0));
  const planned = F.sum(expenses.map(r => r.amount ?? 0));
  const funded = F.sum(expenses.map(r => r.provision));
  const unfunded = F.sum(expenses.map(r => r.unfunded));
  const usable = F.summary(s).usable;
  // Overdue items are still outstanding today. Same-day flows share one closing balance.
  const dailyChanges = new Map<string, number>();
  for (const row of rows) {
    const day = row.date < today ? today : row.date;
    const change = row.direction === 'income' ? row.amount ?? 0 : -row.unfunded;
    dailyChanges.set(day, F.sum([dailyChanges.get(day) ?? 0, change]));
  }
  let projectedAvailable = usable;
  let shortfall: {date: string; amount: number} | null = null;
  for (const [date, change] of dailyChanges) {
    projectedAvailable = F.sum([projectedAvailable, change]);
    if (-projectedAvailable > (shortfall?.amount ?? 0)) shortfall = {date, amount: -projectedAvailable};
  }
  return {until, usable, rows, planned, funded, unfunded, expectedIncome, projectedAvailable, shortfall,
    unpricedIncome: incomes.filter(r => r.amount === null).length,
    unpricedExpense: expenses.filter(r => r.amount === null).length,
    freeAfterObligations: Math.max(0, usable - unfunded), gap: Math.max(0, unfunded - usable)};
}
export function vigilance(s:F.State,amount=0,categoryId?:string){const p=extra(s).preferences,t=F.summary(s),a=F.autonomy(s,s.settings.essentialMonthly),target=s.settings.reserveTarget||p.reserveMonths*s.settings.essentialMonthly,essential=s.categories.find(c=>c.id===categoryId)?.essential??true;return{enabled:p.vigilance,risky:p.vigilance&&!essential&&(t.reserve<target||!!a&&a.ordinaryDays<p.vigilanceDays),target,daysAfter:s.settings.essentialMonthly?Math.max(0,Math.floor((t.usable-amount)/(s.settings.essentialMonthly/30))):null,big:amount>=p.largeExpense,reserveShortfall:Math.max(0,target-t.reserve)};}
export function feeSuggestion(s:F.State,walletId:string,operation:FeeModel['operation'],amount:number){const match=extra(s).feeModels.find(f=>f.walletId===walletId&&f.operation===operation&&amount>=f.min&&amount<=f.max);if(match){const fee=Math.round(match.fixed+amount*match.percent/100);if(!Number.isSafeInteger(fee))throw new Error('Frais trop élevés.');return{fee,label:'Modèle personnel : '+match.name};}const last=extra(s).usualFees[walletId+':'+operation];return last===undefined?null:{fee:last,label:'Derniers frais saisis · à vérifier'};}
export function effectiveOps(s:F.State){return F.activeOperations(s).map(o=>effective(s,o));}
export function realIncome(o:F.Operation){if(o.kind==='income')return F.sum(o.wallets.map(e=>e.delta));return o.kind==='loan_collect'?o.receivedInterest??0:0;}
export function realExpense(o:F.Operation){return F.sum(o.expenses.map(e=>e.amount));}
