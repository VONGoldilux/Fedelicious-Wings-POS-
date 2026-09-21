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
      <body className="font-body text-char-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
