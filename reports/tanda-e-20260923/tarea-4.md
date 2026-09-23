# Tanda E · tarea 4 · color semántico

Implementación posterior a la tarea 3, sin cambios de gates, permisos, reglas de negocio, API o datos.

## Fuentes exactas

- `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx:379-392`: el encabezado ordinario dejó de usar azul decorativo; formulario/vista previa son neutros y verde identifica únicamente un abono confirmado.
- `artifacts/mariana-textil/src/components/cliente-pago-dialog.tsx:521-672`: comentarios locales fijan ámbar como pendiente/no confirmado y verde como liquidación, saldo a favor, excedente o éxito según el texto contiguo. Los importes aplicados de `542` y `588` dejaron de usar `text-primary` decorativo. Azul primario se conserva solo para el folio navegable y se documenta en `534`.
- `artifacts/mariana-textil/src/components/cliente-e3-recaptura-dialog.tsx:183-326`: rojo destructivo queda reservado para errores de validación; la advertencia de constancia histórica cambió a ámbar (`324-328`). El folio navegable azul quedó documentado en `315`.
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-panel.tsx:183`: se retiró el borde ámbar permanente y decorativo del módulo.
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-panel.tsx:245-249`: ámbar documentado exclusivamente como desbloqueo extraordinario por insuficiencia.
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-item.tsx:162-179`: mapa escrito junto al código: ámbar pendiente, rojo reclamada, azul respondida, verde aceptada; estados no aplicables/desconocidos quedan neutros.
- `artifacts/mariana-textil/src/components/salidas-dinero-e4-item.tsx:202-259`: azul subrayado documentado como navegación, ámbar como evidencia de desbloqueo excepcional y colores de acciones como anticipo del estado resultante.
- `artifacts/mariana-textil/src/components/e7-readers.tsx:75-84,117-140`: azul primario subrayado documentado como navegación/expansión, nunca estado financiero; ámbar documentado como retenido con antigüedad de tres días o más que requiere atención ADMIN.
- `artifacts/mariana-textil/src/components/e9-entregas-panel.tsx:48-49`: rojo reservado para errores y azul subrayado para navegación; los estados de negocio E9 permanecen textuales.
- `artifacts/mariana-textil/src/components/e9-envio-panel.tsx:81`: misma semántica explícita para errores y enlace al corte.
- `artifacts/mariana-textil/src/pages/ticket-detail.tsx:393-394`: ámbar documentado como señal histórica de venta con rollos de remate, no error ni estado activo actual del rollo.

`artifacts/mariana-textil/src/components/tarea4-remate.tsx` y `rollo-remate-panel.tsx` no seleccionan colores explícitos; se conservaron así para no agregar decoración.

## Comprobaciones

- `pnpm --filter @workspace/mariana-textil run typecheck`: PASS, cero diagnósticos.
- `git diff --check` sobre las ocho fuentes modificadas: PASS.
- Enfoque E3: las 6 pruebas de `e3-ui.observable.test.ts` pasaron.
- El intento conjunto de las pruebas DOM E4/E7/E9 no llegó a ejecutar sus aserciones: el runner Node rechazó la importación existente de `src/assets/mariana-textil-logo.png` con `ERR_UNKNOWN_FILE_EXTENSION`. Se registra como fallo de infraestructura del runner, no como verde ni como fallo semántico de estas modificaciones.

No se usó navegador ni tester y no se creó commit.