"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSafeAuthReturnPath } from "@/lib/auth/return-path";

export type LoginState = {
  error?: string;
};

async function clearFailedLoginSession(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Khayee login cleanup failed", error);
  } catch (error) {
    console.error("Khayee login cleanup failed", error);
  }
}

export async function signIn(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    typeof password !== "string" ||
    password.length === 0
  ) {
    return { error: "Enter a valid email address and password." };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient({ writeCookies: true });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { error: "We could not sign you in with those credentials." };
    }
  } catch (error) {
    console.error("Khayee login failed", error);
    return { error: "Sign in is temporarily unavailable. Please try again." };
  }

  try {
    const { error } = await supabase.rpc("ensure_customer_profile");
    if (error) {
      console.error("Khayee login profile provisioning failed", error);
      await clearFailedLoginSession(supabase);
      return {
        error:
          "We could not finish setting up your account. Please try again later.",
      };
    }
  } catch (error) {
    console.error("Khayee login profile provisioning failed", error);
    await clearFailedLoginSession(supabase);
    return {
      error: "We could not finish setting up your account. Please try again later.",
    };
  }

  const nextPath = formData.get("nextPath");
  const safeNextPath = getSafeAuthReturnPath(typeof nextPath === "string" ? nextPath : undefined);
  if (safeNextPath) redirect(safeNextPath);
  redirect("/");
}
