-- Authoritative timestamped Khayee baseline for the linked Supabase project.
-- Consolidated from the reviewed local migrations 0001-0010.
do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'trip-images'
      and public = false
      and file_size_limit = 52428800
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'trip-images must already be private with a 50 MiB limit and JPEG, PNG, WebP MIME allowlist';
  end if;
end;
$$;

-- Consolidated clean baseline for a fresh Khayee deployment.
-- Derived from local migrations 0001-0010; do not apply to a database
-- containing the legacy application schema. This file does not create or
-- modify managed schemas, tables, functions, bucket metadata, or Auth objects.
-- It only manages the three explicitly named Khayee policies on storage.objects.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create type public.app_role as enum ('customer', 'organizer', 'admin');
create type public.organizer_verification_status as enum (
  'pending',
  'verified',
  'rejected'
);
create type public.trip_status as enum (
  'draft',
  'pending_review',
  'published',
  'rejected',
  'cancelled',
  'completed'
);
create type public.trip_difficulty as enum ('easy', 'moderate', 'challenging');
create type public.trip_request_status as enum (
  'pending',
  'accepted',
  'rejected',
  'cancelled'
);
create type public.trip_revision_status as enum (
  'draft',
  'pending_review',
  'approved',
  'rejected'
);
create type public.report_status as enum ('pending', 'reviewed', 'dismissed');
create type public.report_category as enum (
  'safety',
  'misleading_information',
  'harassment',
  'spam',
  'other'
);
create type public.notification_type as enum (
  'trip_request_received',
  'trip_request_accepted',
  'trip_request_rejected',
  'trip_approved',
  'trip_rejected',
  'trip_cancelled',
  'trip_request_cancelled',
  'organizer_verified',
  'organizer_rejected',
  'trip_request_submitted',
  'organizer_application_submitted',
  'trip_submitted',
  'report_submitted',
  'report_reviewed',
  'report_dismissed'
);
create type public.admin_action_type as enum (
  'user_role_granted',
  'user_role_revoked',
  'trip_category_created',
  'trip_category_updated',
  'trip_category_deleted',
  'destination_created',
  'destination_updated',
  'destination_deleted',
  'trip_approved',
  'trip_rejected',
  'trip_revision_approved',
  'trip_revision_rejected',
  'organizer_verified',
  'organizer_rejected',
  'report_reviewed',
  'report_dismissed'
);
create type public.admin_target_type as enum (
  'user',
  'trip',
  'trip_revision',
  'organizer_profile',
  'trip_category',
  'destination',
  'report'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone_number text,
  bio text,
  avatar_path text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(pg_catalog.btrim(display_name)) between 1 and 120
  ),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 2000),
  constraint profiles_phone_number_length check (
    phone_number is null or char_length(phone_number) <= 40
  ),
  constraint profiles_avatar_path_length check (
    avatar_path is null or char_length(avatar_path) <= 500
  )
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, role)
);

create table public.organizer_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  display_name text not null,
  bio text,
  website_url text,
  verification_status public.organizer_verification_status not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint organizer_profiles_display_name_nonblank check (
    char_length(pg_catalog.btrim(display_name)) between 1 and 160
  ),
  constraint organizer_profiles_bio_length check (bio is null or char_length(bio) <= 4000),
  constraint organizer_profiles_website_url_length check (
    website_url is null or char_length(website_url) <= 2048
  )
);

create table public.organizer_verification_details (
  organizer_profile_id uuid primary key
    references public.organizer_profiles (id) on delete cascade,
  contact_email text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  verification_rejection_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint organizer_verification_details_contact_email_length check (
    contact_email is null or char_length(contact_email) <= 320
  ),
  constraint organizer_verification_details_reviewer_pair check (
    reviewed_by is null or reviewed_at is not null
  ),
  constraint organizer_verification_details_rejection_reason check (
    verification_rejection_reason is null
    or (
      char_length(pg_catalog.btrim(verification_rejection_reason)) between 1 and 2000
    )
  )
);

create table public.trip_categories (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint trip_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint trip_categories_name_nonblank check (
    char_length(pg_catalog.btrim(name)) between 1 and 120
  ),
  constraint trip_categories_description_length check (
    description is null or char_length(description) <= 2000
  )
);

create table public.destinations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  slug text not null unique,
  name text not null,
  region text not null,
  description text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint destinations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint destinations_name_nonblank check (
    char_length(pg_catalog.btrim(name)) between 1 and 160
  ),
  constraint destinations_region_nonblank check (
    char_length(pg_catalog.btrim(region)) between 1 and 160
  ),
  constraint destinations_description_length check (
    description is null or char_length(description) <= 2000
  ),
  constraint destinations_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  ),
  constraint destinations_latitude_range check (
    latitude is null or latitude between -90 and 90
  ),
  constraint destinations_longitude_range check (
    longitude is null or longitude between -180 and 180
  )
);

create table public.trips (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organizer_profile_id uuid not null
    references public.organizer_profiles (id) on delete restrict,
  category_id uuid not null
    references public.trip_categories (id) on delete restrict,
  destination_id uuid not null
    references public.destinations (id) on delete restrict,
  title text not null,
  summary text not null,
  description text not null,
  difficulty public.trip_difficulty not null,
  duration_minutes integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  departure_location text not null,
  capacity integer not null,
  price_mmk bigint not null,
  safety_information text not null,
  cancellation_policy text not null,
  included_services text[] not null default array[]::text[],
  excluded_services text[] not null default array[]::text[],
  required_equipment text[] not null default array[]::text[],
  status public.trip_status not null default 'draft',
  submitted_at timestamptz,
  published_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  cancellation_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint trips_title_nonblank check (char_length(pg_catalog.btrim(title)) between 1 and 200),
  constraint trips_summary_nonblank check (char_length(pg_catalog.btrim(summary)) between 1 and 500),
  constraint trips_description_nonblank check (char_length(pg_catalog.btrim(description)) > 0),
  constraint trips_departure_location_nonblank check (
    char_length(pg_catalog.btrim(departure_location)) between 1 and 500
  ),
  constraint trips_safety_information_nonblank check (
    char_length(pg_catalog.btrim(safety_information)) > 0
  ),
  constraint trips_cancellation_policy_nonblank check (
    char_length(pg_catalog.btrim(cancellation_policy)) > 0
  ),
  constraint trips_duration_positive check (duration_minutes > 0),
  constraint trips_dates_ordered check (ends_at > starts_at),
  constraint trips_capacity_positive check (capacity > 0),
  constraint trips_price_nonnegative check (price_mmk >= 0),
  constraint trips_rejection_reason check (
    (status = 'rejected' and rejection_reason is not null
      and char_length(pg_catalog.btrim(rejection_reason)) > 0)
    or (status <> 'rejected' and rejection_reason is null)
  ),
  constraint trips_cancellation_reason_length check (
    cancellation_reason is null or char_length(cancellation_reason) <= 2000
  ),
  constraint trips_included_services_no_nulls check (
    pg_catalog.array_position(included_services, null) is null
  ),
  constraint trips_excluded_services_no_nulls check (
    pg_catalog.array_position(excluded_services, null) is null
  ),
  constraint trips_required_equipment_no_nulls check (
    pg_catalog.array_position(required_equipment, null) is null
  )
);

