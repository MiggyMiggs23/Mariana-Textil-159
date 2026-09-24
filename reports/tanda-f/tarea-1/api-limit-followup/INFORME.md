# Tarea 1 — seguimiento API autenticada: límite global duro

**PASS.** Se ejecutó contra la API real ya iniciada por MAIN, `127.0.0.1:43831`, exclusivamente sobre `tanda_f_permissions` en el clúster privado PostgreSQL 55440. No se tocó `tanda_f_browser`, la base de aplicación ni el testigo. El cliente SQL de comprobación tuvo `default_transaction_read_only=on`; todas las mutaciones fueron solicitudes naturales autenticadas a la API.

## Procedimiento y resultado

1. Se verificó identidad de base/clúster y destino del proceso API antes de cualquier solicitud. Cliente sintético 8: límite $5,000, sin movimientos de crédito iniciales.
2. ADMIN creó cuatro notas válidas mediante `POST /api/tickets`, cada una de $1,500, 30 días, con un rollo real del fixture aislado. Todas respondieron **201**. Se crearon antes de autorizar para aislar específicamente el límite en autorización.
3. CAJA de cada tienda autorizó naturalmente las primeras tres mediante `POST /api/tickets/:id/autorizar`: **200** y `AUTORIZADA`.

| Nota ID | Sitio | Importe | Movimiento crédito | Estado final |
|---|---|---|---|---|
| 109 | 836 | $1,500 | 55 | AUTORIZADA |
| 110 | 837 | $1,500 | 56 | AUTORIZADA |
| 111 | 838 | $1,500 | 57 | AUTORIZADA |
| 112 | 838 | $1,500 | Ninguno | PENDIENTE |

4. La proyección real devolvió deuda global actual **$4,500** y proyectada **$6,000**. En el sitio 838 había únicamente **$1,500** autorizados; incluso incluyendo la candidata, la deuda local sería **$3,000 < $5,000**.
5. CAJA3 envió directamente la autorización válida, sin depender del botón deshabilitado de UI:

```http
POST /api/tickets/112/autorizar
Content-Type: application/json
Cookie: [sesión autenticada no publicada]
```

```json
{
  "sitioOrigenId": 838,
  "naturaleza": "OPERACION_CREDITO_SIN_DINERO",
  "operacionClave": "d93e21ef-f30d-499c-8603-a43d8fd9ef11",
  "notaOrigenId": 112
}
```

Respuesta exacta: **HTTP 409**

```json
{"error":"El límite se rebasa por $1000.00. Un ADMIN debe subir el límite del cliente.","code":"CREDIT_LIMIT_EXCEEDED"}
```

## Invariantes comprobadas

- Nota 112 permanece `PENDIENTE`; exactamente tres ventas de crédito por $4,500.
- **106 tablas de negocio sin cambios** entre snapshots inmediatamente anterior y posterior al POST rechazado: conteo y digest MD5 del contenido completo de cada tabla, con orden canónico de hashes por fila.
- Incluye movimientos de crédito, movimientos de inventario, existencias, rollos, notas/autorizaciones, aplicaciones, operaciones de idempotencia, atribuciones, caja, clientes, permisos y auditoría.
- Se excluyó únicamente `sesiones`, por actividad de autenticación. No se afirma invariancia de secuencias PostgreSQL: una transacción rechazada puede consumir valores sin persistir filas.
- No hubo cambio de flags/gates, límite, permisos ni overrides; no se pasaron importes de favor manipulados ni credenciales de administrador al endpoint de autorización.
- Se conservaron fixtures y sesiones; no se hizo teardown. No volver a ejecutar el runner en esta misma base: exige ledger sintético inicial vacío.

## Evidencia e implementación consultada

- `identity.json`: identidad aislada y proceso/API.
- `http-exchanges.json`: solicitudes, estado HTTP, respuesta exacta en texto y JSON; sin cookies, contraseñas ni tokens.
- `notes.json`, `before-denial.json`, `after-denial.json`, `result.json`: IDs, ledger, estado y comparación completa.
- `probe.mjs`: runner ejecutado y aserciones; `node --check` y ejecución finalizaron satisfactoriamente.
- `artifacts/api-server/src/routes/pos.ts:812–832`: autorización dentro de `db.transaction`, evidencia validada y actor de sesión.
- `artifacts/api-server/src/lib/pos.ts:1998–2125`: autorización, ledger global por cliente y rechazo `CREDIT_LIMIT_EXCEEDED` al superar el límite tras proyección canónica.

Este seguimiento cubre el rechazo servidor que el informe anterior de Tarea 1 dejaba explícitamente fuera de su comprobación UI. No añade cobertura de concurrencia ni reemplaza las pruebas FIFO.