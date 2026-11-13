import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MarkAllReadForm,
  NotificationCenter,
  NotificationLoadError,
  type NotificationItem,
} from "@/components/notifications/notification-center";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/notifications/presentation";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";

export const instant = false;

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && !isUnauthenticatedSessionError(authError)) {
    console.error("Could not verify notification center session", authError);
    throw new Error("Could not verify your account.", { cause: authError });
  }
  if (!auth.user) redirect("/login?next=%2Fnotifications");

  const [notificationsResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, notification_type, title, body, trip_id, trip_request_id, read_at, created_at")
      .eq("recipient_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", auth.user.id)
      .is("read_at", null),
  ]);
  const error = notificationsResult.error ?? unreadResult.error;
  if (error) {
    console.error("Could not load notification center", error);
    return (
      <main className="page-shell min-h-[65vh] py-12 sm:py-16">
        <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/">
          Explore trips
        </Link>
        <h1 className="section-title mt-8 text-[#27382c]">Notifications</h1>
        <NotificationLoadError />
      </main>
    );
  }

  const notifications: NotificationItem[] = (notificationsResult.data ?? []).map((row) => ({
    id: row.id,
    type: row.notification_type as NotificationType,
    title: row.title,
    body: row.body,
    tripId: row.trip_id,
    tripRequestId: row.trip_request_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
  const unreadCount = unreadResult.count ?? 0;

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/">
        Explore trips
      </Link>
      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">Your account</p>
          <h1 className="section-title text-[#27382c]">Notifications</h1>
          <p className="mt-3 text-sm text-[#73776e]">
            {unreadCount} unread {unreadCount === 1 ? "update" : "updates"}
          </p>
        </div>
        {unreadCount > 0 ? <MarkAllReadForm /> : null}
      </div>
      <NotificationCenter notifications={notifications} />
      {notifications.length === 100 ? (
        <p className="mt-4 text-xs text-[#73776e]">Showing your 100 most recent notifications.</p>
      ) : null}
    </main>
  );
}
