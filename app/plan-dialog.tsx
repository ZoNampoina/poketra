'use client';
import {useState, type FormEvent} from 'react';
import * as F from '@/lib/finance';
import {extra} from '@/lib/models';
import {displayMoney} from '@/lib/display';
import {addDays,isIncomePlan,isPending,occurrenceDate,reminderAt} from '@/lib/schedule';
import {Amount,Field} from './ui';

type Props={s:F.State;income:boolean;id?:string;busy:boolean;commit:(s:F.State,msg:string)=>Promise<boolean>};
type ReviewMode='review'|'edit'|'snooze'|'postpone'|'cancel';
export const frequencies={once:'Une fois',weekly:'Chaque semaine',monthly:'Chaque mois'};
export const formatDate=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

function PlanForm({s,income,plan,busy,commit}:{plan?:F.Obligation}&Props){
  const [recurrence,setRecurrence]=useState<F.Obligation['recurrence']>(plan?.recurrence??'once');
  const [variable,setVariable]=useState(plan?.variableAmount??false);
  const [finite,setFinite]=useState(!!plan?.endsOn);
  const [date,setDate]=useState(plan?.due??F.today());
  const [error,setError]=useState('');
  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError('');
    const form=new FormData(e.currentTarget),get=(k:string)=>String(form.get(k)??'').trim();
    try{
      const changes={name:get('name'),direction:income?'income' as const:'expense' as const,
        walletId:get('wallet'),recurrence,endsOn:recurrence!=='once'&&finite?get('endsOn'):undefined,
        variableAmount:variable,amount:variable?0:F.amount(get('amount')),
        categoryId:income?'other':get('category'),projectId:income?get('project')||undefined:undefined,
        beneficiary:income?undefined:get('beneficiary'),useAvailable:!income&&form.has('useAvailable'),
        reminderTime:get('reminderTime'),notes:get('notes'),due:date};
      if(!changes.name)throw new Error('Donne un nom à ce programme.');
      if(changes.endsOn && changes.endsOn<(plan?occurrenceDate(plan):date))throw new Error('La fin du contrat doit suivre sa première échéance.');
      let next:F.State;
      if(plan){
        const dateChanged=date!==plan.due;
        const edited={...plan,...changes,anchorDay:dateChanged?Number(date.slice(8)):plan.anchorDay,
          scheduledFor:dateChanged?undefined:plan.scheduledFor,remindAt:dateChanged||changes.reminderTime!==plan.reminderTime?undefined:plan.remindAt};
        next={...s,obligations:s.obligations.map(o=>o.id===plan.id?edited:o),
          funds:s.funds.map(f=>f.obligationId===plan.id?{...f,name:'Échéance · '+changes.name}:f)};
      }else next=F.addObligation(s,changes);
      F.validateState(next);await commit(next,plan?'Programme modifié':income?'Entrée prévue ajoutée':'Échéance ajoutée');
    }catch(ex){setError((ex as Error).message);}
  }
  return <form className="form-grid" onSubmit={save}>
    <Field label={income?'Source du revenu':'Nom de la dépense'} wide><input name="name" required defaultValue={plan?.name} placeholder={income?'Ex. Cachet du vendredi':'Ex. Loyer'}/></Field>
    <Field label="Montant prévu"><select value={variable?'variable':'fixed'} onChange={e=>setVariable(e.target.value==='variable')}><option value="fixed">Montant fixe</option><option value="variable">À préciser à la validation</option></select></Field>
    {!variable&&<Amount value={plan?.amount||undefined} label="Montant en ariary"/>}
    <Field label={income?'Portefeuille à créditer':'Portefeuille à débiter'}><select name="wallet" defaultValue={plan?.walletId??extra(s).preferences.lastWallet}>{s.wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
    {income?<Field label="Projet associé"><select name="project" defaultValue={plan?.projectId??''}><option value="">Aucun projet</option>{s.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>:
      <Field label="Catégorie"><select name="category" defaultValue={plan?.categoryId??'essential'}>{s.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    <Field label="Fréquence"><select value={recurrence} onChange={e=>setRecurrence(e.target.value as F.Obligation['recurrence'])}>{Object.entries(frequencies).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
    <Field label={plan?'Prochaine date':recurrence==='once'?'Date prévue':'Première date'}><input type="date" value={date} required onChange={e=>setDate(e.target.value)}/></Field>
    {recurrence!=='once'&&<Field label="Durée du contrat"><select value={finite?'end':'open'} onChange={e=>setFinite(e.target.value==='end')}><option value="open">Sans date de fin</option><option value="end">Jusqu’à une date</option></select></Field>}
    {recurrence!=='once'&&finite&&<Field label="Dernier jour inclus"><input name="endsOn" type="date" min={plan?occurrenceDate(plan):date} defaultValue={plan?.endsOn} required/></Field>}
    <Field label="Heure du rappel à Madagascar"><input type="time" name="reminderTime" defaultValue={plan?.reminderTime??'09:00'} required/></Field>
    {!income&&<><Field label="Bénéficiaire (facultatif)"><input name="beneficiary" defaultValue={plan?.beneficiary}/></Field><label className="plan-check wide"><input type="checkbox" name="useAvailable" defaultChecked={plan?!!plan.useAvailable:true}/>Compléter la provision avec l’argent non attribué lors du paiement</label></>}
    <Field label="Note (facultatif)" wide><input name="notes" defaultValue={plan?.notes}/></Field>
    {error&&<p role="alert" className="form-error wide">{error}</p>}
    <button className="button primary wide" disabled={busy}>{plan?'Enregistrer les modifications':income?'Prévoir cette entrée':'Créer l’échéance'}</button>
  </form>;
}

export default function PlanDialog(props:Props){
  const {s,id,busy,commit}=props,plan=s.obligations.find(o=>o.id===id);
  const [mode,setMode]=useState<ReviewMode>('review');
  const [error,setError]=useState('');
  // Keep the occurrence the user actually opened, including across a synchronization.
  const [expected]=useState(plan?occurrenceDate(plan):'');
  if(!id)return <PlanForm {...props}/>;
  if(!plan||!isPending(plan)||occurrenceDate(plan)!==expected)return <p>Cette occurrence a déjà été traitée.</p>;
  if(mode==='edit')return <PlanForm {...props} plan={plan}/>;
  const income=isIncomePlan(plan),wallet=plan.walletId??extra(s).preferences.lastWallet;
  async function act(action:F.PlanAction|'confirm',data?:FormData){
    if(!plan||busy)return;setError('');
    try{
      if(action==='confirm'){
        const actual=plan.variableAmount?F.amount(data?.get('actual')):plan.amount;
        await commit(F.settleObligation(s,plan.id,String(data?.get('wallet')||wallet),actual,expected),income?'Entrée encaissée':'Dépense enregistrée');
      }else{
        const when=action==='postpone'?String(data?.get('date')):action==='snooze'?new Date(String(data?.get('when'))+':00+03:00').toISOString():undefined;
        await commit(F.changeOccurrence(s,plan.id,expected,action,when),{snooze:'Rappel programmé',postpone:'Date reportée',skip:'Occurrence annulée',stop:'Série arrêtée'}[action]);
      }
    }catch(ex){setError((ex as Error).message);}
  }
  const pick=(next:ReviewMode)=>{setMode(next);setError('');};
  const tomorrow=addDays(F.today(),1),afterDue=addDays(plan.due,1),nextDate=afterDue>tomorrow?afterDue:tomorrow;
  const later=new Date(Date.now()+3600000).toLocaleString('sv-SE',{timeZone:'Indian/Antananarivo'}).slice(0,16).replace(' ','T');
  return <div className="plan-review">
    <div className="plan-summary"><h3>{plan.name}</h3><strong>{plan.variableAmount?'Montant à préciser':displayMoney(s,plan.amount)}</strong><p>{formatDate(plan.due)} · {frequencies[plan.recurrence]}</p>
      {plan.endsOn&&<small>Jusqu’au {formatDate(plan.endsOn)}</small>}{plan.notes&&<p>{plan.notes}</p>}
      {plan.remindAt&&<p>Rappel le {new Date(reminderAt(plan)).toLocaleString('fr-FR',{timeZone:'Indian/Antananarivo'})}</p>}
    </div>
    {mode==='review'?<>
      <form className="form-grid" onSubmit={e=>{e.preventDefault();void act('confirm',new FormData(e.currentTarget));}}>
        <Field label={income?'Portefeuille à créditer':'Portefeuille à débiter'}><select name="wallet" defaultValue={wallet}>{s.wallets.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select></Field>
        {plan.variableAmount&&<Amount name="actual" label={income?'Montant reçu (Ar)':'Montant payé (Ar)'}/>}
        <button className="button primary wide" disabled={busy}>{income?'Valider l’encaissement':'Valider le paiement'}</button>
      </form>
      <div className="plan-actions"><button className="button secondary" onClick={()=>pick('snooze')}>Rappeler</button><button className="button secondary" onClick={()=>pick('postpone')}>Reporter</button><button className="button secondary" onClick={()=>pick('cancel')}>Annuler</button></div>
      <button className="link" onClick={()=>pick('edit')}>Modifier le programme</button>
    </>:mode==='cancel'?<>
      <p>{plan.recurrence==='once'?'Annuler cette prévision ?':'Quelle partie du contrat veux-tu annuler ?'}</p>
      <div className="plan-actions"><button className="button secondary" disabled={busy} onClick={()=>void act('skip')}>{plan.recurrence==='once'?'Annuler la prévision':'Cette occurrence seulement'}</button>
        {plan.recurrence!=='once'&&<button className="button secondary" disabled={busy} onClick={()=>void act('stop')}>Cette occurrence et les suivantes</button>}</div>
    </>:<form className="form-grid" onSubmit={e=>{e.preventDefault();void act(mode==='snooze'?'snooze':'postpone',new FormData(e.currentTarget));}}>
      {mode==='snooze'?<Field label="Me rappeler le (heure de Madagascar)" wide><input name="when" type="datetime-local" required defaultValue={later}/></Field>:
        <Field label="Nouvelle date de cette occurrence" wide><input name="date" type="date" min={afterDue>F.today()?afterDue:F.today()} defaultValue={nextDate} required/></Field>}
      <button className="button primary wide" disabled={busy}>{mode==='snooze'?'Programmer le rappel':'Reporter cette occurrence'}</button>
    </form>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    {mode!=='review'&&<button type="button" className="link" onClick={()=>pick('review')}>Retour</button>}
  </div>;
}
