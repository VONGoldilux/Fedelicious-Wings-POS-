"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const inactiveError = searchParams.get("error") === "inactive";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-char-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="Fedelicious Wings"
            width={80}
            height={80}
            className="mx-auto mb-3 rounded-full"
          />
          <h1 className="font-display text-3xl font-semibold text-cream">
            Fedelicious <span className="text-ember-500">Wings</span>
          </h1>
          <p className="mt-1 text-sm text-cream/50">
            Staff sign-in · Talisay, Batangas
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-card border border-char-700 bg-char-900 p-6 shadow-xl"
        >
          {(error || inactiveError) && (
            <div className="mb-4 rounded-md border border-ember-700 bg-ember-700/10 px-3 py-2 text-sm text-ember-400">
              {error ?? "This account has been deactivated. Contact the Super Admin."}
            </div>
          )}

          <label className="mb-1 block text-sm font-medium text-cream/80">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-char-700 bg-char-800 px-3 py-2 text-cream placeholder:text-cream/30 focus:border-ember-500 focus:outline-none"
            placeholder="you@fedeliciouswings.com"
          />

          <label className="mb-1 block text-sm font-medium text-cream/80">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-md border border-char-700 bg-char-800 px-3 py-2 text-cream placeholder:text-cream/30 focus:border-ember-500 focus:outline-none"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-ember-500 py-2.5 font-semibold text-char-950 transition-colors hover:bg-ember-400 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in & clock in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-cream/40">
          Signing in automatically starts your shift time log.
        </p>
      </div>
    </main>
  );
}
