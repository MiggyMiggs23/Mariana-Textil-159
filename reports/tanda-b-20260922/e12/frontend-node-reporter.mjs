// Native Node test event stream, not log-word heuristics.
export default async function* reporter(events) {
  const tests = [];
  const diagnostics = [];
  for await (const event of events) {
    if (event.type === "test:pass" || event.type === "test:fail") {
      const d = event.data;
      const err = d.details?.error;
      tests.push({ name: d.name, status: event.type === "test:pass" ? "passed" : "failed",
        skipped: !!d.skip, code: err?.code, message: err?.message,
        failureType: err?.failureType, causeCode: err?.cause?.code, causeMessage: err?.cause?.message });
    }
    if (event.type === "test:diagnostic") diagnostics.push(event.data.message);
  }
  yield JSON.stringify({ tests, diagnostics }, null, 2);
}