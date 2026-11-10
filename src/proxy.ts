import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/candidate", "/company", "/admin", "/onboarding", "/invitations", "/settings"];

/**
 * Refreshes the Supabase session cookie on every request and performs a fast
 * unauthenticated redirect for protected areas. Role checks happen server-side
 * in each layout (src/lib/auth/session.ts) and again in the database (RLS).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isAuthed && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/sign-in";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
