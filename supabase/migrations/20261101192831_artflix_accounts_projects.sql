-- ArtFlix: account approvals and per-user projects.
create table if not exists public.artflix_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'master')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artflix_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  document jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists artflix_projects_owner_updated_idx
  on public.artflix_projects (owner_id, updated_at desc);

create schema if not exists artflix_private;
revoke all on schema artflix_private from public, anon;
grant usage on schema artflix_private to authenticated;

create or replace function artflix_private.is_master()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.artflix_profiles p
    where p.id = (select auth.uid()) and p.role = 'master' and p.active
  );
$$;
create or replace function artflix_private.is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.artflix_profiles p
    where p.id = (select auth.uid()) and p.active
  );
$$;
revoke all on function artflix_private.is_master() from public, anon;
revoke all on function artflix_private.is_active() from public, anon;
grant execute on function artflix_private.is_master() to authenticated;
grant execute on function artflix_private.is_active() to authenticated;

create or replace function artflix_private.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.artflix_profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
revoke all on function artflix_private.sync_auth_profile() from public, anon, authenticated;
drop trigger if exists artflix_profile_from_auth on auth.users;
create trigger artflix_profile_from_auth
  after insert or update of email on auth.users
  for each row execute function artflix_private.sync_auth_profile();

insert into public.artflix_profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

alter table public.artflix_profiles enable row level security;
alter table public.artflix_projects enable row level security;
revoke all on public.artflix_profiles from anon, authenticated;
revoke all on public.artflix_projects from anon, authenticated;
grant select on public.artflix_profiles to authenticated;
grant update (active) on public.artflix_profiles to authenticated;
grant select, insert, update, delete on public.artflix_projects to authenticated;

create policy "read own profile or master directory" on public.artflix_profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select artflix_private.is_master()));
create policy "master approves users" on public.artflix_profiles
  for update to authenticated
  using ((select artflix_private.is_master()) and role = 'user')
  with check ((select artflix_private.is_master()) and role = 'user');

create policy "read own projects" on public.artflix_projects
  for select to authenticated
  using (owner_id = (select auth.uid()) and (select artflix_private.is_active()));
create policy "create own projects" on public.artflix_projects
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select artflix_private.is_active()));
create policy "update own projects" on public.artflix_projects
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select artflix_private.is_active()))
  with check (owner_id = (select auth.uid()) and (select artflix_private.is_active()));
create policy "delete own projects" on public.artflix_projects
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select artflix_private.is_active()));

-- Keep large reference images and PDF previews out of project JSON.
insert into storage.buckets (id, name, public, file_size_limit)
values ('artflix-assets', 'artflix-assets', false, 10485760)
on conflict (id) do nothing;

create policy "artflix users read own assets" on storage.objects
  for select to authenticated
  using (bucket_id = 'artflix-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select artflix_private.is_active()));
create policy "artflix users upload own assets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artflix-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select artflix_private.is_active()));
create policy "artflix users update own assets" on storage.objects
  for update to authenticated
  using (bucket_id = 'artflix-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select artflix_private.is_active()))
  with check (bucket_id = 'artflix-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select artflix_private.is_active()));
create policy "artflix users delete own assets" on storage.objects
  for delete to authenticated
  using (bucket_id = 'artflix-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select artflix_private.is_active()));

-- Bootstrap the first master only after the owner registers and verifies the email:
-- update public.artflix_profiles set role = 'master', active = true
-- where email = 'willvoloschen@gmail.com'
--   and id in (select id from auth.users where email_confirmed_at is not null);
