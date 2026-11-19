-- Poketra: schéma de référence, non appliqué en production.
-- Créer une migration avec la CLI Supabase quand le projet dédié sera disponible.
-- Le client authentifié dispose seulement de SELECT. Les commandes d'écriture
-- passeront par le service de validation atomique décrit dans le cahier des charges.
begin;

create table public.poketra_workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 currency text not null default 'MGA' check (currency='MGA'),
 revision bigint not null default 0 check (revision>=0),
 reserve_target bigint not null default 0 check (reserve_target between 0 and 9007199254740991),
 essential_30_days bigint not null default 0 check (essential_30_days between 0 and 9007199254740991),
 name text not null,
 created_at timestamptz not null default now()
);
create index poketra_workspace_owner_idx on public.poketra_workspaces(owner_id);

create table public.poketra_wallets (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id text not null, name text not null,
 wallet_group text not null check (wallet_group in ('mobile','cash','bank')),
 archived boolean not null default false,
 primary key(workspace_id,id)
);
create table public.poketra_categories (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id text not null, name text not null, essential boolean not null default false,
 archived boolean not null default false,
 primary key(workspace_id,id)
);
create table public.poketra_subcategories (
 workspace_id uuid not null, id uuid not null default gen_random_uuid(),
 category_id text not null, name text not null, archived boolean not null default false,
 primary key(workspace_id,id),
 foreign key(workspace_id,category_id) references public.poketra_categories(workspace_id,id) on delete restrict,
 unique(workspace_id,category_id,name)
);
create index poketra_subcategory_category_idx on public.poketra_subcategories(workspace_id,category_id);

create table public.poketra_projects (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id uuid not null default gen_random_uuid(), name text not null,
 client text not null default '', description text not null default '',
 agreed bigint not null check (agreed between 0 and 9007199254740991),
 archived boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(workspace_id,id)
);
create table public.poketra_obligations (
 workspace_id uuid not null, id uuid not null default gen_random_uuid(),
 name text not null, amount bigint not null check (amount between 1 and 9007199254740991),
 category_id text not null, due_date date not null,
 recurrence text not null default 'once' check (recurrence in ('once','monthly')),
 archived boolean not null default false,
 primary key(workspace_id,id),
 foreign key(workspace_id,category_id) references public.poketra_categories(workspace_id,id) on delete restrict
);
create index poketra_obligation_category_idx on public.poketra_obligations(workspace_id,category_id);
create index poketra_obligation_due_idx on public.poketra_obligations(workspace_id,due_date);

create table public.poketra_funds (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id text not null, name text not null,
 kind text not null check (kind in ('unassigned','reserve','envelope','provision')),
 category_id text, project_id uuid, obligation_id uuid,
 primary key(workspace_id,id),
 foreign key(workspace_id,category_id) references public.poketra_categories(workspace_id,id) on delete restrict,
 foreign key(workspace_id,project_id) references public.poketra_projects(workspace_id,id) on delete restrict,
 foreign key(workspace_id,obligation_id) references public.poketra_obligations(workspace_id,id) on delete restrict,
 check ((kind='envelope')=(category_id is not null)),
 check (project_id is null or obligation_id is null),
 check (kind<>'reserve' or (project_id is null and obligation_id is null)),
 check (kind<>'provision' or (project_id is not null or obligation_id is not null)),
 check (obligation_id is null or kind='provision')
);
create unique index poketra_single_reserve_idx on public.poketra_funds(workspace_id) where kind='reserve';
create unique index poketra_category_envelope_idx on public.poketra_funds(workspace_id,category_id) where kind='envelope';
create index poketra_fund_project_idx on public.poketra_funds(workspace_id,project_id) where project_id is not null;
create index poketra_fund_obligation_idx on public.poketra_funds(workspace_id,obligation_id) where obligation_id is not null;

create table public.poketra_operations (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id uuid not null, -- UUID généré côté client et conservé lors des reprises
 sequence bigint generated always as identity,
 kind text not null check (kind in ('opening','income','expense','transfer','allocation','reversal','loan_disburse','loan_receive','loan_repay','loan_collect')),
 occurred_on date not null, label text not null,
 project_id uuid, obligation_id uuid, obligation_due date,
 reversal_of uuid, reserve_authorized boolean not null default false,
 request_hash text not null, -- même UUID avec contenu différent = rejet
 created_at timestamptz not null default now(),
 primary key(workspace_id,id),
 unique(workspace_id,sequence),
 foreign key(workspace_id,project_id) references public.poketra_projects(workspace_id,id) on delete restrict,
 foreign key(workspace_id,obligation_id) references public.poketra_obligations(workspace_id,id) on delete restrict,
 foreign key(workspace_id,reversal_of) references public.poketra_operations(workspace_id,id) on delete restrict,
 check ((kind='reversal')=(reversal_of is not null)),
 check (reversal_of is null or reversal_of<>id)
);
create unique index poketra_single_opening_idx on public.poketra_operations(workspace_id) where kind='opening';
create unique index poketra_single_reversal_idx on public.poketra_operations(workspace_id,reversal_of) where reversal_of is not null;
create index poketra_operation_date_idx on public.poketra_operations(workspace_id,occurred_on);
create index poketra_operation_project_idx on public.poketra_operations(workspace_id,project_id) where project_id is not null;
create index poketra_operation_obligation_idx on public.poketra_operations(workspace_id,obligation_id) where obligation_id is not null;

