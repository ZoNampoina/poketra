'use client';
import {useState} from 'react';
import {ArrowDownLeft,CalendarDays} from 'lucide-react';
import * as F from '@/lib/finance';
import {displayMoney} from '@/lib/display';
import {isIncomePlan,isPending} from '@/lib/schedule';
import {formatDate,frequencies} from './plan-dialog';
import {NotificationSettings} from './plan-reminders';

export default function Scheduled({s,income,open,busy,demo}:{s:F.State;income:boolean;open:(type:string,id?:string)=>void;busy:boolean;demo:boolean}){
  const [archive,setArchive]=useState(false);
  const plans=s.obligations.filter(o=>isIncomePlan(o)===income);
  const active=plans.filter(isPending).sort((a,b)=>a.due.localeCompare(b.due));
  const closed=plans.filter(o=>!isPending(o)).sort((a,b)=>b.due.localeCompare(a.due));
  const funds=F.balances(s,'funds'),Icon=income?ArrowDownLeft:CalendarDays;
  function row(o:F.Obligation){
    const pending=isPending(o);
    const status=pending?(o.status==='postponed'?'Reporté':o.due<F.today()?'En retard':'Prévu'):o.status==='cancelled'?'Annulé':'Terminé';
    return <article className="plan-row" key={o.id}>
      <span className={'soft-icon '+(income?'green':'sand')}><Icon size={20}/></span>
      <div className="plan-description"><strong>{o.name}</strong><small>{formatDate(o.due)} · {frequencies[o.recurrence]} · {status}</small>
        {o.walletId&&<small>{s.wallets.find(w=>w.id===o.walletId)?.name}{o.endsOn?' · Jusqu’au '+formatDate(o.endsOn):''}</small>}
        {!income&&(funds['o-'+o.id]??0)>0&&<small>{displayMoney(s,funds['o-'+o.id])} provisionnés</small>}
      </div>
      <strong className={income?'green':''}>{o.variableAmount?'À préciser':displayMoney(s,o.amount)}</strong>
      {pending&&<div className="plan-actions">{!income&&<button className="link" disabled={busy} onClick={()=>open('allocate','o-'+o.id)}>Provisionner</button>}
        <button className="button secondary" disabled={busy} onClick={()=>open(income?'plannedIncome':'obligation',o.id)}>Gérer</button></div>}
    </article>;
  }
  return <div className="plan-list"><NotificationSettings demo={demo}/>
    <section className="card">{active.length?active.map(row):<div className="empty small"><Icon size={28}/><p>{income?'Aucune entrée prévue.':'Aucune échéance à venir.'}</p></div>}</section>
    {closed.length>0&&<section><button type="button" className="link" aria-expanded={archive} onClick={()=>setArchive(!archive)}>Programmes terminés ou annulés ({closed.length})</button>{archive&&<div className="card">{closed.map(row)}</div>}</section>}
  </div>;
}
