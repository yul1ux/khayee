begin;

alter table public.trips
  add column emergency_contact_information text;
alter table public.trip_revisions
  add column emergency_contact_information text;

alter table public.trips
  add constraint trips_emergency_contact_information_length check (
    emergency_contact_information is null
    or char_length(emergency_contact_information) <= 1000
  );
alter table public.trip_revisions
  add constraint trip_revisions_emergency_contact_information_length check (
    emergency_contact_information is null
    or char_length(emergency_contact_information) <= 1000
  );

grant select (emergency_contact_information)
  on table public.trips to anon, authenticated;
grant update (emergency_contact_information)
  on table public.trips to authenticated;
grant insert (emergency_contact_information)
  on table public.trip_revisions to authenticated;
grant update (emergency_contact_information)
  on table public.trip_revisions to authenticated;

create function private.apply_trip_revision_emergency_contact()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'approved' and old.status = 'pending_review' then
    update public.trips
    set emergency_contact_information = new.emergency_contact_information
    where id = new.trip_id;
  end if;
  return new;
end;
$$;

create trigger trip_revision_apply_emergency_contact
  after update of status on public.trip_revisions
  for each row
  when (new.status = 'approved' and old.status = 'pending_review')
  execute function private.apply_trip_revision_emergency_contact();

revoke all on function private.apply_trip_revision_emergency_contact()
  from public, anon, authenticated;

commit;
