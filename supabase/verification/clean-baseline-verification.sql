-- Read-only verification for 0001_khayee_clean_baseline.sql.
-- Run against the fresh project after applying the baseline. This script
-- inspects catalogs and aggregate duplicate counts only; it performs no DDL,
-- DML, role changes, or authentication simulation.

-- 1. Application-owned tables.
with expected_tables(table_name) as (
  values
    ('profiles'),
    ('user_roles'),
    ('organizer_profiles'),
    ('organizer_verification_details'),
    ('trip_categories'),
    ('destinations'),
    ('trips'),
    ('trip_images'),
    ('trip_requests'),
    ('notifications'),
    ('reports'),
    ('trip_revisions'),
    ('admin_actions')
)
select
  'public.' || e.table_name as expected_object,
  case when c.oid is null then 'MISSING' else 'PRESENT' end as status,
  coalesce(c.relkind::text, 'absent') as relation_kind,
  coalesce(c.relrowsecurity, false) as rls_enabled,
  coalesce(c.relforcerowsecurity, false) as rls_forced
from expected_tables e
left join pg_catalog.pg_class c
  on c.relname = e.table_name
  and c.relnamespace = pg_catalog.to_regnamespace('public')
order by e.table_name;

-- 2. Sensitive and later-added columns.
with expected_columns(table_name, column_name, expected_type) as (
  values
    ('organizer_verification_details', 'contact_email', 'text'),
    ('organizer_verification_details', 'verification_rejection_reason', 'text'),
    ('organizer_verification_details', 'reviewed_by', 'uuid'),
    ('organizer_verification_details', 'reviewed_at', 'timestamp with time zone'),
    ('trips', 'emergency_contact_information', 'text'),
    ('trip_revisions', 'emergency_contact_information', 'text'),
    ('trips', 'status', 'USER-DEFINED'),
    ('trip_requests', 'party_size', 'integer'),
    ('trip_requests', 'status', 'USER-DEFINED')
)
select
  'public.' || e.table_name || '.' || e.column_name as expected_object,
  case
    when c.column_name is null then 'MISSING'
    when c.data_type = e.expected_type then 'PRESENT'
    else 'MISMATCH'
  end as status,
  c.data_type as actual_type,
  e.expected_type
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- Complete constraint inventory for comparison with the consolidated baseline.
-- No constrained/application row values are selected.
select
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'c' then 'CHECK'
    when 'f' then 'FOREIGN KEY'
    when 'p' then 'PRIMARY KEY'
    when 'u' then 'UNIQUE'
    when 'x' then 'EXCLUSION'
    else con.contype::text
  end as constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) as definition,
  con.convalidated as validated
from pg_catalog.pg_constraint con
join pg_catalog.pg_class c on c.oid = con.conrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname, con.conname;

-- 3. Notification enum values, including all values consolidated from
--    migrations 0002, 0004, and 0007.
with expected_labels(label) as (
  values
    ('trip_request_received'),
    ('trip_request_accepted'),
    ('trip_request_rejected'),
    ('trip_approved'),
    ('trip_rejected'),
    ('trip_cancelled'),
    ('trip_request_cancelled'),
    ('organizer_verified'),
    ('organizer_rejected'),
    ('trip_request_submitted'),
    ('organizer_application_submitted'),
    ('trip_submitted'),
    ('report_submitted'),
    ('report_reviewed'),
    ('report_dismissed')
)
select
  'public.notification_type.' || e.label as expected_object,
  case when en.enumlabel is null then 'MISSING' else 'PRESENT' end as status
from expected_labels e
left join pg_catalog.pg_type t
  on t.typname = 'notification_type'
  and t.typnamespace = pg_catalog.to_regnamespace('public')
left join pg_catalog.pg_enum en
  on en.enumtypid = t.oid
  and en.enumlabel = e.label
order by e.label;

