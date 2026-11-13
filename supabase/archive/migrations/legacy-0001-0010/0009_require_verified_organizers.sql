begin;

create function private.require_verified_organizer_for_trip_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status in ('pending_review', 'published')
    and new.status is distinct from old.status
    and not exists (
      select 1
      from public.organizer_profiles as op
      where op.id = new.organizer_profile_id
        and op.verification_status = 'verified'
    )
  then
    raise exception 'organizer verification is required to submit or publish trips'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trips_require_verified_organizer
  before update of status on public.trips
  for each row
  when (
    new.status in ('pending_review', 'published')
    and new.status is distinct from old.status
  )
  execute function private.require_verified_organizer_for_trip_transition();

create function private.require_verified_organizer_for_revision_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status in ('pending_review', 'approved')
    and new.status is distinct from old.status
    and not exists (
      select 1
      from public.trips as t
      join public.organizer_profiles as op
        on op.id = t.organizer_profile_id
      where t.id = new.trip_id
        and op.verification_status = 'verified'
    )
  then
    raise exception 'organizer verification is required to submit or approve trip revisions'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger trip_revisions_require_verified_organizer
  before update of status on public.trip_revisions
  for each row
  when (
    new.status in ('pending_review', 'approved')
    and new.status is distinct from old.status
  )
  execute function private.require_verified_organizer_for_revision_transition();

revoke all on function private.require_verified_organizer_for_trip_transition()
  from public, anon, authenticated;
revoke all on function private.require_verified_organizer_for_revision_transition()
  from public, anon, authenticated;

commit;
