# Fedelicious Wings — POS & Restaurant Management System

Next.js (App Router, TypeScript, Tailwind) + Supabase (Postgres, Auth,
Storage, Realtime) system with three role-based areas:

- **Super Admin** — `/admin/dashboard`, `/admin/products`, `/admin/staff`, `/admin/payroll`
- **Admin/Cashier** — `/cashier/pos`
- **Kitchen Staff** — `/kitchen/queue`

## 1. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire contents of `supabase/schema.sql`
   once. It creates:
   - `profiles`, `products`, `orders`, `order_items`, `time_logs` tables
   - Role enum (`super_admin`, `cashier`, `kitchen`) and helper functions
   - RLS policies for every table
   - A trigger that auto-creates a `profiles` row (default role `cashier`)
     whenever someone signs up
   - The `menu-images` Storage bucket + its policies
   - Realtime publication for `orders` and `order_items`
3. **Email confirmation**: for staff accounts, either disable "Confirm
   email" under Authentication > Providers (fastest for an internal staff
   app), or keep it on and have staff confirm via email before their first
   login.
4. **Create your first Super Admin**:
   - Sign up once through the app's `/login` flow (you'll need a temporary
     sign-up form, or create the user directly under Authentication > Users
     in the dashboard).
   - Then in the SQL Editor:
     ```sql
     update public.profiles set role = 'super_admin'
     where id = (select id from auth.users where email = 'owner@fedeliciouswings.com');
     ```

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in from **Project Settings > API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-side only, optional
```

## 3. Install & run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login`.

## 4. How the pieces fit together

| Concern | Where |
|---|---|
| Supabase clients | `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components), `lib/supabase/middleware.ts` (session refresh) |
| Session + role state, clock in/out | `lib/auth-context.tsx` (`AuthProvider`, `useAuth()`) |
| Route protection | `middleware.ts` (server redirect) + `components/RoleGate.tsx` (client-side second layer) |
| Shared nav/header | `components/AppHeader.tsx` |
| Types mirroring the DB | `lib/types.ts` |

### Time tracking
`AuthProvider` opens a `time_logs` row (clock in) right after a successful
sign-in / session restore, and closes it (clock out, `hours_worked` is a
generated column) when the user clicks **"Clock out & sign out"** in the
header.

### Product images
The product form (`app/admin/products/page.tsx`) uploads the chosen file
straight to the `menu-images` Storage bucket, then stores the returned
public URL on the `products.image_url` column.

### Realtime flow (Cashier ↔ Kitchen)
1. Cashier checks out → inserts a row into `orders` (`status: 'queued'`) and
   its `order_items`.
2. Kitchen's `/kitchen/queue` is subscribed via `supabase.channel(...)
   .on('postgres_changes', ...)` to `orders` INSERT/UPDATE — the new order
   appears instantly in the **Queued** column.
3. Kitchen staff click **Start preparing** → **Mark as Ready**, each a
   `status` update.
4. Cashier's `/cashier/pos` is subscribed to `orders` UPDATE events; when a
   row flips to `status = 'ready'`, a toast-style alert appears so the
   cashier knows to hand off the order and click **Mark handed off**
   (`status: 'completed'`).

### Payroll
`app/admin/payroll/page.tsx` pulls `time_logs` for the selected week, joins
against each staff member's `hourly_rate` in `profiles`, and sums
`hours_worked × hourly_rate` per person and in total.

## 5. Adding new staff accounts

Creating an `auth.users` row needs either:
- A self-serve sign-up form (simplest — the DB trigger auto-creates their
  `profiles` row as `cashier`; promote them from `/admin/staff` after), or
- A server-side Route Handler using `SUPABASE_SERVICE_ROLE_KEY` and
  `supabase.auth.admin.createUser()` to invite staff directly from the
  Staff Management screen (see the in-app notes on that page for the
  exact call — keep the service role key server-side only, never in the
  browser).

## 6. Notes & things to harden before going live

- Add input validation / rate limiting around checkout if this will be
  internet-facing (currently relies on RLS + client-side checks).
- Consider a `void`/refund flow for `orders` beyond `cancelled`.
- Add pagination to the Sales Reports and Payroll tables once order volume
  grows past a page or two.
- The KDS RLS policy lets kitchen staff update any order column; scope it
  to a `status`-only update (e.g. a Postgres function) if you want to lock
  that down further.
# Fedelicious-Wings-POS-
