import RoleGate from "@/components/RoleGate";

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["kitchen", "super_admin"]}>{children}</RoleGate>;
}