create table public.poketra_wallet_entries (
 workspace_id uuid not null, operation_id uuid not null,
 line_no integer not null check (line_no>=0), wallet_id text not null,
 delta bigint not null check (delta between -9007199254740991 and 9007199254740991),
 primary key(workspace_id,operation_id,line_no),
 foreign key(workspace_id,operation_id) references public.poketra_operations(workspace_id,id) on delete restrict,
 foreign key(workspace_id,wallet_id) references public.poketra_wallets(workspace_id,id) on delete restrict
);
create index poketra_wallet_entry_balance_idx on public.poketra_wallet_entries(workspace_id,wallet_id);
create table public.poketra_fund_entries (
 workspace_id uuid not null, operation_id uuid not null,
 line_no integer not null check (line_no>=0), fund_id text not null,
 delta bigint not null check (delta between -9007199254740991 and 9007199254740991),
 primary key(workspace_id,operation_id,line_no),
 foreign key(workspace_id,operation_id) references public.poketra_operations(workspace_id,id) on delete restrict,
 foreign key(workspace_id,fund_id) references public.poketra_funds(workspace_id,id) on delete restrict
);
create index poketra_fund_entry_balance_idx on public.poketra_fund_entries(workspace_id,fund_id);
create table public.poketra_expense_lines (
 workspace_id uuid not null, operation_id uuid not null,
 line_no integer not null check (line_no>=0),
 amount bigint not null check (amount between 1 and 9007199254740991),
 category_id text not null, subcategory_id uuid, fund_id text not null,
 project_id uuid, beneficiary text, label text not null,
 primary key(workspace_id,operation_id,line_no),
 foreign key(workspace_id,operation_id) references public.poketra_operations(workspace_id,id) on delete restrict,
 foreign key(workspace_id,category_id) references public.poketra_categories(workspace_id,id) on delete restrict,
 foreign key(workspace_id,subcategory_id) references public.poketra_subcategories(workspace_id,id) on delete restrict,
 foreign key(workspace_id,fund_id) references public.poketra_funds(workspace_id,id) on delete restrict,
 foreign key(workspace_id,project_id) references public.poketra_projects(workspace_id,id) on delete restrict
);
create index poketra_expense_category_idx on public.poketra_expense_lines(workspace_id,category_id);
create index poketra_expense_subcategory_idx on public.poketra_expense_lines(workspace_id,subcategory_id) where subcategory_id is not null;
create index poketra_expense_project_idx on public.poketra_expense_lines(workspace_id,project_id) where project_id is not null;
create index poketra_expense_fund_idx on public.poketra_expense_lines(workspace_id,fund_id);

create table public.poketra_loans (
 workspace_id uuid not null references public.poketra_workspaces(id) on delete restrict,
 id uuid not null default gen_random_uuid(),
 direction text not null check (direction in ('lent','borrowed')),
 counterparty text not null,
 agreed_principal bigint not null check (agreed_principal between 1 and 9007199254740991),
 due_date date, notes text not null default '',
 primary key(workspace_id,id)
);
-- Les écritures de principal et d'intérêts seront définies avec le module de prêts.

-- Les vues gardent les droits du lecteur. Elles incluent les contre-écritures.
create view public.poketra_wallet_balances with (security_invoker=true) as
 select w.workspace_id,w.id,coalesce(sum(e.delta),0) as balance
 from public.poketra_wallets w left join public.poketra_wallet_entries e
 on e.workspace_id=w.workspace_id and e.wallet_id=w.id
 group by w.workspace_id,w.id;
create view public.poketra_fund_balances with (security_invoker=true) as
 select f.workspace_id,f.id,coalesce(sum(e.delta),0) as balance
 from public.poketra_funds f left join public.poketra_fund_entries e
 on e.workspace_id=f.workspace_id and e.fund_id=f.id
 group by f.workspace_id,f.id;

alter table public.poketra_workspaces enable row level security;
create policy workspace_read on public.poketra_workspaces for select to authenticated
 using ((select auth.uid())=owner_id);

do $$
declare tbl text;
begin
 foreach tbl in array array['poketra_wallets','poketra_categories','poketra_subcategories','poketra_projects','poketra_obligations','poketra_funds','poketra_operations','poketra_wallet_entries','poketra_fund_entries','poketra_expense_lines','poketra_loans'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('create policy own_space_read on public.%I for select to authenticated using (workspace_id in (select id from public.poketra_workspaces where owner_id=(select auth.uid())))',tbl);
  execute format('revoke all on public.%I from anon, authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
 end loop;
end $$;
revoke all on public.poketra_workspaces from anon,authenticated;
grant select on public.poketra_workspaces to authenticated;
revoke all on public.poketra_wallet_balances,public.poketra_fund_balances from anon,authenticated;
grant select on public.poketra_wallet_balances,public.poketra_fund_balances to authenticated;

-- À implémenter avant de permettre des écritures :
-- 1. Contrôle Auth, idempotence et verrou de l'espace.
-- 2. Validation des formes d'opérations et égalité somme(wallets)=somme(funds).
-- 3. Contrôle des soldes non négatifs, des plafonds et de la confirmation réserve.
-- 4. Neutralisation exacte d'une opération originale et cohérence des échéances.
-- 5. INSERT de toutes les lignes + incrément de révision dans une transaction.
-- Aucune fonction privilégiée ou clé service_role n'est fournie au client.
commit;