-- 4. All expected public RLS policies from the consolidated baseline.
with expected_policies(policy_name, table_name) as (
  values
    ('profiles_select_own', 'profiles'),
    ('profiles_update_own', 'profiles'),
    ('user_roles_select_own_or_admin', 'user_roles'),
    ('user_roles_insert_admin_only', 'user_roles'),
    ('user_roles_delete_admin', 'user_roles'),
    ('organizer_profiles_read_public_or_owner_or_admin', 'organizer_profiles'),
    ('organizer_profiles_insert_self', 'organizer_profiles'),
    ('organizer_profiles_update_owner', 'organizer_profiles'),
    ('organizer_verification_details_read_owner_or_admin', 'organizer_verification_details'),
    ('organizer_verification_details_update_contact_owner', 'organizer_verification_details'),
    ('trip_categories_read_active_or_admin', 'trip_categories'),
    ('trip_categories_manage_admin', 'trip_categories'),
    ('destinations_read_active_or_admin', 'destinations'),
    ('destinations_manage_admin', 'destinations'),
    ('trips_read_published_owner_or_admin', 'trips'),
    ('trips_insert_own_draft', 'trips'),
    ('trips_update_own_editable', 'trips'),
    ('trip_images_read_published_owner_or_admin', 'trip_images'),
    ('trip_images_insert_own_editable', 'trip_images'),
    ('trip_images_update_own_editable', 'trip_images'),
    ('trip_images_delete_own_editable', 'trip_images'),
    ('trip_requests_read_customer_trip_owner_or_admin', 'trip_requests'),
    ('trip_requests_insert_own_pending', 'trip_requests'),
    ('notifications_read_own', 'notifications'),
    ('notifications_update_read_state_own', 'notifications'),
    ('reports_read_own_or_admin', 'reports'),
    ('reports_insert_own_pending', 'reports'),
    ('admin_actions_read_admin', 'admin_actions'),
    ('trip_revisions_read_owner_or_admin', 'trip_revisions'),
    ('trip_revisions_insert_owner_draft', 'trip_revisions'),
    ('trip_revisions_update_owner_editable', 'trip_revisions')
)
select
  'public.' || e.table_name || ' policy ' || e.policy_name as expected_object,
  case when p.policyname is null then 'MISSING' else 'PRESENT' end as status,
  p.cmd,
  p.roles,
  p.qual as using_expression,
  p.with_check
from expected_policies e
left join pg_catalog.pg_policies p
  on p.schemaname = 'public'
  and p.tablename = e.table_name
  and p.policyname = e.policy_name
order by e.table_name, e.policy_name;

-- 5. Critical functions: presence, SECURITY DEFINER status, fixed search_path,
--    and client execute grants. Full deployed definitions are returned for
--    human review, especially for SECURITY DEFINER routines.
with expected_functions(schema_name, function_name, args, security_definer, anon_execute, authenticated_execute) as (
  values
    ('private', 'current_user_has_role', 'p_role public.app_role', true, true, true),
    ('private', 'current_user_owns_organizer', 'p_organizer_profile_id uuid', true, true, true),
    ('private', 'current_user_owns_trip', 'p_trip_id uuid', true, true, true),
    ('private', 'current_user_can_edit_trip_images', 'p_trip_id uuid', true, false, true),
    ('private', 'is_published_trip_image', 'p_storage_path text', true, true, true),
    ('private', 'can_manage_trip_image_object', 'p_storage_path text', true, false, true),
    ('public', 'set_updated_at', '', false, false, false),
    ('private', 'assign_organizer_role', '', true, false, false),
    ('private', 'create_organizer_verification_details', '', true, false, false),
    ('private', 'prevent_last_admin_removal', '', true, false, false),
    ('private', 'audit_user_role_change', '', true, false, false),
    ('private', 'audit_reference_data_change', '', true, false, false),
    ('private', 'notify_trip_request_change', '', true, false, false),
    ('private', 'validate_trip_request_insert', '', true, false, false),
    ('private', 'notify_admins', 'p_notification_type public.notification_type, p_title text, p_body text, p_trip_id uuid', true, false, false),
    ('private', 'notify_new_organizer_application', '', true, false, false),
    ('private', 'notify_trip_submitted', '', true, false, false),
    ('private', 'notify_new_report', '', true, false, false),
    ('private', 'apply_trip_revision_emergency_contact', '', true, false, false),
    ('private', 'require_verified_organizer_for_trip_transition', '', true, false, false),
    ('private', 'require_verified_organizer_for_revision_transition', '', true, false, false),
    ('public', 'submit_trip_for_review', 'p_trip_id uuid', true, false, true),
    ('public', 'approve_trip', 'p_trip_id uuid', true, false, true),
    ('public', 'reject_trip', 'p_trip_id uuid, p_reason text', true, false, true),
    ('public', 'submit_trip_revision_for_review', 'p_revision_id uuid', true, false, true),
    ('public', 'approve_trip_revision', 'p_revision_id uuid', true, false, true),
    ('public', 'reject_trip_revision', 'p_revision_id uuid, p_reason text', true, false, true),
    ('public', 'accept_trip_request', 'p_request_id uuid', true, false, true),
    ('public', 'reject_trip_request', 'p_request_id uuid', true, false, true),
    ('public', 'cancel_trip_request', 'p_request_id uuid', true, false, true),
    ('public', 'cancel_trip', 'p_trip_id uuid, p_reason text', true, false, true),
    ('public', 'review_organizer_profile', 'p_organizer_profile_id uuid, p_status public.organizer_verification_status, p_reason text', true, false, true),
    ('public', 'resolve_report', 'p_report_id uuid, p_status public.report_status, p_notes text', true, false, true),
    ('public', 'ensure_customer_profile', '', true, false, true)
)
select
  e.schema_name || '.' || e.function_name || '(' || e.args || ')' as expected_object,
  case
    when p.oid is null then 'MISSING'
    when p.prosecdef is distinct from e.security_definer then 'MISMATCH'
    when coalesce(p.proconfig @> array['search_path=pg_catalog'], false) is false then 'MISMATCH'
    when pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') is distinct from e.anon_execute then 'MISMATCH'
    when pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') is distinct from e.authenticated_execute then 'MISMATCH'
    else 'PRESENT'
  end as status,
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  case when p.oid is not null then
    pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  end as anon_can_execute,
  case when p.oid is not null then
    pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
  end as authenticated_can_execute,
  case when p.oid is not null then pg_catalog.pg_get_functiondef(p.oid) end as definition
