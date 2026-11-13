import { clearAuthCookiesAtScopes, createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";

type CookieUpdate = {
  name: string;
  value: string;
  options: CookieOptions;
};

function getStorageKey(request: NextRequest, projectRef: string) {
  const storageKey = `sb-${projectRef}-auth-token`;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name === storageKey || name.startsWith(`${storageKey}.`));

  return hasAuthCookie ? storageKey : null;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL and publishable key must be configured.");
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = getStorageKey(request, projectRef);
  if (!storageKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const responseCookies: CookieUpdate[] = [];
  const responseHeaders = new Map<string, string>();

  const setAll = (
    cookiesToSet: CookieUpdate[],
    headers: Record<string, string> = {},
  ) => {
    for (const cookie of cookiesToSet) {
      request.cookies.set(cookie.name, cookie.value);
      responseCookies.push(cookie);
    }
    for (const [name, value] of Object.entries(headers)) {
      responseHeaders.set(name, value);
    }

    response = NextResponse.next({ request });
    for (const cookie of responseCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    for (const [name, value] of responseHeaders) {
      response.headers.set(name, value);
    }
  };

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll,
    },
  });

  const { error } = await supabase.auth.getUser();
  if (error && isUnauthenticatedSessionError(error)) {
    await clearAuthCookiesAtScopes({
      getAll: () => request.cookies.getAll(),
      setAll,
      storageKey,
      scopes: [{}],
    });
  } else if (error) {
    throw new Error("Could not verify the current session.", { cause: error });
  }

  return response;
}

export const config = {
  matcher: [
    "/signup",
    "/login",
    "/auth/callback",
    "/organizer/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/notifications",
    "/trips/:path*",
    "/api/organizer/:path*",
  ],
};
