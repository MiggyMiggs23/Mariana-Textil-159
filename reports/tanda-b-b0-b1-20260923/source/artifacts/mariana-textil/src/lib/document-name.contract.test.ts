import assert from "node:assert/strict";
import test from "node:test";
import { ObtenerTicketResponse } from "@workspace/api-zod";
import {
  documentoErrorMessage,
  documentoStatusPresentation,
  documentoTipoLabel,
} from "./document-name";

test("documentoTipoLabel centraliza los nombres visibles y conserva tipos desconocidos", () => {
  assert.equal(documentoTipoLabel("NOTA"), "Nota");
  assert.equal(documentoTipoLabel("TICKET"), "Ticket");
  assert.equal(documentoTipoLabel("ENTRADA"), "ENTRADA");
  assert.equal(documentoTipoLabel(""), "Documento");
  assert.equal(documentoTipoLabel(null), "Documento");
  assert.equal(documentoTipoLabel(undefined), "Documento");
});

const ticketResponseFixture = {
  id: 9001,
  folio: 9001,
  ubicacionId: 1,
  nombreUbicacion: "Centro",
  usuarioTerminalId: 1,
  nombreUsuarioTerminal: "Caja",
  clienteId: 2,
  nombreCliente: "Cliente de prueba",
  notaSinPrecios: false,
  subtotal: "100.00",
  iva: "0.00",
  tasaIva: "0.1600",
  total: "100.00",
  estado: "VENDIDO",
  cobrado: false,
  facturado: false,
  documentoTipo: "NOTA",
  autorizacionEstado: "AUTORIZADA",
  convertidoANotaPorCobro: false,
  uuidCliente: "c73e8cb1-e95d-4ff0-92f9-d75c87b79be6",
  createdAt: "2026-09-17T12:00:00.000Z",
  canceladoAt: null,
  canceladoPor: null,
  nombreUsuarioCancelacion: null,
  motivoCancelacion: null,
  autorizadoPor: null,
  nombreUsuarioAutorizacion: null,
  lineas: [],
  esCredito: true,
  importeCredito: "100.00",
  diasPlazo: 15,
  fechaVencimiento: "2026-10-02",
  saldoPendiente: "100.00",
  estadoNota: "PENDIENTE",
  telefonoCliente: null,
  correoCliente: null,
  direccionCliente: null,
};

test("la insignia usa autorizacionEstado de la respuesta real parseada", () => {
  const autorizada = ObtenerTicketResponse.parse(ticketResponseFixture);
  assert.equal(autorizada.autorizacionEstado, "AUTORIZADA");
  assert.equal(
    documentoStatusPresentation(autorizada).label,
    "Nota autorizada",
  );

  const pendiente = ObtenerTicketResponse.parse({
    ...ticketResponseFixture,
    autorizacionEstado: "PENDIENTE",
  });
  assert.equal(pendiente.autorizacionEstado, "PENDIENTE");
  assert.equal(
    documentoStatusPresentation(pendiente).label,
    "Nota por autorizar",
  );

  const sinConfirmar = ObtenerTicketResponse.parse({
    ...ticketResponseFixture,
    autorizacionEstado: "NO_APLICA",
  });
  assert.equal(
    documentoStatusPresentation(sinConfirmar).label,
    "Nota: autorización sin confirmar",
  );
});

test("los errores canónicos cambian solo el nombre del documento y los demás se conservan", () => {
  assert.equal(
    documentoErrorMessage({ data: { error: "No se puede cobrar un ticket cancelado." } }, "NOTA"),
    "Nota: no se puede autorizar un documento cancelado.",
  );
  assert.equal(
    documentoErrorMessage({ data: { error: "El ticket ya fue cobrado." } }, "NOTA"),
    "Nota: el documento ya fue procesado en Caja.",
  );
  for (const tipo of ["NOTA", "TICKET", undefined]) {
    assert.equal(
      documentoErrorMessage(
        { data: { error: "No tienes permiso para consultar este ticket." } },
        tipo,
      ),
      `${documentoTipoLabel(tipo)}: no tienes permiso para consultar este documento.`,
    );
  }
  assert.equal(
    documentoErrorMessage(
      { data: { error: "Ticket no encontrado." } },
      "NOTA",
    ),
    "Nota no encontrada.",
  );
  assert.equal(
    documentoErrorMessage(
      { data: { error: "Causa específica del servidor." } },
      undefined,
    ),
    "Causa específica del servidor.",
  );
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