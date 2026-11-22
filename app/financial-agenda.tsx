'use client';
import {useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,HelpCircle} from 'lucide-react';
import type {State} from '@/lib/finance';
import {today} from '@/lib/finance';
import {displayMoney} from '@/lib/display';
import {agendaEvents,monthBounds,shiftMonth,type AgendaEvent} from '@/lib/agenda';

const weekdays=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const label:Record<AgendaEvent['kind'],string>={
  payment:'Dépense enregistrée',income:'Revenu encaissé',scheduled:'Échéance',
  project:'Encaissement prévu',loan:'Prêt / remboursement prévu'
};
type Filter='all'|'planned'|'recorded';
export default function FinancialAgenda({s,onNavigate}:{s:State;onNavigate:(view:'history'|'obligations'|'projects'|'loans')=>void}){
  const now=today();
  const [month,setMonth]=useState(now.slice(0,7));
  const [selected,setSelected]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>('all');
  const [showHelp,setShowHelp]=useState(false);
  const {days,offset}=monthBounds(month);
  const events=useMemo(()=>agendaEvents(s,month),[s,month]);
  const matching=useMemo(()=>events.filter(e=>filter==='all'||(filter==='planned'?e.status==='planned':e.status!=='planned')),[events,filter]);
  const perDay=useMemo(()=>{const map=new Map<string,AgendaEvent[]>();for(const event of matching){const entries=map.get(event.date)||[];entries.push(event);map.set(event.date,entries);}return map;},[matching]);
  const entries=selected?matching.filter(e=>e.date===selected):matching;
  const title=new Date(month+'-01T12:00:00Z').toLocaleDateString('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'});
  const change=(delta:number)=>{setMonth(shiftMonth(month,delta));setSelected(null);};
  const openDay=(day:number)=>{const date=month+'-'+String(day).padStart(2,'0');setSelected(selected===date?null:date);};
  return <div className="pk-agenda">
    <section className="card pk-agenda-main" aria-label="Calendrier financier">
      <div className="pk-agenda-heading">
        <div className="pk-agenda-heading-title"><CalendarDays size={22}/><h2>Agenda financier</h2>
          <button type="button" className="icon-button" aria-label="Comprendre l'agenda" aria-expanded={showHelp} onClick={()=>setShowHelp(!showHelp)}><HelpCircle size={18}/></button>
        </div>
        <div className="pk-agenda-actions">
          <button className="button secondary" type="button" onClick={()=>{setMonth(now.slice(0,7));setSelected(now);}}>Aujourd'hui</button>
          <button className="icon-button" aria-label="Mois précédent" onClick={()=>change(-1)}><ChevronLeft size={20}/></button>
          <strong>{title}</strong>
          <button className="icon-button" aria-label="Mois suivant" onClick={()=>change(1)}><ChevronRight size={20}/></button>
        </div>
      </div>
      {showHelp&&<div className="pk-inline-help"><strong>Comment lire cet agenda ?</strong><p>Les dépenses et revenus déjà enregistrés sont distingués des échéances et paiements attendus. Une prévision ne modifie jamais les soldes. Sélectionne un jour pour afficher son détail, puis utilise « Voir » pour ouvrir le module concerné.</p></div>}
      <div className="pk-agenda-filters" role="group" aria-label="Filtrer les événements">
        {([['all','Tout'],['planned','À prévoir'],['recorded','Réalisé']] as const).map(([key,name])=><button key={key} type="button" className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{name}</button>)}
      </div>
      <div className="pk-agenda-grid" role="grid" aria-label={'Agenda '+title}>
        {weekdays.map(day=><span className="pk-agenda-weekday" key={day} role="columnheader">{day}</span>)}
        {Array.from({length:offset},(_,i)=><span key={'start'+i} aria-hidden="true" className="pk-agenda-pad"/>)}
        {Array.from({length:days},(_,i)=>{
          const day=i+1,date=month+'-'+String(day).padStart(2,'0'),items=perDay.get(date)||[];
          return <button type="button" role="gridcell" key={date} onClick={()=>openDay(day)} aria-label={date+' · '+items.length+' événement(s)'} aria-selected={selected===date} className={'pk-agenda-day '+(selected===date?'selected ':'')+(date===now?'today ':'')}>
            <span className="pk-agenda-number">{day}</span>
            <span className="pk-agenda-dots">{items.slice(0,4).map(e=><i key={e.id} className={'pk-agenda-dot pk-agenda-'+e.kind}/>)}{items.length>4&&<span className="pk-agenda-more">+{items.length-4}</span>}</span>
          </button>;
        })}
      </div>
      <div className="pk-agenda-legend"><span><i className="pk-agenda-dot pk-agenda-payment"/>Dépense</span><span><i className="pk-agenda-dot pk-agenda-income"/>Revenu</span><span><i className="pk-agenda-dot pk-agenda-scheduled"/>Échéance</span><span><i className="pk-agenda-dot pk-agenda-project"/>Projet</span><span><i className="pk-agenda-dot pk-agenda-loan"/>Prêt</span></div>
    </section>
    <section className="card pk-agenda-events">
      <div className="pk-agenda-events-head"><h2>{selected?'Le '+new Date(selected+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'Événements du mois'}</h2><span>{entries.length} élément{entries.length!==1?'s':''}</span></div>
      {selected&&<button type="button" className="link" onClick={()=>setSelected(null)}>Afficher tout le mois</button>}
      {entries.length?entries.map(event=><div className="pk-agenda-event" key={event.id}>
        <div className={'pk-agenda-event-mark pk-agenda-'+event.kind}/>
        <div className="pk-agenda-event-content"><strong>{event.title}</strong><span>{event.date.split('-').reverse().join('/')} · {label[event.kind]} · {event.status==='recorded'?'Enregistré':event.status==='paid'?'Payé':'Prévision'}</span></div>
        <div className="pk-agenda-event-end"><strong>{displayMoney(s,event.amount)}</strong><button className="link" type="button" onClick={()=>onNavigate(event.section)}>Voir</button></div>
      </div>):<p className="pk-agenda-empty">Aucun événement pour cette sélection.</p>}
    </section>
  </div>;
}
