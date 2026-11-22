'use client';
import {useMemo,useRef,useState} from 'react';
import {ArrowLeftRight,Calculator,RefreshCw,HelpCircle} from 'lucide-react';
import * as F from '@/lib/finance';
import * as M from '@/lib/models';
import {displayMoney} from '@/lib/display';
import {CURRENCIES,ariaryImpact,currencySupported,estimateCurrency,fmtCurrency,type CurrencyCode} from '@/lib/currency';

const parsed=(value:string)=>Number(value.trim().replace(',','.'));
export default function CurrencyConverter({s}:{s:F.State}){
  const [from,setFrom]=useState<CurrencyCode>('EUR');
  const [to,setTo]=useState<CurrencyCode>('MGA');
  const [amount,setAmount]=useState('100');
  const [rate,setRate]=useState('');
  const [rateDate,setRateDate]=useState('');
  const [source,setSource]=useState<'manual'|'frankfurter'|'identity'>('manual');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [help,setHelp]=useState(false);
  const requestId=useRef(0);
  const masked=M.extra(s).preferences.hideAmounts;
  const resetRate=()=>{requestId.current++;setPending(false);setRate('');setRateDate('');setSource('manual');setError('');};
  const switchFrom=(code:CurrencyCode)=>{setFrom(code);resetRate();};
  const switchTo=(code:CurrencyCode)=>{setTo(code);resetRate();};
  const parsedRate=from===to?1:parsed(rate);
  const converted=useMemo(()=>{
    try{
      if(amount.trim()===''||(from!==to&&rate.trim()===''))return null;
      return estimateCurrency(parsed(amount),parsedRate);
    }catch{return null;}
  },[amount,parsedRate,from,to,rate]);
  const impact=useMemo(()=>{
    if(converted===null)return null;
    try{return ariaryImpact(F.summary(s).usable,parsed(amount),parsedRate,from,to);}
    catch{return null;}
  },[s,amount,parsedRate,from,to,converted]);
  async function loadRate(){
    const current=++requestId.current;
    setPending(true);setError('');
    if(from===to){setRate('1');setRateDate('');setSource('identity');setPending(false);return;}
    try{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),9000);
      let response:Response;
      try{response=await fetch('/api/fx?from='+from+'&to='+to,{cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timeout);}
      const data:unknown=await response.json();
      if(current!==requestId.current)return;
      const result=data as {rate?:unknown;date?:unknown;error?:unknown;};
      if(!response.ok||typeof result.rate!=='number'||!Number.isFinite(result.rate)||result.rate<=0||typeof result.date!=='string'){
        throw new Error(typeof result.error==='string'?result.error:'Taux indisponible.');
      }
      setRate(String(result.rate));setRateDate(result.date);setSource('frankfurter');
    }catch(e){if(current===requestId.current){setError((e as Error).message||'Taux indisponible.');setRate('');setRateDate('');setSource('manual');}}
    finally{if(current===requestId.current)setPending(false);}
  }
  const currencySelect=(value:CurrencyCode,onChange:(v:CurrencyCode)=>void,name:string)=><select aria-label={name} value={value} onChange={e=>{if(currencySupported(e.target.value))onChange(e.target.value);}}>
    {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
  </select>;
  return <div className="pk-fx">
    <section className="card pk-fx-card">
      <div className="pk-widget-heading"><h2><Calculator size={21}/> Conversion de devises</h2><button type="button" className="icon-button" aria-label="Comprendre la conversion" aria-expanded={help} onClick={()=>setHelp(!help)}><HelpCircle size={19}/></button></div>
      {help&&<div className="pk-inline-help"><strong>À quoi sert cette simulation ?</strong><p>Convertis une somme avec un cours indicatif récupéré en ligne ou saisis ton propre taux, y compris hors connexion. Les taux de banques et opérateurs, commissions et frais de change peuvent différer. Aucun portefeuille ni solde n'est modifié.</p></div>}
      <div className="pk-fx-currency-row">
        <label>Devise de départ{currencySelect(from,switchFrom,'Devise de départ')}</label>
        <button type="button" className="pk-fx-swap" aria-label="Inverser les devises" onClick={()=>{setFrom(to);setTo(from);resetRate();}}><ArrowLeftRight size={20}/></button>
        <label>Devise d'arrivée{currencySelect(to,switchTo,'Devise d’arrivée')}</label>
      </div>
      <div className="pk-fx-fields">
        <label>Montant à convertir<input type="text" inputMode="decimal" aria-label="Montant de la simulation" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Montant"/></label>
        <label>Taux : 1 {from} en {to}<input type="text" inputMode="decimal" aria-label="Taux de conversion" value={from===to?'1':rate} disabled={from===to} onChange={e=>{setRate(e.target.value);setSource('manual');setRateDate('');}} placeholder="Saisir un taux"/></label>
      </div>
      <button type="button" className="button secondary" disabled={pending||from===to} onClick={()=>void loadRate()}><RefreshCw size={17}/>{pending?'Récupération…':'Charger le taux indicatif'}</button>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="pk-fx-rate-info">
        {from===to?'Même devise : taux de 1.':source==='frankfurter'?'Frankfurter · taux du '+rateDate:rate.trim()?'Taux manuel, à vérifier.':'Aucun taux défini. Charge un taux ou saisis-le.'}
      </div>
      <div className="pk-fx-result" aria-live="polite">
        <span>Montant converti</span>
        <strong>{converted===null?'—':masked?'••••':fmtCurrency(converted,to)}</strong>
        {converted===null&&<small>Entre un montant valide et un taux strictement positif.</small>}
      </div>
      {impact&&<div className="pk-fx-impact"><span>Si cette somme était dépensée en Ariary :</span><strong>{displayMoney(s,impact.purchaseMGA)}</strong><span>Disponible estimé après cette dépense</span><strong>{displayMoney(s,impact.remainingMGA)}</strong></div>}
      <p className="pk-fx-note">Simulation uniquement. Aucun achat, change ou encaissement n'est enregistré ; aucun frais ni spread n'est appliqué. Les cours indicatifs peuvent différer des cours pratiqués.</p>
    </section>
  </div>;
}
