const MAX_POSTGRES_CAUSE_DEPTH = 8;

type ErrorWithPostgresDiagnostics = {
  cause?: unknown;
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  code?: unknown;
  severity?: unknown;
  detail?: unknown;
  constraint?: unknown;
  column?: unknown;
  table?: unknown;
  schema?: unknown;
  where?: unknown;
  hint?: unknown;
};

function diagnosticString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function formatErrorWithCauses(error: unknown): string {
  const visited = new Set<object>();
  const sections: string[] = [];
  let current = error;

  for (let depth = 0; depth < MAX_POSTGRES_CAUSE_DEPTH; depth += 1) {
    if (current === null || typeof current !== "object") {
      sections.push(
        `${depth === 0 ? "Error" : `Cause ${depth}`}:\n${String(current)}`,
      );
      break;
    }
    if (visited.has(current)) {
      sections.push(`Cause ${depth}: [cycle detected]`);
      break;
    }
    visited.add(current);

    const item = current as ErrorWithPostgresDiagnostics;
    const message = diagnosticString(item.message);
    const stack = diagnosticString(item.stack);
    const name = diagnosticString(item.name);
    const body = stack ?? (message ? `${name ?? "Error"}: ${message}` : String(item));
    const postgresDiagnostics = [
      ["SQLSTATE", item.code],
      ["message", item.message],
      ["detail", item.detail],
      ["constraint", item.constraint],
      ["column", item.column],
      ["table", item.table],
      ["schema", item.schema],
      ["severity", item.severity],
      ["where", item.where],
      ["hint", item.hint],
    ]
      .map(([label, value]) => {
        const diagnostic = diagnosticString(value);
        return diagnostic ? `  ${label}: ${diagnostic}` : null;
      })
      .filter((line): line is string => line !== null);

    sections.push(
      `${depth === 0 ? "Error" : `Cause ${depth}`}:\n${body}${
        postgresDiagnostics.length > 0 && diagnosticString(item.code)
          ? `\nPostgreSQL diagnostics:\n${postgresDiagnostics.join("\n")}`
          : ""
      }`,
    );

    if (!("cause" in item) || item.cause === undefined) break;
    current = item.cause;
  }

  if (sections.length === 0) return "Error:\nUnknown error";
  return sections.join("\n");
}

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