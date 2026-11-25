import * as F from './finance';
import {isIncomePlan,occurrences} from './schedule';
import * as A from './advanced-finance';
import * as M from './models';

export type AgendaKind='payment'|'income'|'scheduled'|'expectedIncome'|'project'|'loan';
export type AgendaEvent={
  id:string;
  date:string;
  kind:AgendaKind;
  status:'recorded'|'planned'|'paid';
  title:string;
  amount:number;
  variableAmount?:boolean;
  section:'history'|'obligations'|'plannedIncome'|'projects'|'loans';
};
const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(new Date(date+'T12:00:00Z').getTime())&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
export function monthBounds(month:string){
  if(!monthPattern.test(month))throw new Error('Mois invalide.');
  const [year,m]=month.split('-').map(Number);
  const days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const start=month+'-01',end=month+'-'+String(days).padStart(2,'0');
  const offset=(new Date(start+'T12:00:00Z').getUTCDay()+6)%7;
  return {start,end,days,offset};
}
export function shiftMonth(month:string,delta:number){
  if(!Number.isSafeInteger(delta)||Math.abs(delta)>12)throw new Error('Décalage invalide.');
  monthBounds(month);
  const [year,m]=month.split('-').map(Number);
  return new Date(Date.UTC(year,m-1+delta,1)).toISOString().slice(0,7);
}
/** Calendrier de lecture seule : aucun paiement ou projet attendu ne crée du solde. */
export function agendaEvents(s:F.State,month:string):AgendaEvent[]{
  const {start,end}=monthBounds(month);
  const events:AgendaEvent[]=[];
  for(const o of s.obligations){
    for(const {date,original} of occurrences(o,start,end)){
      const received=isIncomePlan(o),paid=o.paidDates.includes(original);
      if(paid && s.operations.some(op=>op.obligationId===o.id && op.obligationDue===original))continue;
      events.push({id:'obligation:'+o.id+':'+original,date,kind:received?'expectedIncome':'scheduled',
        status:paid?'paid':'planned',title:o.name,amount:o.amount,variableAmount:o.variableAmount,section:received?'plannedIncome':'obligations'});
    }
  }
  for(const p of s.projects){
    if(p.status==='cancelled'||!p.expectedDate||p.expectedDate<start||p.expectedDate>end||!validDate(p.expectedDate))continue;
    const remaining=F.projectSummary(s,p.id).remaining;
    if(remaining>0)events.push({id:'project:'+p.id,date:p.expectedDate,kind:'project',status:'planned',title:p.name,amount:remaining,section:'projects'});
  }
  for(const loan of M.extra(s).loans){
    if(!loan.due||loan.due<start||loan.due>end||!validDate(loan.due))continue;
    const outstanding=A.loanSummary(s,loan.id).remaining;
    if(outstanding>0)events.push({
      id:'loan:'+loan.id,date:loan.due,kind:'loan',status:'planned',
      title:loan.name,amount:outstanding,section:'loans'
    });
  }
  for(const raw of F.activeOperations(s)){
    const o=M.effective(s,raw);
    if(!validDate(o.date)||o.date<start||o.date>end)continue;
    if(o.kind==='income'){
      const incoming=F.sum(o.wallets.filter(e=>e.delta>0).map(e=>e.delta));
      if(incoming>0)events.push({id:'income:'+o.id,date:o.date,kind:'income',status:'recorded',title:o.label,amount:incoming,section:'history'});
    }
    const spent=F.sum(o.expenses.map(e=>e.amount));
    if(spent>0)events.push({id:'expense:'+o.id,date:o.date,kind:'payment',status:'recorded',title:o.kind==='transfer'?'Frais · '+o.label:o.label,amount:spent,section:'history'});
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
