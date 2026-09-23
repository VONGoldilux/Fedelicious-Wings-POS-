"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cx } from "@/lib/utils";
import CashCountModal from "@/components/CashCountModal";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  super_admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/transactions", label: "Transactions" },
    { href: "/admin/products", label: "Menu" },
    { href: "/admin/promos", label: "Promos" },
    { href: "/admin/staff", label: "Staff" },
    { href: "/admin/payroll", label: "Payroll" },
  ],
  cashier: [
    { href: "/cashier/pos", label: "Cashier" },
    { href: "/cashier/transactions", label: "Transactions" },
  ],
  kitchen: [
    { href: "/kitchen/queue", label: "Kitchen" },
    { href: "/kitchen/availability", label: "Menu" },
    { href: "/kitchen/history", label: "History" },
  ],
};

// This header is intentionally always-dark chrome (brand identity), unlike
// the content area beneath it which flips with the site theme — so it uses
// its own cream-on-char classes rather than the theme-aware `Button` kit.
export default function AppHeader() {
  const { profile, activeClockIn, signOut } = useAuth();
  const pathname = usePathname();
  const [showCashCount, setShowCashCount] = useState(false);

  const links = profile ? NAV_BY_ROLE[profile.role] ?? [] : [];

  function handleSignOutClick() {
    if (profile?.role === "cashier" && activeClockIn) {
      setShowCashCount(true);
    } else {
      signOut();
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-char-700/60 bg-char-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Fedelicious Wings"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="font-display text-lg font-semibold tracking-tight text-cream">
              Fedelicious <span className="text-ember-500">Wings</span>
            </span>
          </span>
          <nav className="hidden gap-1 sm:flex">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cx(
                    "flex h-10 items-center rounded-md px-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-ember-500 text-char-950"
                      : "text-cream/70 hover:bg-char-800 hover:text-cream"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {profile && (
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-cream">{profile.full_name}</p>
              <p className="text-xs capitalize text-cream/50">
                {profile.role.replace("_", " ")}
              </p>
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={handleSignOutClick}
            className="flex h-10 items-center gap-1.5 rounded-md border border-char-700 px-3 text-sm text-cream/80 transition-colors hover:border-ember-500 hover:text-ember-400"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Clock out &amp; sign out</span>
          </button>
        </div>
      </div>

      {showCashCount && profile && activeClockIn && (
        <CashCountModal
          cashierId={profile.id}
          clockIn={activeClockIn}
          onCancel={() => setShowCashCount(false)}
          onConfirm={(result) => signOut(result)}
        />
      )}
      <nav className="flex gap-1 overflow-x-auto border-t border-char-800 px-4 py-1 sm:hidden">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                "flex h-10 shrink-0 items-center rounded-md px-3.5 text-sm font-medium",
                active ? "bg-ember-500 text-char-950" : "text-cream/70"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
