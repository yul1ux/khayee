export type TripDraftInput = {
  categoryId: string;
  destinationId: string;
  title: string;
  summary: string;
  description: string;
  difficulty: "easy" | "moderate" | "challenging";
  durationMinutes: number;
  startsAt: string;
  endsAt: string;
  departureLocation: string;
  capacity: number;
  priceMmk: number;
  safetyInformation: string;
  cancellationPolicy: string;
  emergencyContactInformation: string;
  includedServices: string[];
  excludedServices: string[];
  requiredEquipment: string[];
};

export function canEditOrganizerTrip(status: string) {
  return status === "draft" || status === "rejected";
}

export function myanmarDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const [year, month, day, hour, minute] = parts;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(localAsUtc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }
  return new Date(localAsUtc - 390 * 60_000).toISOString();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateTripDraft(input: TripDraftInput): string | null {
  if (!UUID_PATTERN.test(input.categoryId) || !UUID_PATTERN.test(input.destinationId)) {
    return "Choose an available trip category and destination.";
  }
  if (input.title.trim().length < 1 || input.title.length > 200) return "Trip title is required (200 characters maximum).";
  if (input.summary.trim().length < 1 || input.summary.length > 500) return "Trip summary is required (500 characters maximum).";
  if (!input.description.trim() || input.description.length > 20_000) return "Trip description is required and must be 20,000 characters or fewer.";
  if (!["easy", "moderate", "challenging"].includes(input.difficulty)) return "Choose a valid difficulty.";
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) return "Duration must be a positive number of minutes.";
  if (!Number.isInteger(input.capacity) || input.capacity < 1) return "Capacity must be a positive whole number.";
  if (!Number.isSafeInteger(input.priceMmk) || input.priceMmk < 0) return "Price must be a non-negative whole number of MMK.";
  if (!input.departureLocation.trim() || input.departureLocation.length > 500) return "Enter a departure location.";
  if (!input.safetyInformation.trim() || input.safetyInformation.length > 5000) return "Safety information is required and must be 5,000 characters or fewer.";
  if (!input.cancellationPolicy.trim() || input.cancellationPolicy.length > 5000) return "Cancellation policy is required and must be 5,000 characters or fewer.";
  if (input.emergencyContactInformation.length > 1000) return "Emergency contact information must be 1,000 characters or fewer.";
  if ([input.includedServices, input.excludedServices, input.requiredEquipment].some(
    (items) => items.length > 50 || items.some((item) => item.length > 250),
  )) {
    return "Each service or equipment list is limited to 50 entries of 250 characters each.";
  }
  const startsAt = myanmarDateTimeToIso(input.startsAt);
  const endsAt = myanmarDateTimeToIso(input.endsAt);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return "Choose valid dates with the trip end after the start.";
  }
  return null;
}

export function toPostgresTripInput(input: TripDraftInput) {
  const startsAt = myanmarDateTimeToIso(input.startsAt);
  const endsAt = myanmarDateTimeToIso(input.endsAt);
  if (!startsAt || !endsAt) {
    throw new Error("Trip dates must be valid Myanmar local datetimes.");
  }

  return {
    category_id: input.categoryId,
    destination_id: input.destinationId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    description: input.description.trim(),
    difficulty: input.difficulty,
    duration_minutes: input.durationMinutes,
    starts_at: startsAt,
    ends_at: endsAt,
    departure_location: input.departureLocation.trim(),
    capacity: input.capacity,
    price_mmk: input.priceMmk,
    safety_information: input.safetyInformation.trim(),
    cancellation_policy: input.cancellationPolicy.trim(),
    emergency_contact_information: input.emergencyContactInformation.trim() || null,
    included_services: input.includedServices,
    excluded_services: input.excludedServices,
    required_equipment: input.requiredEquipment,
  };
}
