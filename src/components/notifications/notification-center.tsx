"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationActionState,
} from "@/app/notifications/actions";
import {
  getNotificationLink,
  type NotificationType,
} from "@/lib/notifications/presentation";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  tripId: string | null;
  tripRequestId: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationLoadError() {
  return (
    <div className="mt-6 border border-[#e6c6bd] bg-[#fbf1ed] p-5" role="alert">
      <p className="font-semibold text-[#783d32]">Notifications couldn’t be loaded.</p>
      <p className="mt-1 text-sm text-[#783d32]">Please try again in a moment.</p>
      <Link className="mt-3 inline-block text-sm font-semibold underline" href="/notifications">Try again</Link>
    </div>
  );
}

export function MarkAllReadForm() {
  const [state, action, pending] = useActionState(markAllNotificationsRead, {});
  return (
    <form action={action} className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="border border-[#b8c2a8] px-4 py-2 text-sm font-semibold text-[#294a35] disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating…" : "Mark all as read"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function NotificationCenter({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  if (notifications.length === 0) {
    return (
      <p className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">
        You’re all caught up. New trip and account updates will appear here.
      </p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-[#e5e3db] border-y border-[#e5e3db]">
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </ul>
  );
}

function NotificationCard({ notification }: { notification: NotificationItem }) {
  const [state, action, pending] = useActionState(markNotificationRead, {});
  const link = getNotificationLink({
    type: notification.type,
    tripId: notification.tripId,
    tripRequestId: notification.tripRequestId,
  });

  return (
    <li className={`grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-start ${notification.readAt ? "bg-transparent" : "bg-[#f5f5ee]"}`}>
      <div className="min-w-0 px-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {!notification.readAt ? (
            <span className="size-2 rounded-full bg-[#52724a]" aria-label="Unread" />
          ) : null}
          <h2 className="font-semibold text-[#29382d]">{notification.title}</h2>
          {!notification.readAt ? (
            <span className="text-xs font-semibold uppercase tracking-wide text-[#52724a]">Unread</span>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#51564e]">{notification.body}</p>
        <p className="mt-2 text-xs text-[#73776e]">
          <time dateTime={notification.createdAt}>
            {new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Yangon",
            }).format(new Date(notification.createdAt))}
          </time>
        </p>
        <Link className="mt-3 inline-block text-sm font-semibold text-[#35503a] underline underline-offset-4" href={link.href}>
          {link.label}
        </Link>
        <ActionFeedback state={state} />
      </div>
      {!notification.readAt ? (
        <form action={action} className="px-4 sm:px-5">
          <input name="notificationId" type="hidden" value={notification.id} />
          <button
            className="text-sm font-semibold text-[#51564e] underline underline-offset-4 disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Updating…" : "Mark as read"}
          </button>
        </form>
      ) : null}
    </li>
  );
}

function ActionFeedback({ state }: { state: NotificationActionState }) {
  return (
    <>
      {state.error ? <p className="mt-2 text-sm font-medium text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="mt-2 text-sm font-medium text-[#31513b]" role="status">{state.message}</p> : null}
    </>
  );
}
