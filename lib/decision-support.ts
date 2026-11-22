import * as F from './finance';
import {forecast} from './advanced-finance';

export type Horizon = 30 | 90 | 365;
export type ScenarioInput = {
  /** Nouvelle dépense hypothétique, indépendante des échéances déjà enregistrées. */
  purchase: number;
  /** Hausse hypothétique des besoins essentiels pour 30 jours. */
  extraEssentialMonthly: number;
  horizon: Horizon;
};
export type ScenarioResult = {
  usableToday: number;
  purchase: number;
  afterPurchase: number;
  plannedCommitments: number;
  alreadyProvisioned: number;
  unfundedCommitments: number;
  freeAfterUnfunded: number;
  gap: number;
  daysOfEssentialNeeds: number | null;
  reserveUntouched: number;
  estimatedEssentialMonthly: number;
};
function nonNegativeSafe(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(name + ' doit être un entier positif ou nul en Ariary.');
  }
  return value;
}
function safeAdd(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error('Montants trop importants pour une simulation fiable.');
  return result;
}
/**
 * Simule sans écrire dans le journal ni toucher à IndexedDB/Supabase.
 * Deux vues indépendantes :
 *  - le disponible après les engagements explicitement programmés, hors provisions ;
 *  - l'autonomie à consommation essentielle constante, sans nouvelle rentrée.
 * Ces vues NE S'ADDITIONNENT PAS : un engagement peut déjà faire partie des besoins essentiels.
 */
export function evaluateScenario(state: F.State, input: ScenarioInput): ScenarioResult {
  const purchase = nonNegativeSafe(input.purchase, 'La dépense');
  const extra = nonNegativeSafe(input.extraEssentialMonthly, 'Le besoin supplémentaire');
  if (![30, 90, 365].includes(input.horizon)) throw new Error('Horizon de simulation inconnu.');
  const summary = F.summary(state);
  const future = forecast(state, input.horizon);
  const estimatedEssentialMonthly = safeAdd(state.settings.essentialMonthly, extra);
  const afterPurchase = summary.usable - purchase;
  const freeAfterUnfunded = afterPurchase - future.unfunded;
  const gap = Math.max(0, -freeAfterUnfunded);
  if (!Number.isSafeInteger(afterPurchase) || !Number.isSafeInteger(freeAfterUnfunded)) {
    throw new Error('Montants trop importants pour une simulation fiable.');
  }
  const daysOfEssentialNeeds = estimatedEssentialMonthly > 0
    ? Math.floor(Math.max(0, afterPurchase) * 30 / estimatedEssentialMonthly)
    : null;
  return {
    usableToday: summary.usable,
    purchase,
    afterPurchase,
    plannedCommitments: future.planned,
    alreadyProvisioned: future.funded,
    unfundedCommitments: future.unfunded,
    freeAfterUnfunded: Math.max(0, freeAfterUnfunded),
    gap,
    daysOfEssentialNeeds,
    reserveUntouched: summary.reserve,
    estimatedEssentialMonthly,
  };
}

export type CategoryHint = {
  categoryId: string;
  categoryName: string;
  matchingOperations: number;
  explanation: string;
};
const normalize = (label: string) => label
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

/**
 * Aide 100 % locale, sans apprentissage externe et sans saisie automatique.
 * Ne recommande que des libellés identiques vus deux fois avec UNE catégorie stable.
 */
export function suggestExpenseCategory(state: F.State, proposedLabel: string): CategoryHint | null {
  const sought = normalize(proposedLabel);
  if (sought.length < 3) return null;
  const matches = F.activeOperations(state)
    .filter(o => o.kind === 'expense' && normalize(o.label) === sought)
    .map(o => [...new Set(o.expenses.filter(e => e.role !== 'fee').map(e => e.categoryId))]);
  if (matches.length < 2 || matches.some(ids => ids.length !== 1)) return null;
  const ids = new Set(matches.map(m => m[0]));
  if (ids.size !== 1) return null;
  const categoryId = matches[0][0];
  const category = state.categories.find(c => c.id === categoryId);
  if (!category || category.archived) return null;
  return {
    categoryId,
    categoryName: category.name,
    matchingOperations: matches.length,
    explanation: 'Proposition fondée sur des opérations précédentes de même libellé. À confirmer manuellement.',
  };
}

export type LocalInsight = {
  id: 'needs' | 'commitments' | 'reserve';
  severity: 'attention' | 'information';
  title: string;
  description: string;
};
export function localInsights(state: F.State, horizon: Horizon = 30): LocalInsight[] {
  const summary = F.summary(state);
  const future = forecast(state, horizon);
  const result: LocalInsight[] = [];
  if (!state.settings.essentialMonthly) result.push({
    id: 'needs', severity: 'information', title: 'Autonomie à configurer',
    description: 'Renseigne tes besoins essentiels sur 30 jours pour obtenir une estimation d’autonomie.',
  });
  if (future.unfunded > summary.usable) result.push({
    id: 'commitments', severity: 'attention', title: 'Engagements à surveiller',
    description: 'Les échéances sans provision dépassent le disponible hors réserve pour cette période.',
  });
  else if (future.unfunded > 0) result.push({
    id: 'commitments', severity: 'information', title: 'Engagements à anticiper',
    description: 'Certaines échéances de cette période ne sont pas encore entièrement provisionnées.',
  });
  if (state.settings.reserveTarget > summary.reserve) result.push({
    id: 'reserve', severity: 'information', title: 'Réserve sous l’objectif',
    description: 'Ton objectif de réserve n’est pas encore atteint. Aucune répartition automatique n’est effectuée.',
  });
  return result;
}