from expected_functions e
left join pg_catalog.pg_namespace n on n.nspname = e.schema_name
left join pg_catalog.pg_proc p
  on p.pronamespace = n.oid
  and p.proname = e.function_name
  and pg_catalog.pg_get_function_identity_arguments(p.oid) = e.args
order by e.schema_name, e.function_name;

-- 6. Required business-logic markers for locking, verified publishing,
--    organizer authorization, reporter notifications, and capacity checks.
with expected_markers(schema_name, function_name, marker) as (
  values
    ('private', 'validate_trip_request_insert', 'for update'),
    ('private', 'validate_trip_request_insert', 'new.customer_id := auth.uid()'),
    ('private', 'is_published_trip_image', 'private.current_user_has_role(''admin'')'),
    ('private', 'is_published_trip_image', 't.status = ''published'''),
    ('public', 'accept_trip_request', 'for update'),
    ('public', 'accept_trip_request', 'v_accepted_party_size + v_request.party_size > v_trip.capacity'),
    ('public', 'approve_trip', 'private.current_user_has_role(''admin'')'),
    ('public', 'approve_trip_revision', 'private.current_user_has_role(''admin'')'),
    ('public', 'review_organizer_profile', 'private.current_user_has_role(''admin'')'),
    ('public', 'resolve_report', 'v_report.reporter_id'),
    ('public', 'ensure_customer_profile', 'v_user_id := auth.uid()'),
    ('private', 'require_verified_organizer_for_trip_transition', 'verification_status = ''verified'''),
    ('private', 'require_verified_organizer_for_revision_transition', 'verification_status = ''verified''')
)
select
  e.schema_name || '.' || e.function_name || ' marker ' || e.marker as expected_behavior,
  case
    when p.oid is null then 'MISSING'
    when pg_catalog.strpos(pg_catalog.lower(p.prosrc), pg_catalog.lower(e.marker)) = 0 then 'MISMATCH'
    else 'PRESENT'
  end as status
from expected_markers e
left join pg_catalog.pg_namespace n on n.nspname = e.schema_name
left join pg_catalog.pg_proc p
  on p.pronamespace = n.oid
  and p.proname = e.function_name
order by e.schema_name, e.function_name, e.marker;

