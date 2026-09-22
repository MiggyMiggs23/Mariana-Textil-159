# E3 — cierre de construcción apagada

## Revisión exacta

- Fuente implementada y verificada: **`c5e0ce90448530a82d9e3298972293890fedf95e`**.
- Base de comparación: `55ac9c70181a01e6b42c56a8beb334417f6512f0`.
- Este informe y la conservación de logs se agregan después, sin cambiar esa fuente.
- **No es liberación ni autorización de operación.** E3, su interfaz, catálogo de permisos y dirigido retenido permanecen cerrados.

## Terminado en fuente

1. Captura ordinaria desde Caja, sin pregunta de naturaleza: ingreso real actual, sesión abierta, selección operativa limitada, vista previa FIFO y confirmación con nueva validación. Anticipo sin deuda y exceso quedan como favor, no como dinero dirigido retenido.
2. Recaptura desde cliente: motivo obligatorio, fecha histórica explícita, corrección contable y ninguna asociación a Caja. Solo ADMIN puede capturarla. Se conserva la guarda E1 que impide a CONTADOR, SISTEMAS y BODEGA capturar recapturas; ningún permiso de matriz supera esa exclusión.
3. Reutilización del motor de crédito existente, bloqueo por cliente/operación, vista previa emitida y vinculada a actor/intención, vencimiento y rechazo de reparto obsoleto. Reintento con la misma clave y recuperación de confirmación incierta en la interfaz.
4. Recibo generado dentro de la confirmación, snapshot conservado y folio propio mediante contador por sitio (`E3-<sitio>-<consecutivo>`). UUID identifica la intención, no el folio del recibo. La transferencia conserva cuenta bancaria y sesión E1 nula; la sesión operativa del recibo no se suma al efectivo.
5. ADMIN consulta el recibo desde abono, estado de cuenta y corte. Dos copias A5 horizontales, paginación medida, datos humanos congelados, firmas y marca/fecha de reimpresión. Caja no imprime automáticamente ni ofrece impresión al cajero. La auditoría acredita solicitud, no impresión física.
6. Evidencia histórica insuficiente se rechaza expresamente; no se reconstruye con datos actuales. Si se libera E3, los endpoints legacy de captura se cierran para impedir eludir los flujos dedicados y su permiso de recaptura; OFF conserva su comportamiento anterior.
7. P6 preparada: sin ADMIN se exige importe exacto del saldo pendiente indicado. No se habilitó recepción dirigida retenida ni aplicación E5.
8. Decisión del propietario y sustitución de la pregunta de naturaleza registradas en `replit.md` y `reports/prompt-u-respuestas-2026-09-18.md`. El plan original permanece como antecedente.

## Evidencia y alcance real de las pruebas

- Backend: **14 pruebas nuevas**, 14 fallos identificados con mutantes aislados y 14 éxitos restaurados.
- Interfaz: **6 pruebas montadas nuevas**, seis mutantes específicos más un mutante adicional del catálogo OFF; todos fallaron por la aserción esperada. Las seis pruebas quedaron verdes restauradas.
- Regresiones existentes: 52 de backend y 10 de interfaz aprobadas.
- Codegen final, verificación de tipos de librerías/API/frontend y comprobación de diferencias: aprobadas.
- PDF aislado de 50 notas: 10 páginas reales para las dos copias, igualdad con la paginación del DOM, 100 renglones conservados, sin hojas vacías y con márgenes/firmas. MediaBox observado: 594.95996 × 420 pt. Esto **no sustituye** la prueba de la impresora del propietario.
- Las pruebas de interfaz montan componentes y handlers reales con transporte sustituido, sin consultar la API operativa. Las pruebas de dominio usan repositorio aislado, no PostgreSQL.
- Detalle y límites: [backend.md](backend.md), [frontend.md](frontend.md), [contrato-ui.md](contrato-ui.md), manifiestos SHA-256 y directorios `backend-tests/` y `frontend-tests/`.

## Resuelto por decisión del propietario

El conflicto de actores de recaptura quedó resuelto: la recaptura es exclusiva de ADMIN y se conserva la guarda E1. CONTADOR, SISTEMAS y BODEGA no pueden capturarla, aunque tengan otro permiso de matriz. SUPERVISOR, CAJA y TERMINAL tampoco quedan autorizados para recapturar por su autorización general como actores de crédito. No se cambió ni eludió la guarda.

## Detenido o pendiente

| Punto | Motivo y límite |
|---|---|
| Esquema y guardas SQL | Se prepararon instalación, reversión antes del primer recibo, retiro acotado del cierre de efectivo ordinario y restauración. **Ningún SQL fue ejecutado.** No retirar cierres permanentes, de devoluciones, atribuciones o retenidos. |
| Integración real PostgreSQL y concurrencia con cierre de Caja | No verificada: no se accedió a la base de la API ni se ejecutó el esquema. Los tests aislados no acreditan FK, triggers, privilegios ni la atomicidad real del adaptador. |
| Apertura E3 | Requiere autorización separada, resolver los impedimentos de E2 y validar el conjunto efectivo E1/E2/E3. El paquete E2 abortado no se reanudó ni modificó. |
| Dirigido retenido | Sigue dependiendo de E5/E7; no se ofrece como deuda pagada ni favor utilizable. |
| Impresora real | El propietario debe comprobar papel, corte, márgenes, firmas y legibilidad en su equipo. |

## Conservación operativa

No se accedió a la base de la API, no se ejecutó SQL contra ella, no se reinició la API y no se cambió su bundle retenido. Los inventarios SHA-256 inicial y final de los tres árboles protegidos resultaron idénticos, incluidos nombres y contenido:

- `reports/e2-paquete-liberacion-preparado-20260921/`
- `artifacts/api-server/dist-e2-20260927/`
- `artifacts/api-server/dist/`

Huella SHA-256 del inventario protegido inicial: `4eef29ad24640817ee7bacb2c3e6142924dae28198928528289250a5ee027874`.

No se realizó recorrido ni captura del preview operativo para no provocar acceso a la API/base. La comprobación visual y PDF se hizo exclusivamente en el navegador aislado de las pruebas.