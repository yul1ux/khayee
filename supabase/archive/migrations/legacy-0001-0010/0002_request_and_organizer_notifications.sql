begin;

alter type public.notification_type
  add value if not exists 'trip_request_cancelled';
alter type public.notification_type
  add value if not exists 'organizer_verified';
alter type public.notification_type
  add value if not exists 'organizer_rejected';

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

create or replace function public.review_organizer_profile(
  p_organizer_profile_id uuid,
  p_status public.organizer_verification_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.organizer_profiles%rowtype;
  v_details public.organizer_verification_details%rowtype;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
  v_action public.admin_action_type;
  v_notification_type public.notification_type;
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('verified', 'rejected') then
    raise exception 'status must be verified or rejected' using errcode = '22023';
  end if;
  if p_status = 'rejected'
    and (v_reason is null or char_length(v_reason) > 2000)
  then
    raise exception 'a rejection reason between 1 and 2000 characters is required'
      using errcode = '22023';
  end if;
  if p_status = 'verified' and p_reason is not null then
    raise exception 'a reason is only accepted for rejected verification'
      using errcode = '22023';
  end if;

  select * into v_profile
  from public.organizer_profiles
  where id = p_organizer_profile_id
  for update;
  if not found then
    raise exception 'organizer profile not found' using errcode = 'P0002';
  end if;

  select * into v_details
  from public.organizer_verification_details
  where organizer_profile_id = p_organizer_profile_id
  for update;
  if not found then
    raise exception 'organizer verification details not found'
      using errcode = 'P0002';
  end if;

  update public.organizer_profiles
  set verification_status = p_status
  where id = p_organizer_profile_id;

  update public.organizer_verification_details
  set verification_rejection_reason = case
        when p_status = 'rejected' then v_reason
        else null
      end,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now()
  where organizer_profile_id = p_organizer_profile_id;

  v_action := case
    when p_status = 'verified' then 'organizer_verified'::public.admin_action_type
    else 'organizer_rejected'::public.admin_action_type
  end;
  v_notification_type := case
    when p_status = 'verified' then 'organizer_verified'::public.notification_type
    else 'organizer_rejected'::public.notification_type
  end;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(),
    v_action,
    'organizer_profile',
    p_organizer_profile_id,
    pg_catalog.jsonb_build_object('reason', v_reason)
  );

  insert into public.notifications (
    recipient_id, notification_type, title, body
  )
  values (
    v_profile.user_id,
    v_notification_type,
    case
      when p_status = 'verified' then 'Your organizer application was approved'
      else 'Your organizer application needs changes'
    end,
    case
      when p_status = 'verified' then 'Your organizer profile is verified. You can now submit trips for review.'
      else pg_catalog.format('Your organizer application was not approved: %s', v_reason)
    end
  );
end;
$$;

commit;
