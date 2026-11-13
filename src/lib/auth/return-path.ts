const TRIP_PATH_PATTERN =
  /^\/trips\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORGANIZER_PATH_PATTERN =
  /^\/organizer\/(?:onboarding|trips(?:\/(?:new|requests|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/(?:edit|images))?))?)$/i;

export function getSafeAuthReturnPath(value: string | undefined) {
  if (
    value === "/account/requests" ||
    value === "/account/profile" ||
    value === "/account/reports" ||
    value === "/notifications" ||
    value === "/admin" ||
    (value && (TRIP_PATH_PATTERN.test(value) || ORGANIZER_PATH_PATTERN.test(value)))
  ) {
    return value;
  }
  return undefined;
}
