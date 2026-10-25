import { appError } from "./errors";

export const MAX_NAME_LENGTH = 100;

/** A person's display name, trimmed. Throws NAME_INVALID when empty or too long. */
export function cleanPersonName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) throw appError("NAME_INVALID");
  return trimmed;
}