create table public.trip_images (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint trip_images_alt_text_nonblank check (
    char_length(pg_catalog.btrim(alt_text)) between 1 and 500
  ),
  constraint trip_images_sort_order_nonnegative check (sort_order >= 0),
  constraint trip_images_storage_path_format check (
    storage_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$'
  ),
  constraint trip_images_path_matches_trip check (
    pg_catalog.split_part(storage_path, '/', 1) = trip_id::text
  ),
  constraint trip_images_trip_sort_order_unique unique (trip_id, sort_order)
);

create table public.trip_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  party_size integer not null default 1,
  message text,
  status public.trip_request_status not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint trip_requests_party_size_positive check (party_size > 0),
  constraint trip_requests_message_length check (
    message is null or char_length(message) <= 2000
  )
);

create table public.notifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  notification_type public.notification_type not null,
  title text not null,
  body text not null,
  trip_id uuid references public.trips (id) on delete set null,
  trip_request_id uuid references public.trip_requests (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint notifications_title_nonblank check (
    char_length(pg_catalog.btrim(title)) between 1 and 200
  ),
  constraint notifications_body_nonblank check (
    char_length(pg_catalog.btrim(body)) between 1 and 2000
  )
);

create table public.reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  organizer_profile_id uuid
    references public.organizer_profiles (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete cascade,
  category public.report_category not null,
  details text not null,
  status public.report_status not null default 'pending',
  moderation_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint reports_exactly_one_target check (
    pg_catalog.num_nonnulls(trip_id, organizer_profile_id, target_user_id) = 1
  ),
  constraint reports_not_self check (
    target_user_id is null or target_user_id <> reporter_id
  ),
  constraint reports_details_nonblank check (
    char_length(pg_catalog.btrim(details)) between 1 and 5000
  ),
  constraint reports_moderation_notes_length check (
    moderation_notes is null or char_length(moderation_notes) <= 5000
  )
);

create table public.trip_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  submitted_by uuid not null references auth.users (id) on delete restrict,
  title text not null,
  summary text not null,
  description text not null,
  category_id uuid not null
    references public.trip_categories (id) on delete restrict,
  destination_id uuid not null
    references public.destinations (id) on delete restrict,
  difficulty public.trip_difficulty not null,
  duration_minutes integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  departure_location text not null,
  capacity integer not null,
  price_mmk bigint not null,
  safety_information text not null,
  cancellation_policy text not null,
  included_services text[] not null default array[]::text[],
  excluded_services text[] not null default array[]::text[],
  required_equipment text[] not null default array[]::text[],
  status public.trip_revision_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint trip_revisions_title_nonblank check (
    char_length(pg_catalog.btrim(title)) between 1 and 200
  ),
  constraint trip_revisions_summary_nonblank check (
    char_length(pg_catalog.btrim(summary)) between 1 and 500
  ),
  constraint trip_revisions_description_nonblank check (
    char_length(pg_catalog.btrim(description)) > 0
  ),
  constraint trip_revisions_departure_location_nonblank check (
    char_length(pg_catalog.btrim(departure_location)) between 1 and 500
  ),
  constraint trip_revisions_safety_information_nonblank check (
    char_length(pg_catalog.btrim(safety_information)) > 0
  ),
  constraint trip_revisions_cancellation_policy_nonblank check (
    char_length(pg_catalog.btrim(cancellation_policy)) > 0
  ),
  constraint trip_revisions_duration_positive check (duration_minutes > 0),
  constraint trip_revisions_dates_ordered check (ends_at > starts_at),
  constraint trip_revisions_capacity_positive check (capacity > 0),
  constraint trip_revisions_price_nonnegative check (price_mmk >= 0),
  constraint trip_revisions_rejection_reason check (
    (status = 'rejected' and rejection_reason is not null
      and char_length(pg_catalog.btrim(rejection_reason)) > 0)
    or (status <> 'rejected' and rejection_reason is null)
  ),
  constraint trip_revisions_included_services_no_nulls check (
    pg_catalog.array_position(included_services, null) is null
  ),
  constraint trip_revisions_excluded_services_no_nulls check (
    pg_catalog.array_position(excluded_services, null) is null
  ),
  constraint trip_revisions_required_equipment_no_nulls check (
    pg_catalog.array_position(required_equipment, null) is null
  )
);

create table public.admin_actions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action public.admin_action_type not null,
  target_kind public.admin_target_type not null,
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.now(),
  constraint admin_actions_details_object check (
    pg_catalog.jsonb_typeof(details) = 'object'
  )
);


-- Reference rows required by the trip creation and search workflows. These are
-- inserted before audit triggers are installed so deployment does not create
-- spurious administrator audit records.
insert into public.trip_categories (slug, name, description, sort_order) values
  ('trekking', 'Trekking', 'Multi-hour and multi-day mountain and trail trips.', 10),
  ('hiking', 'Hiking', 'Day hikes and guided nature walks.', 20),
  ('camping', 'Camping', 'Overnight outdoor stays and camp trips.', 30),
  ('adventure', 'Adventure', 'Other guided outdoor activities.', 40);

