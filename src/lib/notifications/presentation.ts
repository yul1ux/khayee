export type NotificationType =
  | "trip_request_received"
  | "trip_request_accepted"
  | "trip_request_rejected"
  | "trip_approved"
  | "trip_rejected"
  | "trip_cancelled"
  | "trip_request_cancelled"
  | "organizer_verified"
  | "organizer_rejected"
  | "trip_request_submitted"
  | "organizer_application_submitted"
  | "trip_submitted"
  | "report_submitted"
  | "report_reviewed"
  | "report_dismissed";

type NotificationLinkInput = {
  type: NotificationType;
  tripId: string | null;
  tripRequestId: string | null;
};

export function getNotificationLink({
  type,
  tripId,
  tripRequestId,
}: NotificationLinkInput) {
  switch (type) {
    case "trip_request_received":
    case "trip_request_cancelled":
      return { href: "/organizer/trips/requests", label: "View trip requests" };
    case "trip_request_submitted":
    case "trip_request_accepted":
    case "trip_request_rejected":
      return { href: "/account/requests", label: "View my requests" };
    case "trip_approved":
    case "trip_rejected":
      return { href: "/organizer/trips", label: "View my trips" };
    case "organizer_verified":
    case "organizer_rejected":
      return { href: "/organizer/onboarding", label: "View application" };
    case "organizer_application_submitted":
      return { href: "/admin/organizers", label: "Review applications" };
    case "trip_submitted":
      return { href: "/admin/trips", label: "Review trips" };
    case "report_submitted":
      return { href: "/admin/reports", label: "Review reports" };
    case "report_reviewed":
    case "report_dismissed":
      return { href: "/account/reports", label: "View my reports" };
    case "trip_cancelled":
      return tripRequestId
        ? { href: "/account/requests", label: "View my requests" }
        : tripId
          ? { href: `/trips/${tripId}`, label: "View trip" }
          : { href: "/account/requests", label: "View my requests" };
  }
}
