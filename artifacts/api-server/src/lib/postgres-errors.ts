const MAX_POSTGRES_CAUSE_DEPTH = 8;

export function isPostgresUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  const visited = new Set<object>();
  let current = error;

  for (
    let depth = 0;
    depth < MAX_POSTGRES_CAUSE_DEPTH &&
    current !== null &&
    typeof current === "object";
    depth += 1
  ) {
    if (visited.has(current)) return false;
    visited.add(current);

    const postgresError = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (
      postgresError.code === "23505" &&
      (constraint === undefined || postgresError.constraint === constraint)
    ) {
      return true;
    }
    current = postgresError.cause;
  }

  return false;
}