insert into public.destinations (slug, name, region, description) values
  ('mandalay', 'Mandalay', 'Mandalay Region', 'Outdoor trips starting in or near Mandalay.'),
  ('pyin-oo-lwin', 'Pyin Oo Lwin', 'Mandalay Region', 'Highland trails and outdoor trips near Mandalay.'),
  ('mount-popa', 'Mount Popa', 'Mandalay Region', 'Outdoor trips around Mount Popa.'),
  ('hsipaw', 'Hsipaw', 'Shan State', 'Trekking and outdoor trips in northern Shan State.'),
  ('mogok', 'Mogok', 'Mandalay Region', 'Highland outdoor trips around Mogok.'),
  ('monywa', 'Monywa', 'Sagaing Region', 'Outdoor trips around Monywa.');

create index user_roles_role_user_idx
  on public.user_roles (role, user_id);
create index organizer_profiles_verification_status_idx
  on public.organizer_profiles (verification_status, created_at);
create index trip_categories_active_sort_idx
  on public.trip_categories (sort_order, name)
  where is_active;
create index destinations_region_name_idx
  on public.destinations (region, name)
  where is_active;
create index trips_organizer_status_created_idx
  on public.trips (organizer_profile_id, status, created_at desc);
create index trips_public_start_idx
  on public.trips (starts_at)
  where status = 'published';
create index trips_public_destination_start_idx
  on public.trips (destination_id, starts_at)
  where status = 'published';
create index trips_public_category_start_idx
  on public.trips (category_id, starts_at)
  where status = 'published';
create index trip_requests_trip_status_created_idx
  on public.trip_requests (trip_id, status, created_at);
create index trip_requests_customer_created_idx
  on public.trip_requests (customer_id, created_at desc);
create unique index trip_requests_one_active_per_customer_trip_idx
  on public.trip_requests (trip_id, customer_id)
  where status in ('pending', 'accepted');
create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_unread_recipient_created_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;
create index reports_status_created_idx
  on public.reports (status, created_at);
create index reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);
create index admin_actions_target_created_idx
  on public.admin_actions (target_kind, target_id, created_at desc);
create index admin_actions_actor_created_idx
  on public.admin_actions (actor_id, created_at desc);
create index trip_revisions_trip_status_created_idx
  on public.trip_revisions (trip_id, status, created_at desc);
create unique index trip_revisions_one_pending_per_trip_idx
  on public.trip_revisions (trip_id)
  where status = 'pending_review';

create or replace function private.current_user_has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = auth.uid()
      and ur.role = p_role
  );
$$;

create or replace function private.current_user_owns_organizer(p_organizer_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.organizer_profiles as op
    where op.id = p_organizer_profile_id
      and op.user_id = auth.uid()
  )
  and private.current_user_has_role('organizer');
$$;

create or replace function private.current_user_owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.trips as t
    join public.organizer_profiles as op
      on op.id = t.organizer_profile_id
    where t.id = p_trip_id
      and op.user_id = auth.uid()
  )
  and private.current_user_has_role('organizer');
$$;

create or replace function private.current_user_can_edit_trip_images(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.trips as t
    where t.id = p_trip_id
      and t.status in ('draft', 'rejected')
  )
  and private.current_user_owns_trip(p_trip_id);
$$;

create or replace function private.is_published_trip_image(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.trip_images as ti
    join public.trips as t on t.id = ti.trip_id
    where ti.storage_path = p_storage_path
      and (
        t.status = 'published'
        or private.current_user_has_role('admin')
      )
  );
$$;

create or replace function private.can_manage_trip_image_object(p_storage_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
begin
  if p_storage_path is null
    or p_storage_path
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,8}$'
  then
    return false;
  end if;

  v_trip_id := pg_catalog.split_part(p_storage_path, '/', 1)::uuid;
  return private.current_user_can_edit_trip_images(v_trip_id);
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;



create or replace function private.assign_organizer_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.user_id, 'organizer')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

create or replace function private.create_organizer_verification_details()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
    or (
      new.user_id <> auth.uid()
      and not private.current_user_has_role('admin')
    )
  then
    raise exception 'cannot create verification details for another organizer'
      using errcode = '42501';
  end if;

  insert into public.organizer_verification_details (organizer_profile_id)
  values (new.id);
  return new;
end;
$$;

create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.role = 'admin' then
    perform pg_catalog.pg_advisory_xact_lock(890122, 1);

    if (
      select pg_catalog.count(*)
      from public.user_roles as ur
      where ur.role = 'admin'
    ) <= 1 then
      raise exception 'cannot remove the last administrator'
        using errcode = '23514';
    end if;
  end if;

  return old;
end;
$$;

create or replace function private.audit_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.app_role;
  v_target_user_id uuid;
begin
  if tg_op = 'INSERT' then
    v_role := new.role;
    v_target_user_id := new.user_id;
  else
    v_role := old.role;
    v_target_user_id := old.user_id;
  end if;

  if v_actor_id is not null
    and (
      private.current_user_has_role('admin')
      or (
        tg_op = 'DELETE'
        and old.user_id = v_actor_id
        and old.role = 'admin'
      )
    )
  then
    insert into public.admin_actions (
      actor_id, action, target_kind, target_id, details
    )
    values (
      v_actor_id,
      case when tg_op = 'INSERT'
        then 'user_role_granted'::public.admin_action_type
        else 'user_role_revoked'::public.admin_action_type
      end,
      'user',
      v_target_user_id,
      pg_catalog.jsonb_build_object('role', v_role)
    );
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;
  return old;
end;
$$;

create or replace function private.audit_reference_data_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_target_id uuid;
  v_target_kind public.admin_target_type;
  v_action public.admin_action_type;
