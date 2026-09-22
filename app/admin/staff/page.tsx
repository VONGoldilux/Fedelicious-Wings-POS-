"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

// NOTE on adding new staff accounts:
// Creating an auth.users row requires either (a) the person signing up
// themselves once via a sign-up form, or (b) an admin API call using the
// SUPABASE_SERVICE_ROLE_KEY from a secure server-side Route Handler (never
// from the browser). This page manages role/rate/active-status for accounts
// that already exist; see the "Invite a new staff member" panel below for
// the two supported approaches.
export default function StaffPage() {
  const supabase = createClient();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadStaff() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("role")
      .order("full_name");
    setStaff(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRole(id: string, role: UserRole) {
    setSavingId(id);
    await supabase.from("profiles").update({ role }).eq("id", id);
    await loadStaff();
    setSavingId(null);
  }

  async function updateRate(id: string, hourly_rate: number) {
    setSavingId(id);
    await supabase.from("profiles").update({ hourly_rate }).eq("id", id);
    await loadStaff();
    setSavingId(null);
  }

  async function toggleActive(p: Profile) {
    setSavingId(p.id);
    await supabase
      .from("profiles")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    await loadStaff();
    setSavingId(null);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
          Staff Management
        </h1>
        <p className="text-sm text-char-700/70 dark:text-cream/70">
          Assign roles and hourly rates. Deactivating an account blocks login
          without deleting their history.
        </p>
      </div>

      <div className="mb-6 overflow-hidden rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-char-800/5 dark:bg-cream/5 text-char-700/70 dark:text-cream/70">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Hourly rate (₱)</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-char-700/50 dark:text-cream/50">
                  Loading staff…
                </td>
              </tr>
            )}
            {!loading &&
              staff.map((p) => (
                <tr key={p.id} className="border-t border-char-700/10 dark:border-cream/10">
                  <td className="px-4 py-3 font-medium text-char-900 dark:text-cream">
                    {p.full_name}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={p.role}
                      disabled={savingId === p.id}
                      onChange={(e) =>
                        updateRole(p.id, e.target.value as UserRole)
                      }
                      className="rounded border border-char-700/20 dark:border-cream/15 bg-white dark:bg-char-900 px-2 py-1"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="cashier">Admin / Cashier</option>
                      <option value="kitchen">Kitchen Staff</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={p.hourly_rate}
                      disabled={savingId === p.id}
                      onBlur={(e) => updateRate(p.id, Number(e.target.value))}
                      className="w-28 rounded border border-char-700/20 dark:border-cream/15 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      disabled={savingId === p.id}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.is_active
                          ? "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400"
                          : "bg-char-800/10 dark:bg-cream/10 text-char-700/60 dark:text-cream/60"
                      }`}
                    >
                      {p.is_active ? "Active" : "Deactivated"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {new Date(p.created_at).toLocaleDateString("en-PH")}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 shadow-sm">
        <h2 className="mb-2 font-display font-semibold text-char-900 dark:text-cream">
          Invite a new staff member
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-char-700/80 dark:text-cream/80">
          <li>
            <span className="font-medium">Self sign-up:</span> add a sign-up
            form (Supabase Auth <code>signUp()</code>) and send the staff
            member the link — a <code>profiles</code> row is created
            automatically with the default <code>cashier</code> role, which
            you then change above.
          </li>
          <li>
            <span className="font-medium">Admin-created:</span> build a small{" "}
            <code>/app/api/staff/invite/route.ts</code> Route Handler that
            calls{" "}
            <code>
              supabase.auth.admin.createUser()
            </code>{" "}
            using the <code>SUPABASE_SERVICE_ROLE_KEY</code> (server-side
            only) to create the account and send an invite email directly
            from this page.
          </li>
        </ol>
      </div>
    </div>
  );
}
