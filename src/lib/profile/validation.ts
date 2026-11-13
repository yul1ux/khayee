export type CustomerProfileInput = {
  displayName: string;
  phoneNumber: string;
  bio: string;
};

export function validateCustomerProfile(input: CustomerProfileInput): string | null {
  if (!input.displayName.trim() || input.displayName.trim().length > 120) {
    return "Enter a display name between 1 and 120 characters.";
  }
  if (input.phoneNumber.length > 40) {
    return "Phone number must be 40 characters or fewer.";
  }
  if (input.bio.length > 2000) {
    return "Bio must be 2,000 characters or fewer.";
  }
  return null;
}
