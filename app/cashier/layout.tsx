import RoleGate from "@/components/RoleGate";

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["cashier", "super_admin"]}>{children}</RoleGate>;
}
