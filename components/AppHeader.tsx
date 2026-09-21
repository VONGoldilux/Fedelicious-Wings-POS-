"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  super_admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/transactions", label: "Transactions" },
    { href: "/admin/products", label: "Menu" },
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

export default function AppHeader() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();

  const links = profile ? NAV_BY_ROLE[profile.role] ?? [] : [];

  return (
    <header className="sticky top-0 z-30 border-b border-char-700/60 bg-char-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
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
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-ember-500 text-char-950"
                      : "text-cream/70 hover:bg-char-800 hover:text-cream"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-cream">{profile.full_name}</p>
              <p className="text-xs capitalize text-cream/50">
                {profile.role.replace("_", " ")}
              </p>
            </div>
          )}
          <button
            onClick={signOut}
            className="rounded-md border border-char-700 px-3 py-1.5 text-sm text-cream/80 transition-colors hover:border-ember-500 hover:text-ember-400"
          >
            Clock out &amp; sign out
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-char-800 px-4 py-1 sm:hidden">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-ember-500 text-char-950" : "text-cream/70"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
