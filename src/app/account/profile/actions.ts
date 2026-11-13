"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { validateCustomerProfile } from "@/lib/profile/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileState = {
  error?: string;
  message?: string;
};

export async function updateCustomerProfile(
  _previousState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const displayName = formData.get("displayName");
  const phoneNumber = formData.get("phoneNumber");
  const bio = formData.get("bio");
  if (
    typeof displayName !== "string" ||
    typeof phoneNumber !== "string" ||
    typeof bio !== "string"
  ) {
    return { error: "Enter valid profile details and try again." };
  }

  const profile = {
    displayName: displayName.trim(),
    phoneNumber: phoneNumber.trim(),
    bio: bio.trim(),
  };
  const validationError = validateCustomerProfile(profile);
  if (validationError) return { error: validationError };

  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try {
    supabase = await createSupabaseServerClient({ writeCookies: true });
  } catch (error) {
    console.error("Could not verify profile update session", error);
    return { error: "We could not verify your account. Please try again." };
  }

  let user: { id: string } | null;
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError && !isUnauthenticatedSessionError(authError)) {
      console.error("Could not verify profile update session", authError);
      return { error: "We could not verify your account. Please try again." };
    }
    user = auth.user;
  } catch (error) {
    console.error("Could not verify profile update session", error);
    return { error: "We could not verify your account. Please try again." };
  }
  if (!user) redirect("/login?next=%2Faccount%2Fprofile");

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.displayName,
        phone_number: profile.phoneNumber || null,
        bio: profile.bio || null,
      })
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (error) {
      console.error("Could not update customer profile", error);
      return { error: "We could not save your profile. Please try again." };
    }
    if (!data) {
      return { error: "Your profile could not be found. Please refresh and try again." };
    }

    revalidatePath("/account/profile");
    revalidatePath("/", "layout");
    return { message: "Your profile has been saved." };
  } catch (error) {
    console.error("Could not update customer profile", error);
    return { error: "We could not save your profile. Please try again." };
  }
}
