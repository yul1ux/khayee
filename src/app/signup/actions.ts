"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formString, validateSignupInput } from "@/lib/auth/validation";
import { getSafeAuthReturnPath } from "@/lib/auth/return-path";

export type SignupState = {
  error?: string;
  message?: string;
};

function getEmailCallbackUrl(nextPath?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured for email confirmation.");
  }
  const siteUrl = new URL(configuredUrl ?? "http://localhost:3000");
  if (
    (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") ||
    siteUrl.username ||
    siteUrl.password
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid HTTP(S) URL.");
  }
  const callbackUrl = new URL("/auth/callback", siteUrl);
  if (nextPath) callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

export async function signUp(
  _previousState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = formString(formData, "email").trim().toLowerCase();
  const password = formString(formData, "password");
  const nextPath = getSafeAuthReturnPath(formString(formData, "nextPath"));
  const validationError = validateSignupInput({ email, password });
  if (validationError) {
    return { error: validationError };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  let session = false;
  try {
    supabase = await createSupabaseServerClient({ writeCookies: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getEmailCallbackUrl(nextPath) },
    });

    if (error) {
      console.error("Khayee signup failed", error);
      return {
        error:
          "We could not create the account. The email may already be registered; try signing in or use another address.",
      };
    }
    session = data.session !== null;
  } catch (error) {
    console.error("Khayee signup request failed", error);
    return { error: "Signup is temporarily unavailable. Please try again." };
  }

  if (session) {
    let provisioningFailed = false;
    try {
      const { error: provisioningError } = await supabase.rpc("ensure_customer_profile");
      if (provisioningError) {
        console.error("Khayee signup profile provisioning failed", provisioningError);
        provisioningFailed = true;
      }
    } catch (error) {
      console.error("Khayee signup profile provisioning failed", error);
      provisioningFailed = true;
    }

    if (provisioningFailed) {
      let signOutFailed = false;
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error("Khayee signup cleanup failed", signOutError);
          signOutFailed = true;
        }
      } catch (signOutError) {
        console.error("Khayee signup cleanup failed", signOutError);
        signOutFailed = true;
      }

      if (signOutFailed) redirect("/signup?confirmation=setup-failed");
      return {
        error:
          "Your account was created, but profile setup could not be completed. Do not register again; please try signing in later or contact support.",
      };
    }
  }
  if (session) redirect(nextPath ?? "/");
  return {
    message:
      "If registration was accepted, check your inbox for a confirmation link. If you already have an account, sign in instead.",
  };
}