begin
  if v_actor_id is null or not private.current_user_has_role('admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_after := pg_catalog.to_jsonb(new);
    v_target_id := (v_after ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_before := pg_catalog.to_jsonb(old);
    v_after := pg_catalog.to_jsonb(new);
    v_target_id := (v_after ->> 'id')::uuid;
  else
    v_before := pg_catalog.to_jsonb(old);
    v_target_id := (v_before ->> 'id')::uuid;
  end if;

  if tg_table_name = 'trip_categories' then
    v_target_kind := 'trip_category';
    v_action := case tg_op
        when 'INSERT' then 'trip_category_created'::public.admin_action_type
        when 'UPDATE' then 'trip_category_updated'::public.admin_action_type
        else 'trip_category_deleted'::public.admin_action_type
    end;
  else
    v_target_kind := 'destination';
    v_action := case tg_op
        when 'INSERT' then 'destination_created'::public.admin_action_type
        when 'UPDATE' then 'destination_updated'::public.admin_action_type
        else 'destination_deleted'::public.admin_action_type
    end;
  end if;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    v_actor_id,
    v_action,
    v_target_kind,
    v_target_id,
    pg_catalog.jsonb_build_object('before', v_before, 'after', v_after)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
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

create or replace function private.validate_trip_request_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip public.trips%rowtype;
  v_organizer_user_id uuid;
begin
  if auth.uid() is null or not private.current_user_has_role('customer') then
    raise exception 'customer role required' using errcode = '42501';
  end if;

  new.customer_id := auth.uid();
  new.status := 'pending';

  select * into v_trip
  from public.trips
  where id = new.trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if v_trip.status <> 'published' then
    raise exception 'only published trips accept requests' using errcode = '23514';
  end if;
  if v_trip.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure has passed' using errcode = '23514';
  end if;
  if new.party_size > v_trip.capacity then
    raise exception 'requested party size exceeds trip capacity'
      using errcode = '23514';
  end if;

  select user_id into v_organizer_user_id
  from public.organizer_profiles
  where id = v_trip.organizer_profile_id;
  if v_organizer_user_id = auth.uid() then
    raise exception 'organizers cannot request their own trips'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger organizer_profiles_assign_role
  after insert on public.organizer_profiles
  for each row execute function private.assign_organizer_role();
create trigger organizer_profiles_create_verification_details
  after insert on public.organizer_profiles
  for each row execute function private.create_organizer_verification_details();

create trigger user_roles_prevent_last_admin_delete
  before delete on public.user_roles
  for each row execute function private.prevent_last_admin_removal();
create trigger user_roles_audit_insert
  after insert on public.user_roles
  for each row execute function private.audit_user_role_change();
create trigger user_roles_audit_delete
  after delete on public.user_roles
  for each row execute function private.audit_user_role_change();
create trigger trip_categories_audit_change
  after insert or update or delete on public.trip_categories
  for each row execute function private.audit_reference_data_change();
create trigger destinations_audit_change
  after insert or update or delete on public.destinations
  for each row execute function private.audit_reference_data_change();
create trigger trip_requests_notify
  after insert or update of status on public.trip_requests
  for each row execute function private.notify_trip_request_change();
create trigger trip_requests_validate_insert
  before insert on public.trip_requests
  for each row execute function private.validate_trip_request_insert();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizer_profiles_set_updated_at
  before update on public.organizer_profiles
  for each row execute function public.set_updated_at();
create trigger organizer_verification_details_set_updated_at
  before update on public.organizer_verification_details
  for each row execute function public.set_updated_at();
create trigger trip_categories_set_updated_at
  before update on public.trip_categories
  for each row execute function public.set_updated_at();
create trigger destinations_set_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();
create trigger trip_images_set_updated_at
  before update on public.trip_images
  for each row execute function public.set_updated_at();
create trigger trip_requests_set_updated_at
  before update on public.trip_requests
  for each row execute function public.set_updated_at();
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();
create trigger trip_revisions_set_updated_at
  before update on public.trip_revisions
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizer_profiles enable row level security;
alter table public.organizer_verification_details enable row level security;
alter table public.trip_categories enable row level security;
alter table public.destinations enable row level security;
alter table public.trips enable row level security;
alter table public.trip_images enable row level security;
alter table public.trip_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_actions enable row level security;
alter table public.trip_revisions enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_roles_select_own_or_admin
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.current_user_has_role('admin'))
  );
create policy user_roles_insert_admin_only
  on public.user_roles for insert to authenticated
  with check (
    (select private.current_user_has_role('admin'))
  );
create policy user_roles_delete_admin
  on public.user_roles for delete to authenticated
  using ((select private.current_user_has_role('admin')));

create policy organizer_profiles_read_public_or_owner_or_admin
  on public.organizer_profiles for select to anon, authenticated
  using (
    verification_status = 'verified'
    or user_id = (select auth.uid())
    or (select private.current_user_has_role('admin'))
  );
create policy organizer_profiles_insert_self
  on public.organizer_profiles for insert to authenticated
  with check (
    user_id = (select auth.uid())
  );
create policy organizer_profiles_update_owner
  on public.organizer_profiles for update to authenticated
  using (
    user_id = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
  );

create policy organizer_verification_details_read_owner_or_admin
  on public.organizer_verification_details for select to authenticated
  using (
    (select private.current_user_has_role('admin'))
    or (select private.current_user_owns_organizer(organizer_profile_id))
  );
create policy organizer_verification_details_update_contact_owner
  on public.organizer_verification_details for update to authenticated
  using (
    (select private.current_user_owns_organizer(organizer_profile_id))
  )
  with check (
    (select private.current_user_owns_organizer(organizer_profile_id))
  );

create policy trip_categories_read_active_or_admin
  on public.trip_categories for select to anon, authenticated
  using (
    is_active
    or (select private.current_user_has_role('admin'))
  );
create policy trip_categories_manage_admin
  on public.trip_categories for all to authenticated
  using ((select private.current_user_has_role('admin')))
  with check ((select private.current_user_has_role('admin')));

create policy destinations_read_active_or_admin
  on public.destinations for select to anon, authenticated
  using (
    is_active
    or (select private.current_user_has_role('admin'))
  );
create policy destinations_manage_admin
  on public.destinations for all to authenticated
  using ((select private.current_user_has_role('admin')))
  with check ((select private.current_user_has_role('admin')));

create policy trips_read_published_owner_or_admin
  on public.trips for select to anon, authenticated
  using (
    status = 'published'
    or (select private.current_user_owns_organizer(organizer_profile_id))
    or (select private.current_user_has_role('admin'))
  );
create policy trips_insert_own_draft
  on public.trips for insert to authenticated
  with check (
    status = 'draft'
    and (select private.current_user_owns_organizer(organizer_profile_id))
  );