-- 7. Expected triggers and their precise catalog-rendered definitions.
--    The definitions are returned for comparison with the baseline.
with expected_triggers(
  table_name,
  trigger_name,
  expected_event_fragment,
  expected_function_fragment,
  expected_condition_fragment
) as (
  values
    ('organizer_profiles', 'organizer_profiles_assign_role', 'after insert', 'private.assign_organizer_role', ''),
    ('organizer_profiles', 'organizer_profiles_create_verification_details', 'after insert', 'private.create_organizer_verification_details', ''),
    ('trip_requests', 'trip_requests_notify', 'after insert or update of status', 'private.notify_trip_request_change', ''),
    ('trip_requests', 'trip_requests_validate_insert', 'before insert', 'private.validate_trip_request_insert', ''),
    ('organizer_profiles', 'organizer_profiles_notify_admins', 'after insert', 'private.notify_new_organizer_application', ''),
    ('trips', 'trips_notify_admins_of_submission', 'after update of status', 'private.notify_trip_submitted', 'pending_review'),
    ('reports', 'reports_notify_admins', 'after insert', 'private.notify_new_report', ''),
    ('trip_revisions', 'trip_revision_apply_emergency_contact', 'after update of status', 'private.apply_trip_revision_emergency_contact', 'approved'),
    ('trips', 'trips_require_verified_organizer', 'before update of status', 'private.require_verified_organizer_for_trip_transition', 'pending_review'),
    ('trip_revisions', 'trip_revisions_require_verified_organizer', 'before update of status', 'private.require_verified_organizer_for_revision_transition', 'approved')
)
select
  'public.' || e.table_name || ' trigger ' || e.trigger_name as expected_object,
  case
    when t.oid is null then 'MISSING'
    when pg_catalog.strpos(
      pg_catalog.lower(pg_catalog.pg_get_triggerdef(t.oid, true)),
      pg_catalog.lower(e.expected_event_fragment)
    ) = 0 then 'MISMATCH'
    when pg_catalog.strpos(
      pg_catalog.lower(pg_catalog.pg_get_triggerdef(t.oid, true)),
      pg_catalog.lower(e.expected_function_fragment)
    ) = 0 then 'MISMATCH'
    when e.expected_condition_fragment <> ''
      and pg_catalog.strpos(
        pg_catalog.lower(pg_catalog.pg_get_triggerdef(t.oid, true)),
        pg_catalog.lower(e.expected_condition_fragment)
      ) = 0 then 'MISMATCH'
    else 'PRESENT'
  end as status,
  t.tgenabled as enabled_state,
  pg_catalog.pg_get_triggerdef(t.oid, true) as actual_definition,
  e.expected_event_fragment,
  e.expected_function_fragment,
  e.expected_condition_fragment
from expected_triggers e
left join pg_catalog.pg_class c
  on c.relname = e.table_name
  and c.relnamespace = pg_catalog.to_regnamespace('public')
left join pg_catalog.pg_trigger t
  on t.tgrelid = c.oid
  and t.tgname = e.trigger_name
  and not t.tgisinternal
order by e.table_name, e.trigger_name;

-- 8. Inventory of every application index from the baseline. The 0010
--    partial-index definitions are checked more strictly in the next section.
with expected_indexes(index_name, expected_unique) as (
  values
    ('user_roles_role_user_idx', false),
    ('organizer_profiles_verification_status_idx', false),
    ('trip_categories_active_sort_idx', false),
    ('destinations_region_name_idx', false),
    ('trips_organizer_status_created_idx', false),
    ('trips_public_start_idx', false),
    ('trips_public_destination_start_idx', false),
    ('trips_public_category_start_idx', false),
    ('trip_requests_trip_status_created_idx', false),
    ('trip_requests_customer_created_idx', false),
    ('trip_requests_one_active_per_customer_trip_idx', true),
    ('notifications_recipient_created_idx', false),
    ('notifications_unread_recipient_created_idx', false),
    ('reports_status_created_idx', false),
    ('reports_reporter_created_idx', false),
    ('admin_actions_target_created_idx', false),
    ('admin_actions_actor_created_idx', false),
    ('trip_revisions_trip_status_created_idx', false),
    ('trip_revisions_one_pending_per_trip_idx', true),
    ('reports_one_pending_per_trip_reason_idx', true),
    ('reports_one_pending_per_organizer_reason_idx', true),
    ('reports_one_pending_per_customer_reason_idx', true)
)
select
  'public index ' || e.index_name as expected_object,
  case
    when i.indexrelid is null then 'MISSING'
    when i.indisvalid is false then 'MISMATCH'
    when i.indisunique is distinct from e.expected_unique then 'MISMATCH'
    else 'PRESENT'
  end as status,
  pg_catalog.pg_get_indexdef(i.indexrelid) as actual_definition
