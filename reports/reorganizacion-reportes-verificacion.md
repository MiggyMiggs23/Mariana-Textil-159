# Reorganización de Reportes: verificación bloqueada

Fecha: 2026-09-14.

## Estado

El mapa fue aprobado, incluida la retirada R01 y la conservación íntegra de X04 en Ventas → Comparar. Se escribió una implementación, pero **no cumple la verificación y no se entrega como terminada**.

La API de vista previa se detuvo al confirmar una regresión de autorización. El frontend permanece iniciado. No se publicaron cambios. No se aplicaron correcciones posteriores a los fallos encontrados: el propietario pidió reportarlos antes de corregirlos.

## Ajustes autorizados

- No implementar la tasa de cancelación en esta entrega.
- Su definición futura es cancelados del periodo / (contabilizados + cancelados del periodo) × 100. Cancelados usa fecha de cancelación; contabilizados usa el predicado canónico, como Caja en Tiempo Real.
- Ventas V19/V20/V21 y Control deben compartir una fuente, no versiones paralelas.
- X04 conserva todas las columnas y Total General.
- Se retira únicamente la tarjeta Compras que duplicaba Costo recibido.

## Verificación solicitada, punto por punto

| Punto | Resultado | Evidencia / límite |
|---|---|---|
| 1. Typecheck completo | FALLÓ | API: pos.ts:426 y clientes.ts:1329, previos. La comprobación separada de frontend también encontró errores de tipos en Alertas/Cliente Detail y uno nuevo en Reportes: refetch no existe. |
| 1. Codegen sin diferencias | PASÓ | Codegen terminó correctamente; una segunda generación conservó exactamente los hashes de los archivos generados. |
| 2. Suites de reportes, analytics y permisos | PARCIAL | Selección segura: 119 pruebas aprobadas. Script de analytics: 33 aprobadas; existe solapamiento, no son 152 pruebas distintas. Conciliación SQL aislada autorizada: 1 prueba aprobada. |
| 2. Integraciones restantes | BLOQUEADAS | Suites de integración de reportes/analytics, permisos y admin bypass requieren INSERT/DELETE/usuarios/fixtures fuera de la población autorizada. No ejecutadas. |
| 3. Mapa contra implementación | FALLÓ | X04 y R01 se conservan según lo autorizado, pero faltan comparación real en las cinco, exportaciones compuestas y enlaces funcionales; caja aparece duplicada. |
| 4. Ninguna cifra cambia | NO ACREDITADO | Los errores de aplicación del sitio y el tratamiento de múltiples sitios pueden alterar el alcance. La prueba de Caja en Tiempo Real no acredita igualdad de los nuevos reportes. |
| 5. Cada señal cuenta y abre documento | FALLÓ / INCOMPLETO | Hay URLs sin ruta o parámetros no atendidos; falta validar los siete casos con documentos y fuentes reales. |
| 6. Bloques en cero visibles | NO ACREDITADO EN UI | Existen datos/estructuras para cero, pero la pantalla tiene una referencia inválida y no se completó una prueba funcional. |
| 7. Comparación en cinco y selector único | FALLÓ | Solo Ventas incorpora el Comparativo. Permanece otro selector Sitios; el encabezado no controla uniformemente todos los reportes. |
| 8. PROPIA y permisos | FALLÓ / NO ACREDITADO | Regresión de autorización en Control y problemas de alcance. Las pruebas sin base de datos aprobadas no acreditan acceso real PROPIA a las cinco pestañas. |
| 9. Cinco pestañas en teléfono | BLOQUEADO | Captura a 390 × 844 muestra login, sin sesión autenticada de prueba. No acredita ninguna de las cinco pestañas. No se crearon usuarios ni sesiones para sortearlo. |

## Fallos nuevos encontrados

### 1. Permisos y alcance — prioridad crítica

- Control reutiliza fuentes de analytics antes restringidas a ADMIN u otros roles financieros, pero su nuevo endpoint queda bajo reportes:ver sin conservar toda esa frontera.
- Varios sitios se convierten en filtro indefinido para las consultas de diferencias y cuentas destino, lo que puede devolver resultados globales.
- El selector del encabezado no se propaga de forma uniforme a las nuevas composiciones.

### 2. Reportes no compila

`artifacts/mariana-textil/src/pages/reportes.tsx:249` conserva `onRefresh={refetch}` tras eliminar esa variable. Es un fallo de esta implementación.

### 3. Los enlaces no cumplen el acceso al documento

- Backend/frontend/OpenAPI no comparten un contrato de enlace consistente.
- El frontend busca sufijos Url/Enlace, mientras el backend entrega campos Href.
- Hay una ruta de etiquetas inexistente y enlaces con sesionId/movimientoId que sus pantallas de destino no procesan.
- Una URL impresa como texto o un listado general no cumple el requisito.

### 4. Comparación, periodos y duplicación de caja

- La comparación no está implementada funcionalmente en las cinco pestañas.
- Continúa el selector Sitios adicional.
- Caja Diferencias y su versión genérica se duplican, con controles y periodos no sincronizados.

### 5. Exportaciones y accesos anteriores

- La exportación de una pestaña compuesta llama solo a una sección; omite secciones recibidas.
- Accesos anteriores a Pagos Dirigidos/Diferencias terminan en Ventas al usar identificadores antiguos que ya no son pestañas válidas.

## Lo que sí se constató

- R01 se retiró y Costo recibido permanece.
- X04 mantiene las doce columnas y Total General.
- No se añadió una tasa de cancelación.
- Ventas y Control invocan un cargador común de cancelaciones.
- Las pruebas nuevas de esa reutilización incluyen aserciones sobre código y agregación; **todavía no demuestran equivalencia completa de ambos consumidores con filtros y permisos reales**.
- Los servicios arrancaron antes de detener la API por seguridad. Arrancar no equivale a aprobar la funcionalidad.

## Diferencia previa de cancelaciones, sin corregir

Caja en Tiempo Real ya coincide con la fórmula futura aprobada y usa fecha de cancelación. Ventas filtra actualmente sus cancelaciones por fecha de cobro/autorización. Se preservó ese criterio existente al extraer la fuente compartida; no se normalizó contra Caja.

Por tanto, esta reorganización no elimina esa diferencia histórica entre Ventas y Caja. No debe introducirse una tasa de Reportes sin resolver explícitamente ese alcance.

## Comandos y evidencia

- `pnpm run typecheck` — salida 2; `/tmp/report-reorg-typecheck.log`.
- `pnpm --filter @workspace/mariana-textil run typecheck` — salida 2; `/tmp/report-reorg-frontend-typecheck.log`.
- `pnpm --filter @workspace/api-spec run codegen` — salida 0; `/tmp/report-reorg-codegen.log`.
- Segunda generación y comparación SHA-256 — sin diferencias; `/tmp/report-reorg-codegen-repro.log`.
- Selección segura reportes/analytics/permisos — 119/119; `/tmp/verification-reportes-analytics-permissions-20260914.log`.
- `pnpm --filter @workspace/api-server run test:admin-analytics` — 33/33; `/tmp/verification-admin-analytics-script-20260914.log`.
- `pnpm test:isolated --suite api-script:test:admin-realtime-reconciliation` — 1/1; `/tmp/verification-admin-realtime-reconciliation-20260914.log`.

La integración autorizada usa PostgreSQL local desechable, esquema y seed autorizado, y filas virtuales limitadas a SELECTs. No se añadieron identidades reales ni fixtures persistidos adicionales. Las suites incompatibles no se ejecutaron.

**Pendiente de autorización para corregir los fallos encontrados y retomar la verificación.**