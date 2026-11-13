-- Read-only catalog and aggregate-data audit for migrations 0001-0010.
-- Run against the intended Supabase project in SQL Editor. Every statement
-- below is a SELECT; this script does not execute dynamic SQL or mutate data.

-- 1. Remote migration ledger. Compare this with the catalog checks below;
--    a ledger entry alone does not prove that the migration's effects exist.
with expected_migrations(version, expected_name) as (
  values
    ('0001', 'initial_schema'),
    ('0002', 'request_and_organizer_notifications'),
    ('0003', 'admin_trip_image_review'),
    ('0004', 'notification_event_types'),
    ('0005', 'notification_event_triggers'),
    ('0006', 'trip_emergency_contact'),
    ('0007', 'report_resolution_notification_types'),
    ('0008', 'report_resolution_notifications'),
    ('0009', 'require_verified_organizers'),
    ('0010', 'prevent_duplicate_pending_reports')
)
select
  coalesce(e.version, m.version) as version,
  e.expected_name,
  m.name as ledger_name,
  case
    when e.version is null then 'ledger entry has no local expected version'
    when m.version is null then 'not recorded in remote ledger'
    else 'recorded in remote ledger, schema effects still require verification'
  end as ledger_status
from expected_migrations e
full outer join supabase_migrations.schema_migrations m
  on m.version = e.version
order by coalesce(e.version, m.version);

-- 2. Migration 0002: private organizer verification details and their
--    expected table shape, constraints, RLS state, and owner/admin policies.
with expected_columns(table_name, column_name) as (
  values
    ('organizer_verification_details', 'organizer_profile_id'),
    ('organizer_verification_details', 'contact_email'),
    ('organizer_verification_details', 'reviewed_by'),
    ('organizer_verification_details', 'reviewed_at'),
    ('organizer_verification_details', 'verification_rejection_reason'),
    ('organizer_verification_details', 'created_at'),
    ('organizer_verification_details', 'updated_at')
)
select
  e.table_name,
  e.column_name,
  (c.column_name is not null) as present,
  c.data_type,
  c.is_nullable,
  c.column_default
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = e.column_name
order by e.table_name, e.column_name;

select
  expected.constraint_name,
  (con.conname is not null) as present,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from (
  values
    ('organizer_verification_details_pkey'),
    ('organizer_verification_details_contact_email_length'),
    ('organizer_verification_details_reviewer_pair'),
    ('organizer_verification_details_rejection_reason')
) as expected(constraint_name)
left join pg_catalog.pg_constraint con
  on con.conname = expected.constraint_name
  and con.conrelid = pg_catalog.to_regclass('public.organizer_verification_details')
order by expected.constraint_name;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'organizer_verification_details';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname, tablename, policyname) in (
  ('public', 'organizer_verification_details', 'organizer_verification_details_read_owner_or_admin'),
  ('public', 'organizer_verification_details', 'organizer_verification_details_update_contact_owner')
)
order by schemaname, tablename, policyname;

-- 3. Notification enum labels expected after migrations 0001, 0002, 0004,
--    and 0007. The source migration adding each label is included for clarity.
with expected_labels(label, introduced_by) as (
  values
    ('trip_request_received', '0001'),
    ('trip_request_accepted', '0001'),
    ('trip_request_rejected', '0001'),
    ('trip_approved', '0001'),
    ('trip_rejected', '0001'),
    ('trip_cancelled', '0001'),
    ('trip_request_cancelled', '0002'),
    ('organizer_verified', '0002'),
    ('organizer_rejected', '0002'),
    ('trip_request_submitted', '0004'),
    ('organizer_application_submitted', '0004'),
    ('trip_submitted', '0004'),
    ('report_submitted', '0004'),
    ('report_reviewed', '0007'),
    ('report_dismissed', '0007')
)
select
  e.label as expected_label,
  e.introduced_by,
  (en.enumlabel is not null) as present
from expected_labels e
left join pg_catalog.pg_namespace n
  on n.nspname = 'public'
left join pg_catalog.pg_type t
  on t.typname = 'notification_type'
  and t.typnamespace = n.oid
left join pg_catalog.pg_enum en
  on en.enumtypid = t.oid
  and en.enumlabel = e.label
order by e.introduced_by, e.label;

