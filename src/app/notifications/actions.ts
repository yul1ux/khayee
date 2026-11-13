"use server";

import { revalidatePath } from "next/cache";
import { formString } from "@/lib/auth/validation";
import { requireSignedInUser } from "@/lib/organizer/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationActionState = {
  error?: string;
  message?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markNotificationRead(
  _previousState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const notificationId = formString(formData, "notificationId");
  if (!UUID_PATTERN.test(notificationId)) {
    return { error: "This notification could not be found." };
  }

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Could not mark notification as read", error);
    return { error: "We could not update this notification. Please try again." };
  }
  if (!data) return { error: "This notification could not be found." };

  revalidatePath("/notifications");
  return { message: "Notification marked as read." };
}

export async function markAllNotificationsRead(
  _previousState: NotificationActionState,
  _formData: FormData,
): Promise<NotificationActionState> {
  void _previousState;
  void _formData;
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) {
    console.error("Could not mark all notifications as read", error);
    return { error: "We could not update your notifications. Please try again." };
  }

  revalidatePath("/notifications");
  return { message: "All notifications marked as read." };
}
