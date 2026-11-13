begin;

create or replace function public.resolve_report(
  p_report_id uuid,
  p_status public.report_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_report public.reports%rowtype;
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
  v_action public.admin_action_type;
  v_notification_type public.notification_type;
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('reviewed', 'dismissed') then
    raise exception 'status must be reviewed or dismissed' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 5000 then
    raise exception 'moderation notes cannot exceed 5000 characters'
      using errcode = '22023';
  end if;

  select * into v_report
  from public.reports
  where id = p_report_id
  for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'report is not pending' using errcode = '23514';
  end if;

  update public.reports
  set status = p_status,
      moderation_notes = v_notes,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now()
  where id = p_report_id;

  v_action := case
    when p_status = 'reviewed' then 'report_reviewed'::public.admin_action_type
    else 'report_dismissed'::public.admin_action_type
  end;
  v_notification_type := case
    when p_status = 'reviewed' then 'report_reviewed'::public.notification_type
    else 'report_dismissed'::public.notification_type
  end;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(),
    v_action,
    'report',
    p_report_id,
    pg_catalog.jsonb_build_object('notes', v_notes)
  );

  insert into public.notifications (
    recipient_id, notification_type, title, body
  )
  values (
    v_report.reporter_id,
    v_notification_type,
    case
      when p_status = 'reviewed' then 'Your report was reviewed'
      else 'Your report was closed'
    end,
    case
      when p_status = 'reviewed' then 'Our moderation team has reviewed your report.'
      else 'Our moderation team has closed your report.'
    end
  );
end;
$$;

commit;
