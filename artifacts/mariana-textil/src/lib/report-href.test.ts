import assert from "node:assert/strict";
import test from "node:test";
import { getReportTableHref, isSafeInternalReportHref } from "./report-href";

test("report href validation permits only internal relative navigation", () => {
  assert.equal(isSafeInternalReportHref("/caja/cortes?sesionId=42"), true);
  assert.equal(isSafeInternalReportHref("javascript:alert(1)"), false);
  assert.equal(isSafeInternalReportHref("https://example.test"), false);
  assert.equal(isSafeInternalReportHref("//example.test/path"), false);
  assert.equal(isSafeInternalReportHref("/caja\\cortes"), false);
  assert.equal(isSafeInternalReportHref("/caja/cortes\u0000"), false);
});

test("report href selection prefers explicit hrefKey and supports safe legacy aliases", () => {
  assert.equal(
    getReportTableHref(
      {
        folio: "C-42",
        originPath: "/caja/cortes?sesionId=42",
        folioUrl: "https://example.test/unsafe",
      },
      { key: "folio", hrefKey: "originPath", kind: "link" },
    ),
    "/caja/cortes?sesionId=42",
  );
  assert.equal(
    getReportTableHref(
      { folio: "C-42", folioUrl: "/caja/cortes?sesionId=42" },
      { key: "folio", kind: "link" },
    ),
    "/caja/cortes?sesionId=42",
  );
  assert.equal(
    getReportTableHref(
      { folio: "https://example.test/unsafe" },
      { key: "folio", kind: "link" },
    ),
    null,
  );
});