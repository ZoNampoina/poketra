export const CURRENCIES=[
  {code:'MGA',name:'Ariary malgache'},
  {code:'EUR',name:'Euro'},
  {code:'USD',name:'Dollar américain'},
  {code:'GBP',name:'Livre sterling'},
  {code:'CNY',name:'Yuan chinois'},
  {code:'JPY',name:'Yen japonais'},
  {code:'CHF',name:'Franc suisse'},
  {code:'CAD',name:'Dollar canadien'},
  {code:'ZAR',name:'Rand sud-africain'},
  {code:'INR',name:'Roupie indienne'}
] as const;
export type CurrencyCode=typeof CURRENCIES[number]['code'];
export function currencySupported(code:string):code is CurrencyCode {
  return CURRENCIES.some(c=>c.code===code);
}
export function estimateCurrency(amount:number,rate:number){
  if(!Number.isFinite(amount)||amount<0||amount>1_000_000_000_000||!Number.isFinite(rate)||rate<=0||rate>1_000_000_000_000)throw new Error('Montant ou taux invalide.');
  const result=amount*rate;
  if(!Number.isFinite(result)||result>Number.MAX_SAFE_INTEGER)throw new Error('Montant converti trop élevé.');
  return result;
}
export function fmtCurrency(amount:number,code:CurrencyCode){
  if(!Number.isFinite(amount))return '—';
  const digits=code==='MGA'||code==='JPY'?0:2;
  return new Intl.NumberFormat('fr-FR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(amount)+' '+code;
}
export function ariaryImpact(available:number,amount:number,rate:number,from:CurrencyCode,to:CurrencyCode):{purchaseMGA:number;remainingMGA:number}|null{
  const converted=estimateCurrency(amount,rate);
  const actual=from==='MGA'?amount:to==='MGA'?converted:null;
  if(actual===null)return null;
  const purchaseMGA=Math.round(actual);
  if(!Number.isSafeInteger(purchaseMGA)||!Number.isSafeInteger(available-purchaseMGA))throw new Error('Montant simulé trop élevé.');
  return {purchaseMGA,remainingMGA:available-purchaseMGA};
}