create policy trips_update_own_editable
  on public.trips for update to authenticated
  using (
    status in ('draft', 'rejected')
    and (select private.current_user_owns_organizer(organizer_profile_id))
  )
  with check (
    status in ('draft', 'rejected')
    and (select private.current_user_owns_organizer(organizer_profile_id))
  );

create policy trip_images_read_published_owner_or_admin
  on public.trip_images for select to anon, authenticated
  using (
    (select private.current_user_has_role('admin'))
    or (select private.current_user_owns_trip(trip_id))
    or exists (
      select 1 from public.trips as t
      where t.id = trip_id and t.status = 'published'
    )
  );
create policy trip_images_insert_own_editable
  on public.trip_images for insert to authenticated
  with check (
    (select private.current_user_can_edit_trip_images(trip_id))
  );
create policy trip_images_update_own_editable
  on public.trip_images for update to authenticated
  using ((select private.current_user_can_edit_trip_images(trip_id)))
  with check ((select private.current_user_can_edit_trip_images(trip_id)));
create policy trip_images_delete_own_editable
  on public.trip_images for delete to authenticated
  using ((select private.current_user_can_edit_trip_images(trip_id)));

create policy trip_requests_read_customer_trip_owner_or_admin
  on public.trip_requests for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (select private.current_user_owns_trip(trip_id))
    or (select private.current_user_has_role('admin'))
  );
create policy trip_requests_insert_own_pending
  on public.trip_requests for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'pending'
    and (select private.current_user_has_role('customer'))
    and exists (
      select 1
      from public.trips as t
      where t.id = trip_id
        and t.status = 'published'
        and t.starts_at > pg_catalog.now()
        and party_size <= t.capacity
    )
  );

create policy notifications_read_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update_read_state_own
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy reports_read_own_or_admin
  on public.reports for select to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select private.current_user_has_role('admin'))
  );
create policy reports_insert_own_pending
  on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'pending'
    and (target_user_id is null or target_user_id <> (select auth.uid()))
  );

create policy admin_actions_read_admin
  on public.admin_actions for select to authenticated
  using ((select private.current_user_has_role('admin')));

create policy trip_revisions_read_owner_or_admin
  on public.trip_revisions for select to authenticated
  using (
    (select private.current_user_has_role('admin'))
    or exists (
      select 1
      from public.trips as t
      where t.id = trip_id
        and (select private.current_user_owns_organizer(t.organizer_profile_id))
    )
  );
create policy trip_revisions_insert_owner_draft
  on public.trip_revisions for insert to authenticated
  with check (
    status = 'draft'
    and submitted_by = (select auth.uid())
    and exists (
      select 1
      from public.trips as t
      where t.id = trip_id
        and t.status = 'published'
        and (select private.current_user_owns_organizer(t.organizer_profile_id))
    )
  );
create policy trip_revisions_update_owner_editable
  on public.trip_revisions for update to authenticated
  using (
    status in ('draft', 'rejected')
    and exists (
      select 1
      from public.trips as t
      where t.id = trip_id
        and t.status = 'published'
        and (select private.current_user_owns_organizer(t.organizer_profile_id))
    )
  )
  with check (
    status in ('draft', 'rejected')
    and exists (
      select 1
      from public.trips as t
      where t.id = trip_id
        and t.status = 'published'
        and (select private.current_user_owns_organizer(t.organizer_profile_id))
    )
  );

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.organizer_profiles from anon, authenticated;
revoke all on table public.organizer_verification_details from anon, authenticated;
revoke all on table public.trip_categories from anon, authenticated;
revoke all on table public.destinations from anon, authenticated;
revoke all on table public.trips from anon, authenticated;
revoke all on table public.trip_images from anon, authenticated;
revoke all on table public.trip_requests from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.admin_actions from anon, authenticated;
revoke all on table public.trip_revisions from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, phone_number, bio, avatar_path)
  on table public.profiles to authenticated;

grant select (id, display_name, bio, website_url, verification_status)
  on table public.organizer_profiles to anon, authenticated;
grant insert (user_id, display_name, bio, website_url)
  on table public.organizer_profiles to authenticated;
grant update (display_name, bio, website_url)
  on table public.organizer_profiles to authenticated;

grant select on table public.organizer_verification_details to authenticated;
grant update (contact_email)
  on table public.organizer_verification_details to authenticated;

grant select on table public.trip_categories to anon, authenticated;
grant insert, update, delete on table public.trip_categories to authenticated;
grant select on table public.destinations to anon, authenticated;
grant insert, update, delete on table public.destinations to authenticated;

grant select (
  id, organizer_profile_id, category_id, destination_id, title, summary,
  description, difficulty, duration_minutes, starts_at, ends_at,
  departure_location, capacity, price_mmk, safety_information,
  cancellation_policy, included_services, excluded_services,
  required_equipment, published_at, created_at, updated_at
) on table public.trips to anon, authenticated;
grant select (
  status, submitted_at, reviewed_by, reviewed_at, rejection_reason,
  cancellation_reason
) on table public.trips to authenticated;
grant insert (
  organizer_profile_id, category_id, destination_id, title, summary,
  description, difficulty, duration_minutes, starts_at, ends_at,
  departure_location, capacity, price_mmk, safety_information,
  cancellation_policy, included_services, excluded_services,
  required_equipment
) on table public.trips to authenticated;
grant update (
  category_id, destination_id, title, summary, description, difficulty,
  duration_minutes, starts_at, ends_at, departure_location, capacity,
  price_mmk, safety_information, cancellation_policy, included_services,
  excluded_services, required_equipment
) on table public.trips to authenticated;

grant select on table public.trip_images to anon, authenticated;
grant insert (trip_id, storage_path, alt_text, sort_order)
  on table public.trip_images to authenticated;
grant update (alt_text, sort_order)
  on table public.trip_images to authenticated;
grant delete on table public.trip_images to authenticated;

grant select on table public.trip_requests to authenticated;
grant insert (trip_id, party_size, message)
  on table public.trip_requests to authenticated;

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

grant select on table public.reports to authenticated;
grant insert (
  reporter_id, trip_id, organizer_profile_id, target_user_id, category, details
) on table public.reports to authenticated;

