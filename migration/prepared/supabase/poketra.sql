-- Additive schema: existing applications and their data are unchanged.
create schema if not exists poketra_private;
revoke all on schema poketra_private from public;
grant usage on schema poketra_private to authenticated;
create table public.poketra_access (
  owner_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
create table public.poketra_documents (
  owner_id uuid primary key references auth.users(id),
  revision integer not null default 0 check (revision >= 0), state jsonb,
  last_mutation uuid, updated_at timestamptz not null default now()
);
create table public.poketra_snapshots (
  owner_id uuid not null references auth.users(id), revision integer not null,
  state jsonb not null, created_at timestamptz not null default now(), primary key (owner_id, revision)
);
create table public.poketra_requests (
  owner_id uuid not null references auth.users(id), mutation_id uuid not null,
  request_hash text not null, revision integer not null, state jsonb not null,
  created_at timestamptz not null default now(), primary key (owner_id, mutation_id)
);
create table public.poketra_files (
  owner_id uuid not null references auth.users(id), id uuid not null,
  object_key text not null, digest text not null, name text not null,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp','application/pdf')),
  size integer not null check (size between 1 and 6000000), operation_id text not null,
  created_at timestamptz not null, primary key (owner_id, id)
);
alter table public.poketra_access enable row level security;
alter table public.poketra_documents enable row level security;
alter table public.poketra_snapshots enable row level security;
alter table public.poketra_requests enable row level security;
alter table public.poketra_files enable row level security;
revoke all on public.poketra_access, public.poketra_documents, public.poketra_snapshots,
  public.poketra_requests, public.poketra_files from anon, authenticated;
grant select on public.poketra_access, public.poketra_documents, public.poketra_snapshots,
  public.poketra_requests, public.poketra_files to authenticated;
grant insert on public.poketra_files to authenticated;
create policy poketra_access_self on public.poketra_access for select to authenticated
  using (owner_id = (select auth.uid()));
create policy poketra_documents_self on public.poketra_documents for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
create policy poketra_snapshots_self on public.poketra_snapshots for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
create policy poketra_requests_self on public.poketra_requests for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
create policy poketra_files_self on public.poketra_files for select to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
create policy poketra_files_insert on public.poketra_files for insert to authenticated
  with check (owner_id = (select auth.uid()) and object_key = owner_id::text || '/' || id::text || '/' || digest
    and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));

-- Private definer: restrict writes to an atomic, authenticated transaction.
create function poketra_private.save_document(p_mutation uuid, p_expected integer, p_state jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_doc public.poketra_documents%rowtype;
  v_request public.poketra_requests%rowtype; v_hash text; v_now timestamptz := now();
begin
  if v_owner is null or not exists (select 1 from public.poketra_access where owner_id = v_owner) then
    raise exception 'Accès Poketra non autorisé.' using errcode = '42501';
  end if;
  if p_mutation is null or p_expected is null or p_expected < 0 or p_state is null
    or jsonb_typeof(p_state->'operations') is distinct from 'array'
    or jsonb_typeof(p_state->'wallets') is distinct from 'array'
    or octet_length(p_state::text) > 10000000 then
    raise exception 'Commande invalide.' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_state::text, 'UTF8')), 'hex');
  insert into public.poketra_documents(owner_id) values (v_owner) on conflict do nothing;
  select * into v_doc from public.poketra_documents where owner_id = v_owner for update;
  select * into v_request from public.poketra_requests where owner_id = v_owner and mutation_id = p_mutation;
  if found then
    if v_request.request_hash <> v_hash then
      raise exception 'Identifiant de commande réutilisé avec un contenu différent.' using errcode = '23505';
    end if;
    return jsonb_build_object('ownerId', v_owner, 'revision', v_request.revision, 'state', v_request.state,
      'updatedAt', v_request.created_at, 'mutationId', p_mutation, 'idempotent', true);
  end if;
  if v_doc.revision <> p_expected then
    return jsonb_build_object('conflict', true, 'remote', jsonb_build_object('ownerId', v_owner,
      'revision', v_doc.revision, 'state', v_doc.state, 'updatedAt', v_doc.updated_at));
  end if;
  if v_doc.state is not null and (
    jsonb_array_length(p_state->'operations') < jsonb_array_length(v_doc.state->'operations')
    or exists (select 1 from jsonb_array_elements(v_doc.state->'operations') with ordinality as op(value, n)
      where op.value is distinct from (p_state->'operations')->(op.n::integer - 1))
  ) then
    raise exception 'Le journal serveur ne peut pas être supprimé ou remplacé.' using errcode = '23514';
  end if;
  if v_doc.state is not null then
    insert into public.poketra_snapshots(owner_id, revision, state, created_at)
      values(v_owner, v_doc.revision, v_doc.state, v_doc.updated_at) on conflict do nothing;
  end if;
  update public.poketra_documents set revision = revision + 1, state = p_state,
    last_mutation = p_mutation, updated_at = v_now where owner_id = v_owner returning * into v_doc;
  insert into public.poketra_requests(owner_id, mutation_id, request_hash, revision, state, created_at)
    values(v_owner, p_mutation, v_hash, v_doc.revision, p_state, v_now);
  return jsonb_build_object('ownerId', v_owner, 'revision', v_doc.revision, 'state', p_state,
    'updatedAt', v_now, 'mutationId', p_mutation);
end;
$$;
revoke all on function poketra_private.save_document(uuid,integer,jsonb) from public, anon;
grant execute on function poketra_private.save_document(uuid,integer,jsonb) to authenticated;
create function public.poketra_save_document(p_mutation uuid, p_expected integer, p_state jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select poketra_private.save_document(p_mutation, p_expected, p_state);
$$;
revoke all on function public.poketra_save_document(uuid,integer,jsonb) from public, anon;
grant execute on function public.poketra_save_document(uuid,integer,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('poketra-receipts','poketra-receipts',false,6000000,
  array['image/jpeg','image/png','image/webp','application/pdf']) on conflict do nothing;
create policy poketra_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'poketra-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
create policy poketra_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'poketra-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.poketra_access a where a.owner_id = (select auth.uid())));
