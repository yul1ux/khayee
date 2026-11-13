import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";

type AdminAccessResult =
  | { user: User; error?: never }
  | { user?: never; error: string };

export async function checkAdminAccess(
  supabase: SupabaseClient,
): Promise<AdminAccessResult> {
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) {
    if (isUnauthenticatedSessionError(authError)) {
      return { error: "Sign in with an administrator account to continue." };
    }
    console.error("Could not verify administrator session", authError);
    return { error: "We could not verify your account. Please try again." };
  }
  if (!data.user) {
    return { error: "Sign in with an administrator account to continue." };
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (roleError) {
    console.error("Could not load administrator permissions", roleError);
    return { error: "We could not verify your permissions. Please try again." };
  }
  if (!(roles ?? []).some(({ role }) => role === "admin")) {
    return { error: "Administrator access is required." };
  }
  return { user: data.user };
}

export async function requireAdminAccess(
  supabase: SupabaseClient,
  returnPath = "/admin",
) {
  const result = await checkAdminAccess(supabase);
  if (!result.user) {
    if (result.error.startsWith("Sign in")) {
      redirect(`/login?next=${encodeURIComponent(returnPath)}`);
    }
    redirect("/");
  }
  return result.user;
}
