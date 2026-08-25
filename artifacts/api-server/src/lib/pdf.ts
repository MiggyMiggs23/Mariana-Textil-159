function pdfText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

/** Small dependency-free, valid multi-page PDF for tabular financial exports. */
export function createTextPdf(title: string, lines: string[]): Buffer {
  const pageSize = 55;
  const chunks =
    lines.length === 0
      ? [[]]
      : Array.from(
          { length: Math.ceil(lines.length / pageSize) },
          (_, index) => lines.slice(index * pageSize, (index + 1) * pageSize),
        );
  const pageIds = chunks.map((_, index) => 4 + index * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  chunks.forEach((chunk, index) => {
    const pageId = pageIds[index]!;
    const contentId = pageId + 1;
    const visible = [
      title,
      `Pagina ${index + 1} de ${chunks.length}`,
      ...chunk,
    ];
    const content = [
      "BT",
      "/F1 9 Tf",
      "36 806 Td",
      "11 TL",
      ...visible.flatMap((line) => [`(${pdfText(line)}) Tj`, "T*"]),
      "ET",
    ].join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "ascii");
}