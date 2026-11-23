-- Safe, opt-in restoration when the remote account contains ONLY its initial placeholder entry.
-- Never replace a remote journal with transactions, and always snapshot the previous state.
create or replace function poketra_private.restore_initial_document(
  p_mutation uuid, p_expected integer, p_state jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_doc public.poketra_documents%rowtype;
  v_request public.poketra_requests%rowtype;
  v_hash text;
  v_now timestamptz := now();
begin
  if v_owner is null or not exists(select 1 from public.poketra_access where owner_id=v_owner) then
    raise exception 'Accès Poketra non autorisé.' using errcode='42501';
  end if;
  if p_mutation is null or p_expected is null or p_expected<0 or p_state is null
    or jsonb_typeof(p_state->'operations') is distinct from 'array'
    or jsonb_array_length(p_state->'operations')<1
    or p_state->'operations'->0->>'kind' is distinct from 'opening'
    or jsonb_typeof(p_state->'wallets') is distinct from 'array'
    or octet_length(p_state::text)>10000000 then
    raise exception 'Sauvegarde invalide.' using errcode='22023';
  end if;
  v_hash := encode(sha256(convert_to(p_state::text,'UTF8')),'hex');
  select * into v_doc from public.poketra_documents where owner_id=v_owner for update;
  if not found then
    return jsonb_build_object('conflict',true,'error','Aucun journal initial à restaurer.');
  end if;
  select * into v_request from public.poketra_requests where owner_id=v_owner and mutation_id=p_mutation;
  if found then
    if v_request.request_hash<>v_hash then
      raise exception 'Commande de restauration réutilisée avec un contenu différent.' using errcode='23505';
    end if;
    return jsonb_build_object('ownerId',v_owner,'revision',v_request.revision,'state',v_request.state,
      'updatedAt',v_request.created_at,'mutationId',p_mutation,'idempotent',true);
  end if;
  if v_doc.revision<>p_expected then
    return jsonb_build_object('conflict',true,'remote',jsonb_build_object('ownerId',v_owner,
      'revision',v_doc.revision,'state',v_doc.state,'updatedAt',v_doc.updated_at));
  end if;
  if v_doc.state is null or jsonb_typeof(v_doc.state->'operations') is distinct from 'array'
    or jsonb_array_length(v_doc.state->'operations')<>1
    or v_doc.state->'operations'->0->>'kind' is distinct from 'opening' then
    raise exception 'Le journal serveur contient des opérations qui ne peuvent pas être remplacées.' using errcode='23514';
  end if;
  insert into public.poketra_snapshots(owner_id,revision,state,created_at)
    values(v_owner,v_doc.revision,v_doc.state,v_doc.updated_at) on conflict do nothing;
  update public.poketra_documents
    set revision=revision+1,state=p_state,last_mutation=p_mutation,updated_at=v_now
    where owner_id=v_owner returning * into v_doc;
  insert into public.poketra_requests(owner_id,mutation_id,request_hash,revision,state,created_at)
    values(v_owner,p_mutation,v_hash,v_doc.revision,p_state,v_now);
  return jsonb_build_object('ownerId',v_owner,'revision',v_doc.revision,'state',p_state,
    'updatedAt',v_now,'mutationId',p_mutation);
end; $$;
revoke all on function poketra_private.restore_initial_document(uuid,integer,jsonb) from public,anon;
grant execute on function poketra_private.restore_initial_document(uuid,integer,jsonb) to authenticated;
create or replace function public.poketra_restore_initial_document(
  p_mutation uuid,p_expected integer,p_state jsonb
) returns jsonb language sql security invoker set search_path='' as $$
  select poketra_private.restore_initial_document(p_mutation,p_expected,p_state);
$$;
revoke all on function public.poketra_restore_initial_document(uuid,integer,jsonb) from public,anon;
grant execute on function public.poketra_restore_initial_document(uuid,integer,jsonb) to authenticated;