begin;

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

commit;
