export type SignupInput = {
  email: string;
  password: string;
};

export type OrganizerApplicationInput = {
  displayName: string;
  contactEmail: string;
  bio: string | null;
  websiteUrl: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

export function validateSignupInput(
  input: SignupInput,
): string | null {
  const email = input.email.trim();
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }
  if (
    input.password.length < 8 ||
    input.password.length > MAX_PASSWORD_LENGTH
  ) {
    return "Use a password between 8 and 128 characters.";
  }
  return null;
}

export function validateOrganizerApplication(
  input: OrganizerApplicationInput,
): string | null {
  if (input.displayName.trim().length < 1 || input.displayName.trim().length > 160) {
    return "Enter a display name between 1 and 160 characters.";
  }
  if (input.bio && input.bio.length > 4000) {
    return "The bio must be 4,000 characters or fewer.";
  }
  if (input.contactEmail && (
    input.contactEmail.length > 320 ||
    !EMAIL_PATTERN.test(input.contactEmail)
  )) {
    return "Enter a valid contact email address.";
  }
  if (input.websiteUrl) {
    if (input.websiteUrl.length > 2048) {
      return "The website URL is too long.";
    }
    try {
      const url = new URL(input.websiteUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Use an HTTP or HTTPS website URL.";
      }
    } catch {
      return "Enter a valid website URL.";
    }
  }
  return null;
}

export function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
