begin;

create or replace function private.notify_admins(
  p_notification_type public.notification_type,
  p_title text,
  p_body text,
  p_trip_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.notifications (
    recipient_id, notification_type, title, body, trip_id
  )
  select
    ur.user_id,
    p_notification_type,
    p_title,
    p_body,
    p_trip_id
  from public.user_roles as ur
  where ur.role = 'admin';
end;
$$;

create function private.notify_new_organizer_application()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.verification_status = 'pending' then
    perform private.notify_admins(
      'organizer_application_submitted',
      'Organizer application submitted',
      'A new organizer application is ready for review.'
    );
  end if;
  return new;
end;
$$;

create function private.notify_trip_submitted()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'pending_review' and old.status is distinct from new.status then
    perform private.notify_admins(
      'trip_submitted',
      'Trip submitted for review',
      pg_catalog.format('"%s" is ready for review.', new.title),
      new.id
    );
  end if;
  return new;
end;
$$;

create function private.notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform private.notify_admins(
    'report_submitted',
    'New report submitted',
    'A new report is ready for review.',
    new.trip_id
  );
  return new;
end;
$$;

create or replace function private.notify_trip_request_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_title text;
  v_organizer_user_id uuid;
begin
  if tg_op = 'INSERT' then
    select op.user_id, t.title
    into v_organizer_user_id, v_trip_title
    from public.trips as t
    join public.organizer_profiles as op
      on op.id = t.organizer_profile_id
    where t.id = new.trip_id;

    insert into public.notifications (
      recipient_id, notification_type, title, body, trip_id, trip_request_id
    )
    values (
      new.customer_id,
      'trip_request_submitted',
      'Your trip request was sent',
      pg_catalog.format('Your request for "%s" is waiting for the organizer.', v_trip_title),
      new.trip_id,
      new.id
    );

    if v_organizer_user_id is not null then
      insert into public.notifications (
        recipient_id, notification_type, title, body, trip_id, trip_request_id
      )
      values (
        v_organizer_user_id,
        'trip_request_received',
        'New trip request',
        pg_catalog.format('A customer requested %s place(s) on "%s".', new.party_size, v_trip_title),
        new.trip_id,
        new.id
      );
    end if;
  elsif new.status is distinct from old.status then
    select t.title, op.user_id
    into v_trip_title, v_organizer_user_id
    from public.trips as t
    join public.organizer_profiles as op
      on op.id = t.organizer_profile_id
    where t.id = new.trip_id;

    if new.status = 'accepted' then
      insert into public.notifications (
        recipient_id, notification_type, title, body, trip_id, trip_request_id
      )
      values (
        new.customer_id,
        'trip_request_accepted',
        'Your trip request was accepted',
        pg_catalog.format('Your request for "%s" was accepted.', v_trip_title),
        new.trip_id,
        new.id
      );
    elsif new.status = 'rejected' then
      insert into public.notifications (
        recipient_id, notification_type, title, body, trip_id, trip_request_id
      )
      values (
        new.customer_id,
        'trip_request_rejected',
        'Your trip request was declined',
        pg_catalog.format('Your request for "%s" was declined.', v_trip_title),
        new.trip_id,
        new.id
      );
    elsif new.status = 'cancelled'
      and exists (
        select 1
        from public.trips as t
        where t.id = new.trip_id
          and t.status = 'published'
      )
    then
      insert into public.notifications (
        recipient_id, notification_type, title, body, trip_id, trip_request_id
      )
      values (
        v_organizer_user_id,
        'trip_request_cancelled',
        'A trip request was cancelled',
        pg_catalog.format('A customer cancelled a request for %s place(s) on "%s".', old.party_size, v_trip_title),
        new.trip_id,
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger organizer_profiles_notify_admins
  after insert on public.organizer_profiles
  for each row execute function private.notify_new_organizer_application();

create trigger trips_notify_admins_of_submission
  after update of status on public.trips
  for each row
  when (new.status = 'pending_review' and old.status is distinct from new.status)
  execute function private.notify_trip_submitted();

create trigger reports_notify_admins
  after insert on public.reports
  for each row execute function private.notify_new_report();

revoke all on function private.notify_admins(
  public.notification_type, text, text, uuid
) from public, anon, authenticated;
revoke all on function private.notify_new_organizer_application()
  from public, anon, authenticated;
revoke all on function private.notify_trip_submitted()
  from public, anon, authenticated;
revoke all on function private.notify_new_report()
  from public, anon, authenticated;
revoke all on function private.notify_trip_request_change()
  from public, anon, authenticated;

commit;
