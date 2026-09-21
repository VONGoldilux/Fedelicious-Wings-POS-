import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/dashboard",
  cashier: "/cashier/pos",
  kitchen: "/kitchen/queue",
};

// Which path prefixes each role is allowed into.
const ROLE_ALLOWED_PREFIX: Record<string, string> = {
  super_admin: "/admin",
  cashier: "/cashier",
  kitchen: "/kitchen",
};

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Public routes: let them through untouched.
  if (pathname === "/login" || pathname === "/") {
    return response;
  }

  if (
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/cashier") &&
    !pathname.startsWith("/kitchen")
  ) {
    return response;
  }

  // Re-create a client bound to this request/response pair to check the
  // session + role for route protection.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    return NextResponse.redirect(new URL("/login?error=inactive", request.url));
  }

  const allowedPrefix = ROLE_ALLOWED_PREFIX[profile.role];
  if (!allowedPrefix || !pathname.startsWith(allowedPrefix)) {
    // Signed in but wrong area — bounce to their own home screen.
    return NextResponse.redirect(
      new URL(ROLE_HOME[profile.role] ?? "/login", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
