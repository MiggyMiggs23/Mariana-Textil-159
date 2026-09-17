# Prompt G — revisión acotada del contrato

## Cambios exactos

- `lib/api-spec/openapi.yaml`: añadió únicamente `autorizacionEstado` opcional a `TicketDetalle`, con `NO_APLICA`, `PENDIENTE` y `AUTORIZADA`.
- Codegen regeneró los tipos Zod y React del contrato. `ObtenerTicketResponse` conserva el campo y `fechaVencimiento` continúa como `CalendarDate` (`YYYY-MM-DD`), no como `Date`.
- `artifacts/mariana-textil/src/pages/ticket-detail.tsx`: consume el campo tipado sin casts; conserva la insignia de documento y no cambia impresión, enlaces ni rutas.
- `artifacts/mariana-textil/src/lib/document-name.ts`: el tipo vacío usa `Documento`; el mapper de presentación solo transforma frases canónicas conocidas y conserva sin cambios cualquier mensaje de servidor desconocido.
- `artifacts/mariana-textil/src/lib/document-name.contract.test.ts`: fixture validado por `ObtenerTicketResponse.parse` para `AUTORIZADA` con `cobrado: false`, `PENDIENTE`, `NO_APLICA`, y regresión de mensajes desconocidos.
- `replit.md`: retiró el bloqueo contractual obsoleto y dejó `ACTIVATION pendiente`, sin afirmar una sesión autenticada de navegador. La evidencia previa permanece histórica; `after-evidence` no se actualizó.

No se añadieron consultas, lógica de negocio, códigos de error, cambios de DB, usuarios, sesiones, autenticación, insignias de deuda, markup de impresión, enlaces ni cambios al módulo de Caja. La API no se reinició.

## Comprobaciones

Todos los comandos se ejecutaron sin iniciar servicios:

- `pnpm --filter @workspace/api-spec run codegen`: PASS; una repetición con hash de salidas generadas dio `generated_outputs_stable=PASS`. Ver `codegen.log` y `codegen-stability.log`.
- Pruebas enfocadas frontend: 10 PASS (`document-name`, superficies Prompt G y contratos de salidas). Ver `test-focused-final.log`.
- Prueba enfocada API: 2 PASS (`ticket-credit-contract`). Ver `test-api-final.log`.
- Typecheck de paquetes: PASS en `@workspace/api-server` y `@workspace/mariana-textil`. Ver `typecheck-api-final.log` y `typecheck-mariana-final.log`.
- `pnpm run typecheck`: PASS; 7 librerías y 4 paquetes seleccionados, 0 diagnósticos. Ver `typecheck-root-final.log`.
- Build API: PASS. Ver `build-api-final.log`.
- Build frontend: PASS. Vite reportó únicamente advertencias existentes de sourcemap en componentes UI y tamaño de chunks. Ver `build-mariana-final.log`.

## Límite de evidencia

No se ejecutó un navegador autenticado ni se modificaron datos para crear una sesión o movimiento de prueba. La validación de activación y cualquier evidencia posterior en navegador queda para el agente principal.