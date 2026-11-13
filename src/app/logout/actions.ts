"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LogoutState = {
  error?: string;
};

export async function signOut(): Promise<LogoutState> {
  try {
    const supabase = await createSupabaseServerClient({ writeCookies: true });
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Khayee logout failed", error);
      return { error: "We could not sign you out. Please try again." };
    }
  } catch (error) {
    console.error("Khayee logout failed", error);
    return { error: "We could not sign you out. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