-- 4. Functions introduced/replaced by 0002-0008 and 0009. Presence, security
--    mode, execute privileges, and full function definitions are shown.
with expected_functions(signature, migration) as (
  values
    ('private.notify_trip_request_change()', '0002/0005'),
    ('public.review_organizer_profile(uuid,public.organizer_verification_status,text)', '0002'),
    ('private.is_published_trip_image(text)', '0003'),
    ('private.notify_admins(public.notification_type,text,text,uuid)', '0005'),
    ('private.notify_new_organizer_application()', '0005'),
    ('private.notify_trip_submitted()', '0005'),
    ('private.notify_new_report()', '0005'),
    ('private.apply_trip_revision_emergency_contact()', '0006'),
    ('public.resolve_report(uuid,public.report_status,text)', '0008'),
    ('private.require_verified_organizer_for_trip_transition()', '0009'),
    ('private.require_verified_organizer_for_revision_transition()', '0009')
)
select
  e.signature as expected_function,
  e.migration,
  (p.oid is not null) as present,
  p.prosecdef as security_definer,
  case when p.oid is not null
    then pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  end as anon_can_execute,
  case when p.oid is not null
    then pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  end as authenticated_can_execute,
  case when p.oid is not null then pg_catalog.pg_get_functiondef(p.oid) end as definition
from expected_functions e
left join pg_catalog.pg_proc p
  on p.oid = pg_catalog.to_regprocedure(e.signature)
order by e.migration, e.signature;

-- 5. Focused behavior indicators for definitions where exact source semantics
--    matter. Inspect the full definition above if any indicator is false.
with expected_functions(signature, required_marker, check_name) as (
  values
    ('private.is_published_trip_image(text)', 'current_user_has_role', 'admin image preview check'),
    ('private.is_published_trip_image(text)', 't.status = ''published''', 'published-image check'),
    ('public.review_organizer_profile(uuid,public.organizer_verification_status,text)', 'organizer_verification_details', 'private verification-details usage'),
    ('public.review_organizer_profile(uuid,public.organizer_verification_status,text)', 'insert into public.notifications', 'organizer decision notification'),
    ('private.notify_trip_request_change()', 'trip_request_submitted', 'customer submission notification'),
    ('private.notify_trip_request_change()', 'trip_request_received', 'organizer request notification'),
    ('private.notify_trip_request_change()', 'trip_request_accepted', 'customer acceptance notification'),
    ('private.notify_trip_request_change()', 'trip_request_rejected', 'customer rejection notification'),
    ('private.notify_trip_request_change()', 'trip_request_cancelled', 'organizer cancellation notification'),
    ('private.notify_admins(public.notification_type,text,text,uuid)', 'insert into public.notifications', 'admin notification insertion'),
    ('private.notify_new_organizer_application()', 'organizer_application_submitted', 'new application event'),
    ('private.notify_trip_submitted()', 'trip_submitted', 'trip submission event'),
    ('private.notify_new_report()', 'report_submitted', 'new report event'),
    ('private.apply_trip_revision_emergency_contact()', 'new.emergency_contact_information', 'revision emergency-contact propagation'),
    ('public.resolve_report(uuid,public.report_status,text)', 'insert into public.notifications', 'reporter notification insertion'),
    ('public.resolve_report(uuid,public.report_status,text)', 'v_report.reporter_id', 'notification recipient is reporter'),
    ('private.require_verified_organizer_for_trip_transition()', 'verification_status = ''verified''', 'verified trip organizer guard'),
    ('private.require_verified_organizer_for_revision_transition()', 'verification_status = ''verified''', 'verified revision organizer guard')
)
select
  e.signature as expected_function,
  e.check_name,
  (p.oid is not null) as function_present,
  case when p.oid is not null
    then pg_catalog.strpos(pg_catalog.lower(p.prosrc), pg_catalog.lower(e.required_marker)) > 0
    else false
  end as marker_present,
  e.required_marker
from expected_functions e
left join pg_catalog.pg_proc p
  on p.oid = pg_catalog.to_regprocedure(e.signature)
order by e.signature, e.check_name;

-- 6. Notification trigger inventory from 0001/0005 and emergency-contact
--    propagation trigger from 0006. Definitions show event/condition/target.
with expected_triggers(table_name, trigger_name, migration) as (
  values
    ('trip_requests', 'trip_requests_notify', '0001/0002/0005'),
    ('organizer_profiles', 'organizer_profiles_notify_admins', '0005'),
    ('trips', 'trips_notify_admins_of_submission', '0005'),
    ('reports', 'reports_notify_admins', '0005'),
    ('trip_revisions', 'trip_revision_apply_emergency_contact', '0006'),
    ('trips', 'trips_require_verified_organizer', '0009'),
    ('trip_revisions', 'trip_revisions_require_verified_organizer', '0009')
)
select
  e.table_name,
  e.trigger_name as expected_trigger,
  e.migration,
  (t.oid is not null) as present,
  case when t.oid is not null then t.tgenabled end as enabled_state,
  case when t.oid is not null then pg_catalog.pg_get_triggerdef(t.oid, true) end as definition
