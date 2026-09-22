"use client";

import { Card, CardHeader, Avatar, Body1Strong, Caption1, Dropdown, Option, SpinButton, tokens } from "@fluentui/react-components";
import { ActiveStatusBadge } from "@/components/fluent/StatusBadge";
import { useSharedStyles } from "@/components/fluent/styles";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "cashier", label: "Admin / Cashier" },
  { value: "kitchen", label: "Kitchen Staff" },
];

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
  const styles = useSharedStyles();

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        image={<Avatar name={staff.full_name} color="brand" size={40} />}
        header={<Body1Strong>{staff.full_name}</Body1Strong>}
        description={
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Joined {new Date(staff.created_at).toLocaleDateString("en-PH")}
          </Caption1>
        }
        action={
          <button
            onClick={() => onToggleActive(staff)}
            disabled={saving}
            aria-label={staff.is_active ? "Deactivate account" : "Activate account"}
            style={{ all: "unset", cursor: saving ? "default" : "pointer" }}
          >
            <ActiveStatusBadge active={staff.is_active} />
          </button>
        }
      />

      <div
        style={{
          marginTop: tokens.spacingVerticalM,
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.spacingHorizontalM,
        }}
      >
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: "block", marginBottom: tokens.spacingVerticalXXS }}>
            Role
          </Caption1>
          <Dropdown
            aria-label="Role"
            disabled={saving}
            value={ROLE_OPTIONS.find((o) => o.value === staff.role)?.label ?? ""}
            selectedOptions={[staff.role]}
            onOptionSelect={(_, data) => data.optionValue && onUpdateRole(staff.id, data.optionValue as UserRole)}
          >
            {ROLE_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Dropdown>
        </div>

        <div style={{ flex: "1 1 120px", minWidth: 120 }}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, display: "block", marginBottom: tokens.spacingVerticalXXS }}>
            Hourly rate (₱)
          </Caption1>
          <SpinButton
            aria-label="Hourly rate"
            disabled={saving}
            defaultValue={staff.hourly_rate}
            min={0}
            step={5}
            precision={2}
            onChange={(_, data) => {
              if (data.value != null) onUpdateRate(staff.id, data.value);
            }}
          />
        </div>
      </div>
    </Card>
  );
}
