-- Restore least-privilege public trip reads and keep organizer/admin reads authenticated.
grant select on table public.trips to anon;

drop policy if exists trips_read_published_owner_or_admin on public.trips;
drop policy if exists trips_read_published_anon on public.trips;
drop policy if exists trips_read_published_authenticated_owner_or_admin on public.trips;

create policy trips_read_published_anon
  on public.trips for select to anon
  using (status = 'published');

create policy trips_read_published_authenticated_owner_or_admin
  on public.trips for select to authenticated
  using (
    status = 'published'
    or (select private.current_user_owns_organizer(organizer_profile_id))
    or (select private.current_user_has_role('admin'))
  );
