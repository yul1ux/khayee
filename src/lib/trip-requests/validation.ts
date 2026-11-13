const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTripRequestId(value: string) {
  return UUID_PATTERN.test(value);
}

export function validateTripRequest(
  tripId: string,
  partySize: number,
  message: string,
) {
  if (!isTripRequestId(tripId)) {
    return "This trip could not be found.";
  }
  if (!Number.isSafeInteger(partySize) || partySize < 1) {
    return "Choose a valid number of participants.";
  }
  if (message.length > 2000) {
    return "Your message must be 2,000 characters or fewer.";
  }
  return null;
}