from expected_indexes e
left join pg_catalog.pg_index i
  on i.indexrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', e.index_name))
order by e.index_name;

-- Supabase Auth is a managed schema and is intentionally not changed
-- by this baseline. A legacy provisioning trigger may already exist on
-- auth.users; either state is compatible with the idempotent application RPC.
select
  'auth.users trigger auth_user_created_profile' as expected_object,
  'PRESENT - pre-existing, not managed by baseline' as status,
  pg_catalog.pg_get_triggerdef(t.oid, true) as actual_definition
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and t.tgname = 'auth_user_created_profile'
union all
select
  'auth.users trigger auth_user_created_profile',
  'ABSENT - application RPC provisions after authentication',
  null::text
where not exists (
  select 1
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and t.tgname = 'auth_user_created_profile'
);

-- 9. Emergency-contact columns, constraints, and privileges.
with expected_columns(table_name, privilege_role, privilege_type) as (
  values
    ('trips', 'anon', 'SELECT'),
    ('trips', 'authenticated', 'SELECT'),
    ('trips', 'authenticated', 'UPDATE'),
    ('trip_revisions', 'authenticated', 'INSERT'),
    ('trip_revisions', 'authenticated', 'UPDATE')
)
select
  'public.' || e.table_name || '.emergency_contact_information' as expected_object,
  case when c.column_name is null then 'MISSING'
       when not pg_catalog.has_column_privilege(
         e.privilege_role,
         pg_catalog.format('public.%I', e.table_name),
         'emergency_contact_information',
         e.privilege_type
       ) then 'MISMATCH'
       else 'PRESENT'
  end as status,
  e.privilege_role,
  e.privilege_type
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = 'emergency_contact_information'
order by e.table_name, e.privilege_role, e.privilege_type;

with expected_constraints(table_name, constraint_name) as (
  values
    ('trips', 'trips_emergency_contact_information_length'),
    ('trip_revisions', 'trip_revisions_emergency_contact_information_length')
)
select
  'public.' || e.table_name || ' constraint ' || e.constraint_name as expected_object,
  case when c.oid is null then 'MISSING' else 'PRESENT' end as status,
  pg_catalog.pg_get_constraintdef(c.oid, true) as definition
from expected_constraints e
left join pg_catalog.pg_class r
  on r.relname = e.table_name
  and r.relnamespace = pg_catalog.to_regnamespace('public')
left join pg_catalog.pg_constraint c
  on c.conrelid = r.oid
  and c.conname = e.constraint_name
order by e.table_name;

-- 10. Duplicate-report preflight. Only aggregate counts are returned; no
--    report IDs, reporter IDs, or target identifiers are selected.
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
select
  target_kind,
  case when group_count = 0 then 'PRESENT - clear' else 'MISMATCH - duplicates block unique indexes' end as status,
  group_count,
  excess_report_count
from duplicate_groups
order by target_kind;

with expected_indexes(index_name, expected_columns, expected_predicate) as (
  values
    ('reports_one_pending_per_trip_reason_idx', 'reporter_id, trip_id, category', 'trip_id is not null'),
    ('reports_one_pending_per_organizer_reason_idx', 'reporter_id, organizer_profile_id, category', 'organizer_profile_id is not null'),
    ('reports_one_pending_per_customer_reason_idx', 'reporter_id, target_user_id, category', 'target_user_id is not null')
)
select
  'public.reports index ' || e.index_name as expected_object,
  case
    when i.indexrelid is null then 'MISSING'
    when not i.indisunique or not i.indisvalid then 'MISMATCH'
    when pg_catalog.strpos(pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
         pg_catalog.lower(e.expected_columns)) = 0 then 'MISMATCH'
    when pg_catalog.strpos(pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
         'status = ''pending''') = 0 then 'MISMATCH'
    when pg_catalog.strpos(pg_catalog.lower(pg_catalog.pg_get_indexdef(i.indexrelid)),
         pg_catalog.lower(e.expected_predicate)) = 0 then 'MISMATCH'
    else 'PRESENT'
  end as status,
  pg_catalog.pg_get_indexdef(i.indexrelid) as actual_definition