from expected_triggers e
left join pg_catalog.pg_class c
  on c.relname = e.table_name
  and c.relnamespace = pg_catalog.to_regnamespace('public')
left join pg_catalog.pg_namespace n
  on n.oid = c.relnamespace
left join pg_catalog.pg_trigger t
  on t.tgrelid = c.oid
  and t.tgname = e.trigger_name
  and not t.tgisinternal
order by e.migration, e.table_name, e.trigger_name;

-- 7. Migration 0006 emergency-contact columns, length constraints, and
--    column-level privileges (not application values).
with expected_columns(table_name, privilege_role, privilege_type) as (
  values
    ('trips', 'anon', 'SELECT'),
    ('trips', 'authenticated', 'SELECT'),
    ('trips', 'authenticated', 'UPDATE'),
    ('trip_revisions', 'authenticated', 'INSERT'),
    ('trip_revisions', 'authenticated', 'UPDATE')
)
select
  e.table_name,
  'emergency_contact_information' as column_name,
  (c.column_name is not null) as column_present,
  e.privilege_role,
  e.privilege_type,
  case when c.column_name is not null then
    pg_catalog.has_column_privilege(
      e.privilege_role,
      pg_catalog.format('public.%I', e.table_name),
      c.column_name,
      e.privilege_type
    )
  else false end as privilege_present
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = 'emergency_contact_information'
order by e.table_name, e.privilege_role, e.privilege_type;

select
  'organizer_verification_details' as table_name,
  case when pg_catalog.to_regclass('public.organizer_verification_details') is not null
    then pg_catalog.has_table_privilege(
      'anon', pg_catalog.to_regclass('public.organizer_verification_details'), 'SELECT'
    )
    else false
  end as anon_table_select,
  case when pg_catalog.to_regclass('public.organizer_verification_details') is not null
    then pg_catalog.has_table_privilege(
      'authenticated', pg_catalog.to_regclass('public.organizer_verification_details'), 'SELECT'
    )
    else false
  end as authenticated_table_select,
  case when pg_catalog.to_regclass('public.organizer_verification_details') is not null
    then pg_catalog.has_column_privilege(
      'authenticated', pg_catalog.to_regclass('public.organizer_verification_details'),
      'contact_email', 'UPDATE'
    )
    else false
  end as authenticated_contact_email_update,
  case when pg_catalog.to_regclass('public.organizer_verification_details') is not null
    then pg_catalog.has_table_privilege(
      'authenticated', pg_catalog.to_regclass('public.organizer_verification_details'), 'INSERT'
    )
    else false
  end as authenticated_table_insert;

select
  expected.constraint_name,
  (con.oid is not null) as present,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition
from (
  values
    ('trips_emergency_contact_information_length', 'trips'),
    ('trip_revisions_emergency_contact_information_length', 'trip_revisions')
) as expected(constraint_name, table_name)
left join pg_catalog.pg_constraint con
  on con.conname = expected.constraint_name
  and con.conrelid = pg_catalog.to_regclass(
    pg_catalog.format('public.%I', expected.table_name)
  )
order by expected.constraint_name;

-- 8. Migration 0009 guard details: verify transition predicates and trigger
--    attachment above; these checks report required status markers in source.
with expected_markers(signature, marker) as (
  values
    ('private.require_verified_organizer_for_trip_transition()', 'pending_review'),
    ('private.require_verified_organizer_for_trip_transition()', 'published'),
    ('private.require_verified_organizer_for_revision_transition()', 'pending_review'),
    ('private.require_verified_organizer_for_revision_transition()', 'approved')
)
select
  e.signature as expected_function,
  e.marker as expected_transition,
  (p.oid is not null) as function_present,
  case when p.oid is not null
    then pg_catalog.strpos(pg_catalog.lower(p.prosrc), e.marker) > 0
    else false
  end as transition_marker_present
from expected_markers e
left join pg_catalog.pg_proc p
  on p.oid = pg_catalog.to_regprocedure(e.signature)
order by e.signature, e.marker;

