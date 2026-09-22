import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fedelicious Wings — POS",
  description: "Point of Sale & Restaurant Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Applies the saved theme before paint, so there's no flash of the
            wrong theme on load — this can't be a React effect since those
            only run after the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body text-char-900 dark:text-cream">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
