import type {State} from './finance';
import {money} from './finance';
export const displayMoney=(s:State,v:number)=>s.extra?.preferences.hideAmounts?'•••• Ar':money(v);