-- 9. Migration 0010: exact index names, uniqueness, key columns, and partial
--    predicates. Missing/incorrect indexes are shown as false/mismatched.
with expected_indexes(index_name, expected_key_columns, expected_target_predicate) as (
  values
    (
      'reports_one_pending_per_trip_reason_idx',
      'reporter_id, trip_id, category',
      'trip_id is not null'
    ),
    (
      'reports_one_pending_per_organizer_reason_idx',
      'reporter_id, organizer_profile_id, category',
      'organizer_profile_id is not null'
    ),
    (
      'reports_one_pending_per_customer_reason_idx',
      'reporter_id, target_user_id, category',
      'target_user_id is not null'
    )
)
select
  e.index_name as expected_index,
  (i.indexrelid is not null) as present,
  coalesce(i.indisunique, false) as is_unique,
  coalesce(i.indisvalid, false) as is_valid,
  case when i.indexrelid is not null then
    pg_catalog.strpos(
      pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
      pg_catalog.lower(e.expected_key_columns)
    ) > 0
    and pg_catalog.strpos(
      pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
      'status = ''pending'''
    ) > 0
    and pg_catalog.strpos(
      pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
      pg_catalog.lower(e.expected_target_predicate)
    ) > 0
  else false end as expected_shape_matches,
  pg_catalog.pg_get_indexdef(i.indexrelid) as actual_definition,
  e.expected_key_columns,
  e.expected_target_predicate
from expected_indexes e
left join pg_catalog.pg_index i
  on i.indexrelid = pg_catalog.to_regclass(
    pg_catalog.format('public.%I', e.index_name)
  )
order by e.index_name;

-- 10. Migration 0010 preflight. These aggregate-only checks return no
--     reporter, target, or report identifiers. Any non-zero count is a
--     blocker; retain records and resolve duplicates through the product
--     workflow before applying the unique indexes.
with duplicate_groups as (
  select 'trip'::text as target_kind, count(*)::bigint as group_count,
         coalesce(sum(group_size - 1), 0)::bigint as excess_report_count
  from (
    select count(*) as group_size
    from public.reports
    where status = 'pending' and trip_id is not null
    group by reporter_id, trip_id, category
    having count(*) > 1
  ) d
  union all
  select 'organizer', count(*)::bigint,
         coalesce(sum(group_size - 1), 0)::bigint
  from (
    select count(*) as group_size
    from public.reports
    where status = 'pending' and organizer_profile_id is not null
    group by reporter_id, organizer_profile_id, category
    having count(*) > 1
  ) d
  union all
  select 'customer', count(*)::bigint,
         coalesce(sum(group_size - 1), 0)::bigint
  from (
    select count(*) as group_size
    from public.reports
    where status = 'pending' and target_user_id is not null
    group by reporter_id, target_user_id, category
    having count(*) > 1
  ) d
)
select target_kind, group_count, excess_report_count
from duplicate_groups
order by target_kind;

-- 11. RLS and Storage configuration relevant to trip-image access. These
--     queries expose policy expressions and bucket metadata, never object rows.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relname in ('buckets', 'objects')
order by c.relname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'trip-images';

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

select
  expected.policy_name,
  (p.policyname is not null) as present,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from (
  values
    ('trip_images_storage_read_published'),
    ('trip_images_storage_insert_own_editable'),
    ('trip_images_storage_delete_own_editable')
) as expected(policy_name)
left join pg_catalog.pg_policies p
  on p.schemaname = 'storage'
  and p.tablename = 'objects'
  and p.policyname = expected.policy_name
order by expected.policy_name;

-- 12. Migration 0005/0006/0009 trigger functions must not be directly
--     executable by client roles; trigger invocation itself is independent
--     of EXECUTE grants. The function inventory above reports these too.
with expected_functions(signature) as (
  values
    ('private.notify_admins(public.notification_type,text,text,uuid)'),
    ('private.notify_new_organizer_application()'),
    ('private.notify_trip_submitted()'),
    ('private.notify_new_report()'),
    ('private.apply_trip_revision_emergency_contact()'),
    ('private.require_verified_organizer_for_trip_transition()'),
    ('private.require_verified_organizer_for_revision_transition()')
)
select
  e.signature as expected_function,
  (p.oid is not null) as present,
  case when p.oid is not null
    then pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  end as anon_can_execute,
  case when p.oid is not null
    then pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  end as authenticated_can_execute
from expected_functions e
left join pg_catalog.pg_proc p
  on p.oid = pg_catalog.to_regprocedure(e.signature)
order by e.signature;
