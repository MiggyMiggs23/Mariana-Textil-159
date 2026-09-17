import assert from "node:assert/strict";
import test from "node:test";
import {
  documentoStatusPresentation,
  documentoTipoLabel,
} from "./document-name";

test("documentoTipoLabel centraliza los nombres visibles y conserva tipos desconocidos", () => {
  assert.equal(documentoTipoLabel("NOTA"), "Nota");
  assert.equal(documentoTipoLabel("TICKET"), "Ticket");
  assert.equal(documentoTipoLabel("ENTRADA"), "ENTRADA");
  assert.equal(documentoTipoLabel(""), "");
  assert.equal(documentoTipoLabel(null), "Documento");
  assert.equal(documentoTipoLabel(undefined), "Documento");
});

test("la insignia del documento separa procesamiento en Caja de estado de deuda", () => {
  assert.deepEqual(
    documentoStatusPresentation({
      documentoTipo: "NOTA",
      cobrado: false,
      autorizacionEstado: "AUTORIZADA",
    }),
    {
      label: "Nota autorizada",
      className: "bg-emerald-100 text-emerald-700",
    },
  );
  assert.deepEqual(
    documentoStatusPresentation({
      documentoTipo: "NOTA",
      cobrado: true,
      autorizacionEstado: undefined,
    }),
    {
      label: "Nota: autorización sin confirmar",
      className: "bg-primary/10 text-primary",
    },
  );
  assert.deepEqual(
    documentoStatusPresentation({
      documentoTipo: "TICKET",
      cobrado: false,
      autorizacionEstado: "AUTORIZADA",
    }),
    {
      label: "Ticket por cobrar",
      className: "bg-amber-100 text-amber-700",
    },
  );
});