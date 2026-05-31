import { scanForbiddenKeywords } from "./forbiddenKeywords.js";

export type ValidatedActionNarration = {
  narration: string;
  fallbackUsed: boolean;
};

// Validation constraints
// MIN: Ensure narration is not just a few characters
// MAX: Prevent excessively long responses that could indicate LLM failure
const MIN_NARRATION_LENGTH = 10;
const MAX_NARRATION_LENGTH = 500;

/**
 * Validates and sanitizes LLM-generated action narration.
 * Returns fallback narration if validation fails.
 */
export function validateActionNarration(
  raw: string,
  fallbackNarration: string
): ValidatedActionNarration {
  if (!raw || typeof raw !== "string") {
    return {
      narration: fallbackNarration,
      fallbackUsed: true
    };
  }

  const trimmed = raw.trim();

  // Check length constraints
  if (trimmed.length < MIN_NARRATION_LENGTH || trimmed.length > MAX_NARRATION_LENGTH) {
    return {
      narration: fallbackNarration,
      fallbackUsed: true
    };
  }

  // Scan for forbidden keywords
  const { hits } = scanForbiddenKeywords(trimmed);
  if (hits.length > 0) {
    return {
      narration: fallbackNarration,
      fallbackUsed: true
    };
  }

  // Remove any JSON-like artifacts
  let cleaned = trimmed;
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    return {
      narration: fallbackNarration,
      fallbackUsed: true
    };
  }

  // Remove common LLM wrapper patterns
  cleaned = cleaned.replace(/^["']|["']$/g, "");
  cleaned = cleaned.trim();

  return {
    narration: cleaned,
    fallbackUsed: false
  };
}
