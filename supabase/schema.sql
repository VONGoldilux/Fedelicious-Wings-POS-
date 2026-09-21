-- ============================================================================
-- Fedelicious Wings — POS & Restaurant Management System
-- Supabase SQL Setup
-- Run this whole file once in the Supabase SQL Editor (Project > SQL Editor).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('super_admin', 'cashier', 'kitchen');
create type public.order_status as enum ('queued', 'preparing', 'ready', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'gcash', 'card', 'other');

-- ----------------------------------------------------------------------------
-- 2. PROFILES  (extends auth.users, holds role + payroll rate)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'cashier',
  hourly_rate numeric(10,2) not null default 0,     -- used by payroll
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per staff member. id must match auth.users.id.';

-- Helper: fetch the current caller's role without recursive RLS lookups.
-- SECURITY DEFINER lets this bypass RLS on profiles internally, which is what
-- lets policies below reference "my role" without infinite recursion.
create or replace function public.current_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- 3. PRODUCTS (menu items)
-- ----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  category text not null default 'Wings',
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. ORDERS + ORDER ITEMS
-- ----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  status public.order_status not null default 'queued',
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  payment_method public.payment_method,
  amount_tendered numeric(10,2),
  change_due numeric(10,2),
  notes text,
  cashier_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  completed_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,   -- snapshot, survives product edits/deletes
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) generated always as (unit_price * quantity) stored,
  special_instructions text
);

-- ----------------------------------------------------------------------------
-- 5. TIME LOGS (clock in / clock out, feeds payroll)
-- ----------------------------------------------------------------------------
create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  hours_worked numeric(6,2) generated always as (
    case when clock_out is null then null
    else round(extract(epoch from (clock_out - clock_in)) / 3600.0, 2)
    end
  ) stored
);

-- ----------------------------------------------------------------------------
-- 6. INDEXES
-- ----------------------------------------------------------------------------
create index idx_orders_status on public.orders (status);
create index idx_orders_created_at on public.orders (created_at desc);
create index idx_order_items_order_id on public.order_items (order_id);
create index idx_time_logs_staff_id on public.time_logs (staff_id);
create index idx_time_logs_open on public.time_logs (staff_id) where clock_out is null;

-- ----------------------------------------------------------------------------
-- 7. updated_at trigger for products
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Auto-create a profile row whenever a new auth user is created.
--    Default role is 'cashier' — Super Admin promotes/changes roles afterwards
--    from the Staff Management screen.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'cashier')
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.time_logs enable row level security;

-- ---------- PROFILES ----------
-- Everyone signed in can read profiles (needed for cashier/kitchen names on
-- orders, and for the app to look up its own role). Only super_admin can
-- write, except a user may update a few of their own non-sensitive fields.
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles_insert_super_admin"
on public.profiles for insert
to authenticated
with check (public.is_super_admin());

create policy "profiles_update_super_admin"
on public.profiles for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "profiles_delete_super_admin"
on public.profiles for delete
to authenticated
using (public.is_super_admin());

-- ---------- PRODUCTS ----------
-- Anyone signed in (cashier, kitchen, admin) can view products.
-- Only super_admin can create/edit/delete products.
create policy "products_select_authenticated"
on public.products for select
to authenticated
using (true);

create policy "products_insert_super_admin"
on public.products for insert
to authenticated
with check (public.is_super_admin());

create policy "products_update_super_admin"
on public.products for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "products_delete_super_admin"
on public.products for delete
to authenticated
using (public.is_super_admin());

-- ---------- ORDERS ----------
-- super_admin: full access (reports).
-- cashier: can create orders and read/update all orders (needs to see
--          kitchen status changes and mark completed after payment).
-- kitchen: can read all orders and update status only (no create/delete,
--          enforced further by the app only exposing a status-change action;
--          RLS still allows any UPDATE, this is a reasonable POS trade-off —
--          restrict further if the kitchen KDS should not adjust totals).
create policy "orders_select_staff"
on public.orders for select
to authenticated
using (public.current_role() in ('super_admin', 'cashier', 'kitchen'));

create policy "orders_insert_cashier_or_admin"
on public.orders for insert
to authenticated
with check (public.current_role() in ('super_admin', 'cashier'));

create policy "orders_update_staff"
on public.orders for update
to authenticated
using (public.current_role() in ('super_admin', 'cashier', 'kitchen'))
with check (public.current_role() in ('super_admin', 'cashier', 'kitchen'));

create policy "orders_delete_super_admin"
on public.orders for delete
to authenticated
using (public.is_super_admin());

-- ---------- ORDER ITEMS ----------
create policy "order_items_select_staff"
on public.order_items for select
to authenticated
using (public.current_role() in ('super_admin', 'cashier', 'kitchen'));

create policy "order_items_insert_cashier_or_admin"
on public.order_items for insert
to authenticated
with check (public.current_role() in ('super_admin', 'cashier'));

create policy "order_items_delete_super_admin"
on public.order_items for delete
to authenticated
using (public.is_super_admin());

-- ---------- TIME LOGS ----------
-- Staff can insert/close their OWN clock-in/out rows.
-- Super admin can read/manage everyone's, for payroll.
create policy "time_logs_select_own_or_admin"
on public.time_logs for select
to authenticated
using (staff_id = auth.uid() or public.is_super_admin());

create policy "time_logs_insert_own"
on public.time_logs for insert
to authenticated
with check (staff_id = auth.uid());

create policy "time_logs_update_own_or_admin"
on public.time_logs for update
to authenticated
using (staff_id = auth.uid() or public.is_super_admin())
with check (staff_id = auth.uid() or public.is_super_admin());

create policy "time_logs_delete_super_admin"
on public.time_logs for delete
to authenticated
using (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 10. REALTIME
--     Enable realtime broadcasts for orders + order_items so the KDS and
--     cashier screens update live. (Run once; safe to re-run.)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- ----------------------------------------------------------------------------
-- 11. STORAGE — menu-images bucket
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- Public read (so <img> tags work without signed URLs).
create policy "menu_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'menu-images');

-- Only super_admin can upload/replace/delete images in this bucket.
create policy "menu_images_super_admin_write"
on storage.objects for insert
to authenticated
with check (bucket_id = 'menu-images' and public.is_super_admin());

create policy "menu_images_super_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'menu-images' and public.is_super_admin())
with check (bucket_id = 'menu-images' and public.is_super_admin());

create policy "menu_images_super_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'menu-images' and public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 12. KITCHEN AVAILABILITY TOGGLE
--     Kitchen staff know what's actually cookable right now (out of stock
--     ingredients, etc.) but shouldn't get broad UPDATE rights on products
--     (price/name/category stay super_admin-only). This function is the one
--     narrow door: it only ever touches is_available, for kitchen or admin.
-- ----------------------------------------------------------------------------
create or replace function public.set_product_availability(product_id uuid, available boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() not in ('super_admin', 'kitchen') then
    raise exception 'Not authorized to change product availability';
  end if;

  update public.products
  set is_available = available, updated_at = now()
  where id = product_id;
end;
$$;

grant execute on function public.set_product_availability(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 13. SEED: first Super Admin
--     Sign up a user through the app's /login page first (Supabase Auth
--     creates the auth.users row + a 'cashier' profile automatically via the
--     trigger above), THEN run this to promote that one account:
--
--     update public.profiles set role = 'super_admin'
--     where id = (select id from auth.users where email = 'owner@fedeliciouswings.com');
-- ----------------------------------------------------------------------------