grant select on table public.admin_actions to authenticated;
grant select on table public.trip_revisions to authenticated;
grant insert (
  trip_id, submitted_by, title, summary, description, category_id,
  destination_id, difficulty, duration_minutes, starts_at, ends_at,
  departure_location, capacity, price_mmk, safety_information,
  cancellation_policy, included_services, excluded_services,
  required_equipment
) on table public.trip_revisions to authenticated;
grant update (
  title, summary, description, category_id, destination_id, difficulty,
  duration_minutes, starts_at, ends_at, departure_location, capacity,
  price_mmk, safety_information, cancellation_policy, included_services,
  excluded_services, required_equipment
) on table public.trip_revisions to authenticated;

grant select, insert, delete on table public.user_roles to authenticated;

grant usage on type public.app_role,
  public.organizer_verification_status,
  public.trip_status,
  public.trip_difficulty,
  public.trip_request_status,
  public.trip_revision_status,
  public.report_status,
  public.report_category,
  public.notification_type,
  public.admin_action_type,
  public.admin_target_type
  to anon, authenticated;

revoke all on function private.current_user_has_role(public.app_role) from public, anon;
revoke all on function private.current_user_owns_organizer(uuid) from public, anon;
revoke all on function private.current_user_owns_trip(uuid) from public, anon;
revoke all on function private.current_user_can_edit_trip_images(uuid) from public, anon;
revoke all on function private.is_published_trip_image(text) from public;
revoke all on function private.can_manage_trip_image_object(text) from public, anon;
revoke all on function private.assign_organizer_role() from public, anon, authenticated;
revoke all on function private.create_organizer_verification_details()
  from public, anon, authenticated;
revoke all on function private.prevent_last_admin_removal() from public, anon, authenticated;
revoke all on function private.audit_user_role_change() from public, anon, authenticated;
revoke all on function private.audit_reference_data_change() from public, anon, authenticated;
revoke all on function private.notify_trip_request_change() from public, anon, authenticated;
revoke all on function private.validate_trip_request_insert() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function private.current_user_has_role(public.app_role)
  to anon, authenticated;
grant execute on function private.current_user_owns_organizer(uuid)
  to anon, authenticated;
grant execute on function private.current_user_owns_trip(uuid)
  to anon, authenticated;
grant execute on function private.current_user_can_edit_trip_images(uuid)
  to authenticated;
grant execute on function private.is_published_trip_image(text)
  to anon, authenticated;
grant execute on function private.can_manage_trip_image_object(text)
  to authenticated;
create or replace function public.submit_trip_for_review(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip public.trips%rowtype;
begin
  if auth.uid() is null or not private.current_user_has_role('organizer') then
    raise exception 'organizer role required' using errcode = '42501';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not private.current_user_owns_organizer(v_trip.organizer_profile_id) then
    raise exception 'not the trip organizer' using errcode = '42501';
  end if;
  if v_trip.status not in ('draft', 'rejected') then
    raise exception 'trip is not editable for submission' using errcode = '23514';
  end if;
  if v_trip.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure must be in the future' using errcode = '23514';
  end if;

  update public.trips
  set status = 'pending_review',
      submitted_at = pg_catalog.now(),
      reviewed_by = null,
      reviewed_at = null,
      rejection_reason = null
  where id = p_trip_id;
end;
$$;

create or replace function public.approve_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip public.trips%rowtype;
  v_organizer_user_id uuid;
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if v_trip.status <> 'pending_review' then
    raise exception 'trip is not pending review' using errcode = '23514';
  end if;
  if v_trip.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure must be in the future' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.trip_categories as tc
    join public.destinations as d on d.id = v_trip.destination_id
    where tc.id = v_trip.category_id
      and tc.is_active
      and d.is_active
  ) then
    raise exception 'trip category and destination must be active'
      using errcode = '23514';
  end if;

  update public.trips
  set status = 'published',
      published_at = pg_catalog.now(),
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = null
  where id = p_trip_id;

  select user_id into v_organizer_user_id
  from public.organizer_profiles
  where id = v_trip.organizer_profile_id;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(), 'trip_approved', 'trip', p_trip_id, '{}'::jsonb
  );
  insert into public.notifications (
    recipient_id, notification_type, title, body, trip_id
  )
  values (
    v_organizer_user_id,
    'trip_approved',
    'Your trip is published',
    pg_catalog.format('"%s" has been approved and is now published.', v_trip.title),
    p_trip_id
  );
end;
$$;

create or replace function public.reject_trip(p_trip_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip public.trips%rowtype;
  v_organizer_user_id uuid;
  v_reason text := pg_catalog.btrim(p_reason);
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) = 0 or char_length(v_reason) > 2000 then
    raise exception 'a rejection reason between 1 and 2000 characters is required'
      using errcode = '22023';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id
  for update;

  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if v_trip.status <> 'pending_review' then
    raise exception 'trip is not pending review' using errcode = '23514';
  end if;

  update public.trips
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = v_reason
  where id = p_trip_id;

  select user_id into v_organizer_user_id
  from public.organizer_profiles
  where id = v_trip.organizer_profile_id;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(),
    'trip_rejected',
    'trip',
    p_trip_id,
    pg_catalog.jsonb_build_object('reason', v_reason)
  );
  insert into public.notifications (
    recipient_id, notification_type, title, body, trip_id
  )
  values (
    v_organizer_user_id,
    'trip_rejected',
    'Your trip needs changes',
    pg_catalog.format('"%s" was not approved: %s', v_trip.title, v_reason),
    p_trip_id
  );
end;
$$;

create or replace function public.submit_trip_revision_for_review(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_revision public.trip_revisions%rowtype;
begin
  if auth.uid() is null or not private.current_user_has_role('organizer') then
    raise exception 'organizer role required' using errcode = '42501';
  end if;

  select trip_id into v_trip_id
  from public.trip_revisions
  where id = p_revision_id;
  if not found then
    raise exception 'trip revision not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not private.current_user_owns_organizer(v_trip.organizer_profile_id) then
    raise exception 'not the trip organizer' using errcode = '42501';
  end if;

  select * into v_revision
  from public.trip_revisions
  where id = p_revision_id
  for update;
  if v_revision.status not in ('draft', 'rejected') then
    raise exception 'revision is not editable for submission' using errcode = '23514';
  end if;
  if v_trip.status <> 'published' then
    raise exception 'only published trips can have a revision submitted'
      using errcode = '23514';
  end if;
  if v_revision.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure must be in the future' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.trip_categories as tc
    join public.destinations as d on d.id = v_revision.destination_id
    where tc.id = v_revision.category_id
      and tc.is_active
      and d.is_active
  ) then
    raise exception 'trip category and destination must be active'
      using errcode = '23514';
  end if;

  update public.trip_revisions
  set status = 'pending_review',
      submitted_at = pg_catalog.now(),
      reviewed_by = null,
      reviewed_at = null,
      rejection_reason = null
  where id = p_revision_id;
