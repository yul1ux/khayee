import {
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

const invalidRefreshTokenCodes = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "refresh_token_expired",
  "session_expired",
]);

export function isUnauthenticatedSessionError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) {
    return true;
  }

  if (!isAuthApiError(error)) {
    return false;
  }

  return (
    (error.code !== undefined && invalidRefreshTokenCodes.has(error.code)) ||
    /^invalid refresh token(?::|$)/i.test(error.message) ||
    /^refresh token (?:is )?(?:not valid|expired)\.?$/i.test(error.message)
  );
}
