import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type ServerClientOptions = {
  writeCookies?: boolean;
};

export async function createSupabaseServerClient({
  writeCookies = false,
}: ServerClientOptions = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase URL and publishable key must be configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!writeCookies) {
          return;
        }

        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