from expected_indexes e
left join pg_catalog.pg_index i
  on i.indexrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', e.index_name))
order by e.index_name;

-- 11. Storage is not migrated here because storage.objects is Supabase-managed.
--     The existing bucket is preserved; review its settings and policies in
--     Storage > Policies. No object records are queried.
select
  'storage.buckets trip-images' as expected_object,
  case
       when b.id is null then 'MISSING'
       when b.public then 'MISMATCH - bucket must remain private'
       when b.file_size_limit is distinct from 52428800 then 'MISMATCH - expected 50 MiB limit'
       when b.allowed_mime_types is distinct from
         array['image/jpeg', 'image/png', 'image/webp']::text[]
         then 'MISMATCH - expected JPEG, PNG, WebP allowlist'
       else 'PRESENT'
  end as status,
  b.file_size_limit,
  b.allowed_mime_types
from (select 'trip-images'::text as id) expected
left join storage.buckets b on b.id = expected.id;

select
  expected.policy_name as expected_object,
  case
    when p.policyname is null then 'MISSING - configure in Storage Policies'
    when expected.command_name is distinct from p.cmd then 'MISMATCH'
    when expected.expression_fragment is not null
      and pg_catalog.strpos(
        pg_catalog.lower(coalesce(p.qual, p.with_check, '')),
        pg_catalog.lower(expected.expression_fragment)
      ) = 0 then 'MISMATCH'
    when pg_catalog.strpos(
      pg_catalog.lower(coalesce(p.qual, p.with_check, '')),
      '''trip-images'''
    ) = 0 then 'MISMATCH'
    else 'PRESENT'
  end as status,
  p.cmd,
  p.roles,
  p.qual as using_expression,
  p.with_check
from (
  values
    ('trip_images_storage_read_published', 'SELECT', 'private.is_published_trip_image'),
    ('trip_images_storage_insert_own_editable', 'INSERT', 'private.can_manage_trip_image_object'),
    ('trip_images_storage_delete_own_editable', 'DELETE', 'private.can_manage_trip_image_object')
) expected(policy_name, command_name, expression_fragment)
left join pg_catalog.pg_policies p
  on p.schemaname = 'storage'
  and p.tablename = 'objects'
  and p.policyname = expected.policy_name
order by expected.policy_name;

