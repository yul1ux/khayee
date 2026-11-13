import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSafeAuthReturnPath } from "@/lib/auth/return-path";

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const nextPath = getSafeAuthReturnPath(callbackUrl.searchParams.get("next") ?? undefined);
  if (!code) redirect("/signup?confirmation=failed");

  let confirmationFailed = false;
  let provisioningFailed = false;
  let confirmationEstablished = false;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | undefined;
  try {
    supabase = await createSupabaseServerClient({ writeCookies: true });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Khayee email confirmation failed", error);
      confirmationFailed = true;
    } else if (!data.session) {
      console.error("Khayee email confirmation returned no authenticated session");
      confirmationFailed = true;
    } else {
      confirmationEstablished = true;
      const { error: provisioningError } = await supabase.rpc("ensure_customer_profile");
      if (provisioningError) {
        console.error("Khayee confirmation profile provisioning failed", provisioningError);
        provisioningFailed = true;
      }
    }
  } catch (error) {
    if (confirmationEstablished) {
      console.error("Khayee confirmation profile provisioning failed", error);
      provisioningFailed = true;
    } else {
      console.error("Khayee email confirmation request failed", error);
      confirmationFailed = true;
    }
  }

  if (confirmationFailed) redirect("/signup?confirmation=failed");
  if (provisioningFailed) {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Khayee confirmation cleanup failed", error);
      } catch (error) {
        console.error("Khayee confirmation cleanup failed", error);
      }
    }
    redirect("/signup?confirmation=setup-failed");
  }
  redirect(nextPath ?? "/");
}
