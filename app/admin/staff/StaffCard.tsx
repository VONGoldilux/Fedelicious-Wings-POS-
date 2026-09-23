"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { ActiveStatusBadge } from "@/components/ui/Badge";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "cashier", label: "Admin / Cashier" },
  { value: "kitchen", label: "Kitchen Staff" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function StaffCard({
  staff,
  saving,
  onUpdateRole,
  onUpdateRate,
  onToggleActive,
}: {
  staff: Profile;
  saving: boolean;
  onUpdateRole: (id: string, role: UserRole) => void;
  onUpdateRate: (id: string, rate: number) => void;
  onToggleActive: (staff: Profile) => void;
}) {
  return (
    <Card>
      <CardHeader
        icon={
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-500 text-sm font-semibold text-white">
            {initials(staff.full_name)}
          </span>
        }
        title={staff.full_name}
        description={`Joined ${new Date(staff.created_at).toLocaleDateString("en-PH")}`}
        action={
          <button
            onClick={() => onToggleActive(staff)}
            disabled={saving}
            aria-label={staff.is_active ? "Deactivate account" : "Activate account"}
            className="disabled:cursor-default"
          >
            <ActiveStatusBadge active={staff.is_active} />
          </button>
        }
      />

      <div className="mt-3 flex flex-wrap gap-4">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
            Role
          </label>
          <select
            aria-label="Role"
            disabled={saving}
            value={staff.role}
            onChange={(e) => onUpdateRole(staff.id, e.target.value as UserRole)}
            className="h-11 w-full rounded-md border border-char-700/20 bg-white px-2.5 text-sm disabled:opacity-60 dark:border-cream/15 dark:bg-char-800 dark:text-cream"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
            Hourly rate (₱)
          </label>
          <input
            aria-label="Hourly rate"
            type="number"
            min={0}
            step={5}
            disabled={saving}
            defaultValue={staff.hourly_rate}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v !== staff.hourly_rate) onUpdateRate(staff.id, v);
            }}
            className="h-11 w-full rounded-md border border-char-700/20 bg-white px-2.5 text-sm disabled:opacity-60 dark:border-cream/15 dark:bg-char-800 dark:text-cream"
          />
        </div>
      </div>
    </Card>
  );
}
