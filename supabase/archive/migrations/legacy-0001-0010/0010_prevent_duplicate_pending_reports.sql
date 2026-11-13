begin;

do $$
begin
  if exists (
    select 1
    from public.reports
    where status = 'pending'
      and trip_id is not null
    group by reporter_id, trip_id, category
    having count(*) > 1
  ) or exists (
    select 1
    from public.reports
    where status = 'pending'
      and organizer_profile_id is not null
    group by reporter_id, organizer_profile_id, category
    having count(*) > 1
  ) or exists (
    select 1
    from public.reports
    where status = 'pending'
      and target_user_id is not null
    group by reporter_id, target_user_id, category
    having count(*) > 1
  ) then
    raise exception 'duplicate pending reports exist; review them before applying this migration'
      using errcode = '23505';
  end if;
end;
$$;

create unique index reports_one_pending_per_trip_reason_idx
  on public.reports (reporter_id, trip_id, category)
  where status = 'pending' and trip_id is not null;

create unique index reports_one_pending_per_organizer_reason_idx
  on public.reports (reporter_id, organizer_profile_id, category)
  where status = 'pending' and organizer_profile_id is not null;

create unique index reports_one_pending_per_customer_reason_idx
  on public.reports (reporter_id, target_user_id, category)
  where status = 'pending' and target_user_id is not null;

commit;
