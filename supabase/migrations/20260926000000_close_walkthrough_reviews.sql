-- Close walkthrough reviews and restrict review data to the super admin.
-- Nobody can add or edit reviews any more; only the super admin can read them
-- or clear them (the dashboard's "Unlock" action).

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "Staff can insert reviews" on public.walkthrough_reviews;
drop policy if exists "Staff can update own reviews" on public.walkthrough_reviews;
drop policy if exists "Staff can read all reviews" on public.walkthrough_reviews;
drop policy if exists "Staff can delete reviews" on public.walkthrough_reviews;

create policy "Super admin can read reviews" on public.walkthrough_reviews
  for select to authenticated using (public.is_super_admin());

create policy "Super admin can delete reviews" on public.walkthrough_reviews
  for delete to authenticated using (public.is_super_admin());