-- 12. Application-facing column and table grants, in addition to the RLS
--     policies above. Sensitive profile ownership IDs remain non-selectable
--     from organizer_profiles; the application resolves its own profile via
--     organizer_verification_details instead.
with expected_privileges(role_name, table_name, column_name, privilege_type) as (
  values
    ('anon', 'trips', 'id', 'SELECT'),
    ('anon', 'trips', 'title', 'SELECT'),
    ('anon', 'trips', 'summary', 'SELECT'),
    ('anon', 'trips', 'category_id', 'SELECT'),
    ('anon', 'trips', 'destination_id', 'SELECT'),
    ('anon', 'trips', 'difficulty', 'SELECT'),
    ('anon', 'trips', 'duration_minutes', 'SELECT'),
    ('anon', 'trips', 'starts_at', 'SELECT'),
    ('anon', 'trips', 'ends_at', 'SELECT'),
    ('anon', 'trips', 'departure_location', 'SELECT'),
    ('anon', 'trips', 'capacity', 'SELECT'),
    ('anon', 'trips', 'price_mmk', 'SELECT'),
    ('anon', 'trips', 'safety_information', 'SELECT'),
    ('anon', 'trips', 'cancellation_policy', 'SELECT'),
    ('anon', 'trips', 'included_services', 'SELECT'),
    ('anon', 'trips', 'excluded_services', 'SELECT'),
    ('anon', 'trips', 'required_equipment', 'SELECT'),
    ('anon', 'trips', 'organizer_profile_id', 'SELECT'),
    ('anon', 'trips', 'created_at', 'SELECT'),
    ('anon', 'trips', 'emergency_contact_information', 'SELECT'),
    ('anon', 'organizer_profiles', 'id', 'SELECT'),
    ('anon', 'organizer_profiles', 'display_name', 'SELECT'),
    ('anon', 'trip_images', 'trip_id', 'SELECT'),
    ('anon', 'trip_images', 'storage_path', 'SELECT'),
    ('anon', 'trip_images', 'alt_text', 'SELECT'),
    ('anon', 'trip_images', 'sort_order', 'SELECT'),
    ('authenticated', 'trips', 'status', 'SELECT'),
    ('authenticated', 'trips', 'organizer_profile_id', 'INSERT'),
    ('authenticated', 'trips', 'title', 'INSERT'),
    ('authenticated', 'trips', 'title', 'UPDATE'),
    ('authenticated', 'trips', 'emergency_contact_information', 'INSERT'),
    ('authenticated', 'trips', 'emergency_contact_information', 'UPDATE'),
    ('authenticated', 'trip_requests', 'trip_id', 'INSERT'),
    ('authenticated', 'trip_requests', 'party_size', 'INSERT'),
    ('authenticated', 'trip_requests', 'message', 'INSERT'),
    ('authenticated', 'reports', 'reporter_id', 'INSERT'),
    ('authenticated', 'reports', 'category', 'INSERT'),
    ('authenticated', 'reports', 'details', 'INSERT'),
    ('authenticated', 'trip_images', 'trip_id', 'INSERT'),
    ('authenticated', 'trip_images', 'storage_path', 'INSERT'),
    ('authenticated', 'trip_images', 'alt_text', 'INSERT'),
    ('authenticated', 'trip_images', 'sort_order', 'INSERT'),
    ('authenticated', 'notifications', 'read_at', 'UPDATE'),
    ('authenticated', 'organizer_verification_details', 'contact_email', 'UPDATE'),
    ('authenticated', 'trip_revisions', 'trip_id', 'INSERT'),
    ('authenticated', 'trip_revisions', 'title', 'INSERT'),
    ('authenticated', 'trip_revisions', 'title', 'UPDATE')
)
select
  'public.' || e.table_name || '.' || e.column_name || ' ' ||
    e.privilege_type || ' to ' || e.role_name as expected_object,
  case
    when c.column_name is null then 'MISSING'
    when pg_catalog.has_column_privilege(
      e.role_name,
      pg_catalog.format('public.%I', e.table_name),
      e.column_name,
      e.privilege_type
    ) then 'PRESENT'
    else 'MISMATCH'
  end as status
from expected_privileges e
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = e.table_name
  and c.column_name = e.column_name
order by e.role_name, e.table_name, e.column_name, e.privilege_type;

select
  'public.trip_images DELETE to authenticated' as expected_object,
  case when pg_catalog.has_table_privilege(
    'authenticated', 'public.trip_images', 'DELETE'
  ) then 'PRESENT' else 'MISMATCH' end as status;

select
  'public.organizer_profiles.user_id SELECT to authenticated' as expected_object,
  case when pg_catalog.has_column_privilege(
    'authenticated', 'public.organizer_profiles', 'user_id', 'SELECT'
  ) then 'MISMATCH - ownership ID should remain private'
  else 'PRESENT - not granted' end as status;

-- 13. Required lookup data for trip creation and browsing.
with expected_rows(table_name, slug) as (
  values
    ('trip_categories', 'trekking'),
    ('trip_categories', 'hiking'),
    ('trip_categories', 'camping'),
    ('trip_categories', 'adventure'),
    ('destinations', 'mandalay'),
    ('destinations', 'pyin-oo-lwin'),
    ('destinations', 'mount-popa'),
    ('destinations', 'hsipaw'),
    ('destinations', 'mogok'),
    ('destinations', 'monywa')
)
select
  'public.' || e.table_name || ' slug ' || e.slug as expected_object,
  case when r.slug is null then 'MISSING' else 'PRESENT' end as status
from expected_rows e
left join lateral (
  select tc.slug
  from public.trip_categories tc
  where e.table_name = 'trip_categories'
    and tc.slug = e.slug
  union all
  select d.slug
  from public.destinations d
  where e.table_name = 'destinations'
    and d.slug = e.slug
) r on true
order by e.table_name, e.slug;

-- 14. The baseline intentionally does not write to the migration ledger.
--     Use `supabase migration list` to verify its version after deployment.
select
  'supabase_migrations.schema_migrations' as expected_object,
  case
    when pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null
      then 'MISSING - inspect CLI migration history'
    else 'PRESENT - verify baseline version with Supabase CLI'
  end as status;
