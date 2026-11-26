'use client';
import {useMemo} from 'react';
import {forecast} from '@/lib/advanced-finance';
import {displayMoney} from '@/lib/display';
import {today, type State} from '@/lib/finance';

const dateLabel = (date: string) => date.split('-').reverse().join('/');
type Props = {s: State; horizon: number; onHorizon: (days: number) => void};

export default function TreasuryForecast({s, horizon, onHorizon}: Props) {
  const asOf = today();
  const f = useMemo(() => forecast(s, horizon, asOf), [s, horizon, asOf]);
  const money = (amount: number) => displayMoney(s, amount);
  const wallets = new Map(s.wallets.map(w => [w.id, w.name]));
  return <section className="card treasury-forecast">
    <div className="section-title">
      <h2>Trésorerie prévisionnelle</h2>
      <select aria-label="Horizon" value={horizon} onChange={event => onHorizon(Number(event.target.value))}>
        {[30, 90, 365].map(days => <option key={days} value={days}>{days} jours</option>)}
      </select>
    </div>
    <div className="forecast-projection">
      <span>Disponible projeté au <time dateTime={f.until}>{dateLabel(f.until)}</time></span>
      <strong>{money(f.projectedAvailable)}</strong>
    </div>
    <dl className="forecast-totals">
      <div><dt>Disponible aujourd’hui</dt><dd>{money(f.usable)}<small>Hors réserve et provisions</small></dd></div>
      <div><dt>Entrées prévues</dt><dd className="forecast-incoming">{f.unpricedIncome > 0 && f.expectedIncome === 0 ? 'À préciser' : money(f.expectedIncome)}
        {f.unpricedIncome > 0 && <small>{f.unpricedIncome} {f.unpricedIncome === 1 ? 'montant à préciser' : 'montants à préciser'}</small>}
      </dd></div>
      <div><dt>Échéances à couvrir</dt><dd>{f.unpricedExpense > 0 && f.planned === 0 ? 'À préciser' : money(f.unfunded)}
        {f.funded > 0 && <small>{money(f.funded)} déjà provisionnés</small>}
        {f.unpricedExpense > 0 && <small>{f.unpricedExpense} {f.unpricedExpense === 1 ? 'montant à préciser' : 'montants à préciser'}</small>}
      </dd></div>
    </dl>
    {f.shortfall && <p className="notice">Manque prévisionnel maximal de {money(f.shortfall.amount)} le {dateLabel(f.shortfall.date)}.</p>}
    {(f.unpricedIncome > 0 || f.unpricedExpense > 0) && <p className="form-help">Le disponible projeté tient compte des montants connus.</p>}
    {f.rows.length ? <ul className="forecast-movements" aria-label="Mouvements prévus">
      {f.rows.map(row => {
        const incoming = row.direction === 'income';
        return <li key={row.id}>
          <div><strong>{row.name}</strong><small>{incoming ? 'Entrée prévue' : 'Échéance'} · <time dateTime={row.date}>{dateLabel(row.date)}</time>
            {row.date < asOf && ' · En retard'}{row.walletId && wallets.has(row.walletId) && ' · ' + wallets.get(row.walletId)}
          </small></div>
          <div><strong className={incoming ? 'forecast-incoming' : undefined}>{row.amount === null ? 'À préciser' : (incoming ? '+' : '−') + money(row.amount)}</strong>
            {row.provision > 0 && <small>{money(row.provision)} provisionnés</small>}
          </div>
        </li>;
      })}
    </ul> : <p className="muted">Aucune entrée ni échéance prévue sur cette période.</p>}
  </section>;
}
