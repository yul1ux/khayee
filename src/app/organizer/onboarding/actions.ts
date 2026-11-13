"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import {
  formString,
  validateOrganizerApplication,
  type OrganizerApplicationInput,
} from "@/lib/auth/validation";

export type OnboardingState = {
  error?: string;
  message?: string;
  application?: {
    profileId: string;
    displayName: string;
    bio: string;
    websiteUrl: string;
    status: "pending" | "verified" | "rejected";
    rejectionReason: string | null;
  };
};

function readInput(formData: FormData): OrganizerApplicationInput {
  return {
    displayName: formString(formData, "displayName").trim(),
    contactEmail: formString(formData, "contactEmail").trim().toLowerCase(),
    bio: formString(formData, "bio").trim() || null,
    websiteUrl: formString(formData, "websiteUrl").trim() || null,
  };
}

export async function submitOrganizerApplication(
  _previousState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const input = readInput(formData);
  const validationError = validateOrganizerApplication(input);
  if (validationError) return { error: validationError };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !isUnauthenticatedSessionError(userError)) {
    console.error("Could not verify organizer application session", userError);
    return { error: "We could not verify your account. Please sign in again." };
  }
  if (!userData.user) redirect("/login?next=%2Forganizer%2Fonboarding");

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (rolesError) {
    console.error("Could not load organizer application permissions", rolesError);
    return { error: "We could not verify your permissions. Please try again." };
  }
  const roleNames = (roles ?? []).map(({ role }) => role);
  if (roleNames.includes("admin")) {
    return { error: "Administrator accounts cannot submit organizer applications." };
  }

  const { data: existingDetails, error: detailsError } = await supabase
    .from("organizer_verification_details")
    .select("organizer_profile_id, verification_rejection_reason")
    .maybeSingle();
  if (detailsError) {
    console.error("Could not load organizer application", detailsError);
    return { error: "We could not load your organizer application. Please retry." };
  }

  let profile: {
    id: string;
    verification_status: "pending" | "verified" | "rejected";
  } | null = null;

  if (existingDetails) {
    if (!roleNames.includes("organizer")) {
      return { error: "Your organizer application needs support. Please contact us." };
    }

    const { data, error } = await supabase
      .from("organizer_profiles")
      .update({
        display_name: input.displayName,
        bio: input.bio,
        website_url: input.websiteUrl,
      })
      .eq("id", existingDetails.organizer_profile_id)
      .select("id, verification_status")
      .single();
    if (error) {
      console.error("Could not update organizer profile", error);
      return { error: "We could not save your organizer details. Please retry." };
    }
    profile = data;
  } else {
    if (roleNames.includes("organizer")) {
      return { error: "Your organizer profile is being set up. Refresh and try again." };
    }
    const { data, error } = await supabase
      .from("organizer_profiles")
      .insert({
        user_id: userData.user.id,
        display_name: input.displayName,
        bio: input.bio,
        website_url: input.websiteUrl,
      })
      .select("id, verification_status")
      .single();
    if (error) {
      console.error("Could not create organizer profile", error);
      return {
        error:
          "We could not submit your application. It may already exist; refresh the page and check its status.",
      };
    }
    profile = data;
  }

  const { error: contactError } = await supabase
    .from("organizer_verification_details")
    .update({ contact_email: input.contactEmail || null })
    .eq("organizer_profile_id", profile.id);
  if (contactError) {
    console.error("Could not save organizer contact email", contactError);
    return {
      error:
        "Your organizer profile was saved, but the contact email was not. Submit again to retry.",
    };
  }

  return {
    message:
      profile.verification_status === "pending"
        ? "Your application is awaiting administrator review. You can update your details while it is pending."
        : "Your organizer details were updated.",
    application: {
      profileId: profile.id,
      displayName: input.displayName,
      bio: input.bio ?? "",
      websiteUrl: input.websiteUrl ?? "",
      status: profile.verification_status,
      rejectionReason: existingDetails?.verification_rejection_reason ?? null,
    },
  };
}
