export const reportCategories = [
  "safety",
  "misleading_information",
  "harassment",
  "spam",
  "other",
] as const;

export type ReportCategory = (typeof reportCategories)[number];
export type ReportTargetType = "trip" | "organizer" | "customer";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReportCategory(value: string): value is ReportCategory {
  return reportCategories.includes(value as ReportCategory);
}

export function validateReportInput(input: {
  targetType: string;
  targetId: string;
  category: string;
  details: string;
  requestId?: string;
}) {
  if (!["trip", "organizer", "customer"].includes(input.targetType)) {
    return "Choose a valid report target.";
  }
  if (!UUID_PATTERN.test(input.targetId)) return "This report target is invalid.";
  if (!isReportCategory(input.category)) return "Choose a valid report reason.";
  if (input.details.length > 5000) return "Additional details must be 5,000 characters or fewer.";
  if (input.targetType === "customer" && (!input.requestId || !UUID_PATTERN.test(input.requestId))) {
    return "A valid trip request is required to report a customer.";
  }
  if (input.targetType !== "customer" && input.requestId) {
    return "This report is linked to an invalid trip request.";
  }
  return null;
}

export function getReportDetails(category: ReportCategory, description: string) {
  const trimmed = description.trim();
  return trimmed || `Report reason: ${category.replaceAll("_", " ")}.`;
}
