// Fixture construction only, not node:test. Bundled against real backend serializers.
import fs from "node:fs";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { e7AttributionPdf, e7AttributionWorkbook } from "../../artifacts/api-server/src/lib/e7-export";
import { GetE7AtribucionResponse } from "../../lib/api-zod/src/generated/api";
import { afterApplication, applicationSite } from "./frontend-fixtures";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const need = (ok, message) => { if (!ok) throw Error(`E7_DOCUMENT_FIXTURE ${message}`); };
const documents = {};
for (const [scope, projection] of Object.entries({ global: afterApplication, site2: applicationSite })) {
  GetE7AtribucionResponse.parse(projection);
  const pdf = e7AttributionPdf(projection);
  const text = pdf.toString("latin1");
  need(text.startsWith("%PDF-1.4\n") && text.endsWith("%%EOF"), `${scope} PDF framing`);
  const offset = Number(text.match(/startxref\n(\d+)\n%%EOF$/)?.[1]);
  need(Number.isInteger(offset) && text.slice(offset).startsWith("xref\n"), `${scope} PDF xref`);
  const xlsx = Buffer.from(await e7AttributionWorkbook(projection).xlsx.writeBuffer());
  const reread = new ExcelJS.Workbook();
  await reread.xlsx.load(xlsx);
  const cells = [];
  reread.eachSheet(sheet => sheet.eachRow(row => cells.push(...row.values.slice(1).map(String))));
  for (const legend of projection.leyendas) {
    need(text.includes(legend), `${scope} PDF legend ${legend}`);
    need(cells.includes(legend), `${scope} XLSX legend ${legend}`);
  }
  need(reread.getWorksheet("Detalle autorizado").rowCount === projection.movimientos.length + 1, `${scope} XLSX movement count`);
  for (const row of projection.movimientos) {
    need(text.includes(row.id) && cells.includes(row.id), `${scope} real movement`);
  }
  if (scope === "site2") {
    for (const row of afterApplication.movimientos.filter(r => r.tipo === "RECEPCION")) {
      need(!text.includes(row.id) && !cells.includes(row.id), "foreign receipt absent from scoped binaries");
    }
  }
  documents[scope] = {
    pdf: { mime: "application/pdf", base64: pdf.toString("base64"), sha256: sha(pdf), bytes: pdf.length },
    xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: xlsx.toString("base64"), sha256: sha(xlsx), bytes: xlsx.length },
  };
}
fs.writeFileSync(process.argv[2], JSON.stringify({
  status: "REAL_BACKEND_SERIALIZER_SYNTHETIC_FIXTURES_NOT_UI_EXECUTION",
  serializer: "artifacts/api-server/src/lib/e7-export.ts",
  scopes: ["global", "site2"], documents, testsExecuted: 0,
}, null, 2), { flag: "wx" });