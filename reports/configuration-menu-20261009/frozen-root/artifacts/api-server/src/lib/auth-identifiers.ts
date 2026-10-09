const INVISIBLE_IDENTIFIER_CHARACTERS =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

export function normalizeUsername(value: string): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE_IDENTIFIER_CHARACTERS, "")
    .trim()
    .toLowerCase();
}