end;
$$;

create or replace function public.approve_trip_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_revision public.trip_revisions%rowtype;
  v_accepted_party_size bigint;
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  select trip_id into v_trip_id
  from public.trip_revisions
  where id = p_revision_id;
  if not found then
    raise exception 'trip revision not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  select * into v_revision
  from public.trip_revisions
  where id = p_revision_id
  for update;
  if v_revision.status <> 'pending_review' then
    raise exception 'revision is not pending review' using errcode = '23514';
  end if;
  if v_trip.status <> 'published' then
    raise exception 'trip is not published' using errcode = '23514';
  end if;
  if v_revision.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure must be in the future' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.trip_categories as tc
    join public.destinations as d on d.id = v_revision.destination_id
    where tc.id = v_revision.category_id
      and tc.is_active
      and d.is_active
  ) then
    raise exception 'trip category and destination must be active'
      using errcode = '23514';
  end if;

  select coalesce(pg_catalog.sum(tr.party_size), 0)
  into v_accepted_party_size
  from public.trip_requests as tr
  where tr.trip_id = v_trip_id
    and tr.status = 'accepted';
  if v_revision.capacity < v_accepted_party_size then
    raise exception 'new capacity is below accepted participant count'
      using errcode = '23514';
  end if;

  update public.trips
  set title = v_revision.title,
      summary = v_revision.summary,
      description = v_revision.description,
      category_id = v_revision.category_id,
      destination_id = v_revision.destination_id,
      difficulty = v_revision.difficulty,
      duration_minutes = v_revision.duration_minutes,
      starts_at = v_revision.starts_at,
      ends_at = v_revision.ends_at,
      departure_location = v_revision.departure_location,
      capacity = v_revision.capacity,
      price_mmk = v_revision.price_mmk,
      safety_information = v_revision.safety_information,
      cancellation_policy = v_revision.cancellation_policy,
      included_services = v_revision.included_services,
      excluded_services = v_revision.excluded_services,
      required_equipment = v_revision.required_equipment
  where id = v_trip_id;

  update public.trip_revisions
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = null
  where id = p_revision_id;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(),
    'trip_revision_approved',
    'trip_revision',
    p_revision_id,
    pg_catalog.jsonb_build_object('trip_id', v_trip_id)
  );
end;
$$;

