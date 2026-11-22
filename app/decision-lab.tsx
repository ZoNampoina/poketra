'use client';
import {useMemo,useState} from 'react';
import {ArrowDownRight,CalendarClock,CheckCircle2,Compass,Lightbulb,ShieldCheck,SlidersHorizontal,TriangleAlert} from 'lucide-react';
import type {State} from '@/lib/finance';
import {displayMoney} from '@/lib/display';
import {evaluateScenario,localInsights,suggestExpenseCategory,type Horizon} from '@/lib/decision-support';

type Props={s:State;onDraft:(label:string,categoryId:string)=>void};
const valid=(text:string)=>/^\d+$/.test(text)&&Number.isSafeInteger(Number(text));
export default function DecisionLab({s,onDraft}:Props){
  const [purchase,setPurchase]=useState('0');
  const [extra,setExtra]=useState('0');
  const [horizon,setHorizon]=useState<Horizon>(30);
  const [label,setLabel]=useState('');
  const ready=valid(purchase)&&valid(extra);
  const simulation=useMemo(()=>{
    if(!ready)return null;
    try{return evaluateScenario(s,{purchase:Number(purchase),extraEssentialMonthly:Number(extra),horizon});}
    catch{return null;}
  },[s,purchase,extra,horizon,ready]);
  const hints=useMemo(()=>localInsights(s,horizon),[s,horizon]);
  const category=useMemo(()=>suggestExpenseCategory(s,label),[s,label]);
  const money=(value:number)=>displayMoney(s,value);
  return <div className="pk-lab">
    <section className="pk-lab-hero">
      <div className="pk-lab-hero-top"><span><Compass size={18}/> ATELIER DE DÉCISION</span><span>SIMULATION LOCALE</span></div>
      <h2>Avant de dépenser, <em>regarde plus loin.</em></h2>
      <p>Pose une hypothèse, compare son impact sur ta marge de manœuvre et garde la main sur tes décisions. Aucun montant simulé n'est enregistré.</p>
    </section>
    <div className="pk-lab-columns">
      <section className="card pk-lab-card" aria-labelledby="pk-lab-title">
        <div className="pk-lab-title"><SlidersHorizontal size={20}/><h2 id="pk-lab-title">Mon scénario</h2></div>
        <div className="pk-lab-fields">
          <label>Nouvelle dépense envisagée (Ar)
            <input aria-label="Dépense simulée en ariary" type="number" min="0" step="1" inputMode="numeric" value={purchase} onChange={e=>setPurchase(e.target.value)}/>
          </label>
          <label>Hausse des besoins essentiels sur 30 jours (Ar)
            <input aria-label="Besoins essentiels supplémentaires en ariary" type="number" min="0" step="1" inputMode="numeric" value={extra} onChange={e=>setExtra(e.target.value)}/>
          </label>
          <label>Échéances à considérer
            <select aria-label="Horizon de simulation" value={horizon} onChange={e=>setHorizon(Number(e.target.value) as Horizon)}>
              <option value={30}>30 prochains jours</option>
              <option value={90}>90 prochains jours</option>
              <option value={365}>365 prochains jours</option>
            </select>
          </label>
        </div>
        <button type="button" className="button secondary" onClick={()=>{setPurchase('0');setExtra('0');setHorizon(30);}}>Réinitialiser la simulation</button>
        {!simulation&&<p role="alert" className="form-error">Saisis des montants entiers positifs ou nuls, dans la plage acceptée.</p>}
        {simulation&&<div className="pk-lab-results" aria-live="polite">
          <div className="pk-lab-result pk-lab-result-main"><span>Disponible après cet achat hypothétique</span><strong>{money(simulation.afterPurchase)}</strong></div>
          <div className="pk-lab-result"><span>Échéances non provisionnées sur {horizon} jours</span><strong>{money(simulation.unfundedCommitments)}</strong></div>
          <div className="pk-lab-result"><span>Disponible après ces engagements</span><strong>{money(simulation.freeAfterUnfunded)}</strong></div>
          <div className={'pk-lab-result '+(simulation.gap?'pk-lab-warning':'')}><span>Manque potentiel de liquidités</span><strong>{money(simulation.gap)}</strong></div>
          <div className="pk-lab-result"><span>Autonomie estimée, hors réserve</span><strong>{simulation.daysOfEssentialNeeds===null?'À renseigner':simulation.daysOfEssentialNeeds+' jours'}</strong></div>
          <div className="pk-lab-result"><span>Réserve volontairement exclue</span><strong>{money(simulation.reserveUntouched)}</strong></div>
        </div>}
        <p className="pk-lab-disclaimer"><ShieldCheck size={16}/> Calcul indicatif sans revenu futur supposé. Les engagements et les dépenses essentielles sont deux vues distinctes : ils ne s'additionnent pas car ils peuvent se recouper. Le total réellement détenu n'est pas modifié.</p>
      </section>
      <div className="pk-lab-side">
        <section className="card pk-lab-card">
          <div className="pk-lab-title"><Lightbulb size={20}/><h2>Repères utiles</h2></div>
          {hints.length?hints.map(h=><div className="pk-lab-hint" key={h.id}>{h.severity==='attention'?<TriangleAlert size={19}/>:<CheckCircle2 size={19}/>}<div><strong>{h.title}</strong><p>{h.description}</p></div></div>):<p className="muted">Aucun point d'attention détecté à partir des paramètres et échéances enregistrés.</p>}
          <p className="pk-lab-small">Ces repères sont calculés sur cet appareil. Ils ne créent aucune opération et ne déclenchent aucun paiement.</p>
        </section>
        <section className="card pk-lab-card">
          <div className="pk-lab-title"><CalendarClock size={20}/><h2>Assistant de catégorisation</h2></div>
          <p className="muted">Retrouve une catégorie utilisée au moins deux fois pour un même libellé. Aucun texte n'est transmis à un service externe.</p>
          <label className="pk-lab-category-label">Libellé d'une dépense
            <input aria-label="Libellé à analyser" value={label} maxLength={150} onChange={e=>setLabel(e.target.value)} placeholder="Ex. Taxi, courses..."/>
          </label>
          {category?<div className="pk-lab-hint pk-lab-category"><CheckCircle2 size={19}/><div><strong>{category.categoryName}</strong><p>{category.matchingOperations} opérations correspondantes. {category.explanation}</p><button className="button primary" type="button" onClick={()=>onDraft(label,category.categoryId)}>Préparer la saisie <ArrowDownRight size={15}/></button></div></div>:<p className="pk-lab-small">Aucune suggestion fiable actuellement. Tu gardes toujours le choix de la catégorie dans la saisie.</p>}
        </section>
      </div>
    </div>
  </div>;
}
