import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/runtime-config";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isDemoMode()) return NextResponse.next();
  if (!url || !key) {
    return NextResponse.redirect(new URL("/setup-required", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isTutorRoute = pathname.startsWith("/tutor");
  const isStudentRoute = pathname.startsWith("/student");
  const protectedRoute =
    isTutorRoute || isStudentRoute || pathname === "/change-password";

  if (protectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user) {
    const role = user.app_metadata.role as "tutor" | "student" | undefined;
    if (isTutorRoute && role !== "tutor") {
      return NextResponse.redirect(new URL("/student", request.url));
    }
    if (isStudentRoute && role !== "student") {
      return NextResponse.redirect(new URL("/tutor", request.url));
    }
    if (
      role === "student" &&
      user.user_metadata.must_change_password &&
      pathname !== "/change-password"
    ) {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/tutor/:path*", "/student/:path*", "/change-password"],
};
