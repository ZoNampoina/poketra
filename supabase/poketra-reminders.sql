-- Push reminders read the synchronized plan and never write to the financial journal.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.poketra_push_config (
  singleton boolean primary key default true check (singleton),
  dispatch_secret uuid not null default gen_random_uuid(),
  vapid_public text, vapid_private text
);
insert into public.poketra_push_config(singleton) values(true);
alter table public.poketra_push_config enable row level security;
revoke all on public.poketra_push_config from public, anon, authenticated;
grant select(vapid_public) on public.poketra_push_config to authenticated;
grant select, update on public.poketra_push_config to service_role;
create policy poketra_push_public_key on public.poketra_push_config for select to authenticated
  using (exists(select 1 from public.poketra_access where owner_id=(select auth.uid())));

create table public.poketra_push_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (length(endpoint)<=2048 and endpoint ~ '^https://'),
  keys jsonb not null check (jsonb_typeof(keys)='object' and keys ?& array['auth','p256dh']
    and keys->>'auth' ~ '^[A-Za-z0-9_-]{22}$' and keys->>'p256dh' ~ '^[A-Za-z0-9_-]{87}$'),
  unique(owner_id,endpoint)
);
alter table public.poketra_push_devices enable row level security;
revoke all on public.poketra_push_devices from public,anon,authenticated;
grant select,delete on public.poketra_push_devices to authenticated;
grant insert(owner_id,endpoint,keys), update(owner_id,endpoint,keys) on public.poketra_push_devices to authenticated;
grant select,delete on public.poketra_push_devices to service_role;
create policy poketra_push_device_owner on public.poketra_push_devices for all to authenticated
  using (owner_id=(select auth.uid()) and exists(select 1 from public.poketra_access where owner_id=(select auth.uid())))
  with check (owner_id=(select auth.uid()) and exists(select 1 from public.poketra_access where owner_id=(select auth.uid())));

create table public.poketra_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.poketra_push_devices(id) on delete cascade,
  plan_id text not null, occurrence text not null, due_at timestamptz not null,
  attempts integer not null default 1, next_try timestamptz not null, sent_at timestamptz,
  unique(device_id,plan_id,occurrence,due_at)
);
alter table public.poketra_push_deliveries enable row level security;
revoke all on public.poketra_push_deliveries from public,anon,authenticated;
grant select,insert,update on public.poketra_push_deliveries to service_role;

-- An invalid imported date must not stop delivery to other devices.
create function poketra_private.reminder_timestamp(p jsonb)
returns timestamptz language plpgsql stable security invoker set search_path='' as $$
begin
  return coalesce(p->>'remindAt', (p->>'due')||'T'||coalesce(p->>'reminderTime','09:00')||':00+03:00')::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value then return null;
end $$;
create view poketra_private.push_due with (security_invoker=true) as
  select d.id device_id,d.endpoint,d.keys,o.value plan,
         coalesce(o.value->>'scheduledFor',o.value->>'due') occurrence,
         t.due_at,coalesce(doc.state#>>'{extra,preferences,hideAmounts}','false')='true' hide_amounts
    from public.poketra_push_devices d join public.poketra_documents doc using(owner_id)
    join public.poketra_access a using(owner_id)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(doc.state->'obligations')='array' then doc.state->'obligations' else '[]'::jsonb end) o(value)
    cross join lateral (select poketra_private.reminder_timestamp(o.value) due_at) t
    left join public.poketra_push_deliveries sent
      on sent.device_id=d.id and sent.plan_id=o.value->>'id'
      and sent.occurrence=coalesce(o.value->>'scheduledFor',o.value->>'due') and sent.due_at=t.due_at
    where t.due_at<=now() and o.value->>'id' is not null
      and coalesce(o.value->>'status','upcoming') not in ('cancelled','completed')
      and not(coalesce(o.value->'paidDates','[]'::jsonb) ? coalesce(o.value->>'scheduledFor',o.value->>'due'))
      and sent.sent_at is null and (sent.next_try is null or sent.next_try<=now());

revoke all on function poketra_private.reminder_timestamp(jsonb) from public,anon,authenticated;
revoke all on poketra_private.push_due from public,anon,authenticated;
grant usage on schema poketra_private to service_role;
grant select on poketra_private.push_due to service_role;
grant execute on function poketra_private.reminder_timestamp(jsonb) to service_role;

-- Leases protect against duplicate dispatchers and are released automatically after interruption.
create function public.poketra_claim_reminders()
returns table (delivery uuid, attempt integer, device uuid, endpoint text, keys jsonb, plan jsonb, occurrence text, due_at timestamptz, hide_amounts boolean)
language sql volatile security invoker set search_path='' as $$
  with candidates as materialized (
    select * from poketra_private.push_due order by due_at,device_id limit 40
  ), claimed as (
    insert into public.poketra_push_deliveries as dst(device_id,plan_id,occurrence,due_at,next_try)
    select c.device_id,c.plan->>'id',c.occurrence,c.due_at,now()+interval '3 minutes' from candidates c
    on conflict(device_id,plan_id,occurrence,due_at) do update
      set attempts=dst.attempts+1,next_try=now()+interval '3 minutes'
      where dst.sent_at is null and dst.next_try<=now()
    returning id,attempts,device_id,plan_id,occurrence,due_at
  )
  select l.id,l.attempts,c.device_id,c.endpoint,c.keys,c.plan,c.occurrence,c.due_at,c.hide_amounts
  from claimed l join candidates c on l.device_id=c.device_id and l.plan_id=c.plan->>'id'
    and l.occurrence=c.occurrence and l.due_at=c.due_at
$$;
revoke all on function public.poketra_claim_reminders() from public,anon,authenticated;
grant execute on function public.poketra_claim_reminders() to service_role;

create function poketra_private.wake_reminders() returns void
language plpgsql security invoker set search_path='' as $$
declare cfg public.poketra_push_config%rowtype;
begin
  select * into strict cfg from public.poketra_push_config;
  if cfg.vapid_public is null or exists(select from poketra_private.push_due) then
    perform net.http_post(url:='https://uhuxkkiqpzcfefjkjwqn.supabase.co/functions/v1/poketra-reminders',
      headers:=jsonb_build_object('Content-Type','application/json','x-poketra-dispatch',cfg.dispatch_secret),
      body:='{}'::jsonb,timeout_milliseconds:=30000);
  end if;
end $$;
revoke all on function poketra_private.wake_reminders() from public,anon,authenticated;
select cron.schedule('poketra-due-reminders','* * * * *','select poketra_private.wake_reminders()');
