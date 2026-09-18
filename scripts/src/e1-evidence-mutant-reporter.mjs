// Structured node:test events let the harness distinguish AssertionError from
// loader/compiler/network failures. This reporter contains no test assertions.
function errorDetails(error, depth = 0) {
  if (!error || depth > 5) return null;
  return {
    name: String(error.name ?? ""),
    code: String(error.code ?? ""),
    message: String(error.message ?? error),
    stack: String(error.stack ?? ""),
    failureType: error.failureType ?? null,
    cause: errorDetails(error.cause, depth + 1),
    errors: Array.isArray(error.errors)
      ? error.errors.map((nested) => errorDetails(nested, depth + 1)) : [],
  };
}

export default async function* evidenceMutantReporter(events) {
  for await (const event of events) {
    if (!["test:pass", "test:fail", "test:summary", "test:diagnostic"].includes(event.type)) continue;
    const data = event.data ?? {};
    yield `${JSON.stringify({
      type: event.type,
      name: data.name ?? null,
      skip: data.skip ?? false,
      nesting: data.nesting ?? null,
      message: data.message ?? null,
      details: {
        type: data.details?.type ?? null,
        error: errorDetails(data.details?.error),
      },
      counts: data.counts ?? null,
    })}\n`;
  }
}