create or replace function public.reject_trip_revision(
  p_revision_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_revision public.trip_revisions%rowtype;
  v_reason text := pg_catalog.btrim(p_reason);
begin
  if auth.uid() is null or not private.current_user_has_role('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) = 0 or char_length(v_reason) > 2000 then
    raise exception 'a rejection reason between 1 and 2000 characters is required'
      using errcode = '22023';
  end if;

  select trip_id into v_trip_id
  from public.trip_revisions
  where id = p_revision_id;
  if not found then
    raise exception 'trip revision not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  select * into v_revision
  from public.trip_revisions
  where id = p_revision_id
  for update;
  if v_revision.status <> 'pending_review' or v_trip.status <> 'published' then
    raise exception 'revision is not pending for a published trip'
      using errcode = '23514';
  end if;

  update public.trip_revisions
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      rejection_reason = v_reason
  where id = p_revision_id;

  insert into public.admin_actions (
    actor_id, action, target_kind, target_id, details
  )
  values (
    auth.uid(),
    'trip_revision_rejected',
    'trip_revision',
    p_revision_id,
    pg_catalog.jsonb_build_object('reason', v_reason, 'trip_id', v_trip_id)
  );
end;
$$;

create or replace function public.accept_trip_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_request public.trip_requests%rowtype;
  v_accepted_party_size bigint;
  v_organizer_user_id uuid;
begin
  if auth.uid() is null or not private.current_user_has_role('organizer') then
    raise exception 'organizer role required' using errcode = '42501';
  end if;

  select trip_id into v_trip_id
  from public.trip_requests
  where id = p_request_id;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not private.current_user_owns_organizer(v_trip.organizer_profile_id) then
    raise exception 'not the trip organizer' using errcode = '42501';
  end if;
  if v_trip.status <> 'published' then
    raise exception 'trip is not published' using errcode = '23514';
  end if;
  if v_trip.starts_at <= pg_catalog.clock_timestamp() then
    raise exception 'departure has passed' using errcode = '23514';
  end if;

  select * into v_request
  from public.trip_requests
  where id = p_request_id
    and trip_id = v_trip_id
  for update;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request is not pending' using errcode = '23514';
  end if;

  select user_id into v_organizer_user_id
  from public.organizer_profiles
  where id = v_trip.organizer_profile_id;
  if v_request.customer_id = v_organizer_user_id then
    raise exception 'organizers cannot accept their own trip request'
      using errcode = '23514';
  end if;

  select coalesce(pg_catalog.sum(tr.party_size), 0)
  into v_accepted_party_size
  from public.trip_requests as tr
  where tr.trip_id = v_trip_id
    and tr.status = 'accepted';
  if v_accepted_party_size + v_request.party_size > v_trip.capacity then
    raise exception 'accepting this request would exceed trip capacity'
      using errcode = '23514';
  end if;

  update public.trip_requests
  set status = 'accepted'
  where id = p_request_id;
end;
$$;

create or replace function public.reject_trip_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_request public.trip_requests%rowtype;
begin
  if auth.uid() is null or not private.current_user_has_role('organizer') then
    raise exception 'organizer role required' using errcode = '42501';
  end if;

  select trip_id into v_trip_id
  from public.trip_requests
  where id = p_request_id;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not private.current_user_owns_organizer(v_trip.organizer_profile_id) then
    raise exception 'not the trip organizer' using errcode = '42501';
  end if;

  select * into v_request
  from public.trip_requests
  where id = p_request_id
    and trip_id = v_trip_id
  for update;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request is not pending' using errcode = '23514';
  end if;

  update public.trip_requests
  set status = 'rejected'
  where id = p_request_id;
end;
$$;

create or replace function public.cancel_trip_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip_id uuid;
  v_trip public.trips%rowtype;
  v_request public.trip_requests%rowtype;
begin
  if auth.uid() is null or not private.current_user_has_role('customer') then
    raise exception 'customer role required' using errcode = '42501';
  end if;

  select trip_id into v_trip_id
  from public.trip_requests
  where id = p_request_id;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;

  select * into v_trip
  from public.trips
  where id = v_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  select * into v_request
  from public.trip_requests
  where id = p_request_id
    and trip_id = v_trip_id
  for update;
  if not found then
    raise exception 'trip request not found' using errcode = 'P0002';
  end if;
  if v_request.customer_id <> auth.uid() then
    raise exception 'not the requesting customer' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'only pending requests can be cancelled by a customer'
      using errcode = '23514';
  end if;

  update public.trip_requests
  set status = 'cancelled'
  where id = p_request_id;
end;
$$;

create or replace function public.cancel_trip(p_trip_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trip public.trips%rowtype;
  v_request record;
  v_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if auth.uid() is null or not private.current_user_has_role('organizer') then
    raise exception 'organizer role required' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(p_reason) > 2000 then
    raise exception 'cancellation reason cannot exceed 2000 characters'
      using errcode = '22023';
  end if;

  select * into v_trip
  from public.trips
  where id = p_trip_id
  for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;
  if not private.current_user_owns_organizer(v_trip.organizer_profile_id) then
    raise exception 'not the trip organizer' using errcode = '42501';
  end if;
  if v_trip.status in ('cancelled', 'completed') then
    raise exception 'trip is already terminal' using errcode = '23514';
  end if;

  update public.trips
  set status = 'cancelled',
      rejection_reason = null,
      cancellation_reason = v_reason
  where id = p_trip_id;

  for v_request in
    update public.trip_requests
    set status = 'cancelled'
    where trip_id = p_trip_id
      and status in ('pending', 'accepted')
    returning id, customer_id
  loop
    insert into public.notifications (
      recipient_id, notification_type, title, body, trip_id, trip_request_id
    )
    values (
      v_request.customer_id,
      'trip_cancelled',
      'A trip you requested was cancelled',
      pg_catalog.format('"%s" has been cancelled.', v_trip.title),
      p_trip_id,
      v_request.id
    );
  end loop;
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

revoke all on function public.submit_trip_for_review(uuid) from public, anon;
revoke all on function public.approve_trip(uuid) from public, anon;
revoke all on function public.reject_trip(uuid, text) from public, anon;
revoke all on function public.submit_trip_revision_for_review(uuid) from public, anon;
revoke all on function public.approve_trip_revision(uuid) from public, anon;
revoke all on function public.reject_trip_revision(uuid, text) from public, anon;
revoke all on function public.accept_trip_request(uuid) from public, anon;
revoke all on function public.reject_trip_request(uuid) from public, anon;
revoke all on function public.cancel_trip_request(uuid) from public, anon;
revoke all on function public.cancel_trip(uuid, text) from public, anon;
revoke all on function public.review_organizer_profile(
  uuid, public.organizer_verification_status, text
) from public, anon;
revoke all on function public.resolve_report(uuid, public.report_status, text)
  from public, anon;
grant execute on function public.submit_trip_for_review(uuid) to authenticated;
grant execute on function public.approve_trip(uuid) to authenticated;
grant execute on function public.reject_trip(uuid, text) to authenticated;
grant execute on function public.submit_trip_revision_for_review(uuid)
  to authenticated;
grant execute on function public.approve_trip_revision(uuid) to authenticated;
grant execute on function public.reject_trip_revision(uuid, text)
  to authenticated;
grant execute on function public.accept_trip_request(uuid) to authenticated;
grant execute on function public.reject_trip_request(uuid) to authenticated;
grant execute on function public.cancel_trip_request(uuid) to authenticated;
grant execute on function public.cancel_trip(uuid, text) to authenticated;
grant execute on function public.review_organizer_profile(
  uuid, public.organizer_verification_status, text
) to authenticated;
grant execute on function public.resolve_report(uuid, public.report_status, text)
  to authenticated;

-- Consolidated 0005 admin notification functions and triggers.
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

create or replace function private.notify_new_organizer_application()
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

create or replace function private.notify_trip_submitted()
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

create or replace function private.notify_new_report()
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

-- Consolidated 0006 emergency-contact columns, constraints, grants, function, and trigger.
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

create or replace function private.apply_trip_revision_emergency_contact()
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

-- Consolidated 0009 verified-organizer transition guards.
create or replace function private.require_verified_organizer_for_trip_transition()
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

create or replace function private.require_verified_organizer_for_revision_transition()
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

-- Consolidated 0010 pending-report uniqueness preflight and indexes.
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

-- This replaces the legacy auth.users trigger with a caller-scoped,
-- app-owned provisioning RPC. The application must call it after establishing
-- an authenticated session (for example, in the auth callback).
create or replace function public.ensure_customer_profile()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  insert into public.profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'customer')
  on conflict (user_id, role) do nothing;
end;
$$;

revoke all on function public.ensure_customer_profile() from public, anon;
grant execute on function public.ensure_customer_profile() to authenticated;


-- Storage policies are Supabase-supported RLS policies on the managed objects
-- table. Only these Khayee-owned policy names are replaced; bucket metadata and
-- storage objects are never modified.
drop policy if exists trip_images_storage_read_published on storage.objects;
drop policy if exists trip_images_storage_insert_own_editable on storage.objects;
drop policy if exists trip_images_storage_delete_own_editable on storage.objects;

create policy trip_images_storage_read_published
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'trip-images'
    and (select private.is_published_trip_image(name))
  );

create policy trip_images_storage_insert_own_editable
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-images'
    and (select private.can_manage_trip_image_object(name))
  );

create policy trip_images_storage_delete_own_editable
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-images'
    and (select private.can_manage_trip_image_object(name))
  );
