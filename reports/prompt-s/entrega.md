# Prompt S — resultado y límites

## Resultado del cambio

Se sustituyeron **6 copias completas** del predicado de documento contabilizado: cinco en `getSalesSummary` y una en `getSessionMargin`, todas en `artifacts/api-server/src/lib/admin-analytics.ts`. Las llamadas al helper pasaron de **16 a 22**. El cambio de SQL contiene únicamente esas sustituciones: 6 líneas añadidas y 14 retiradas.

No se cambió la definición de `accountedDocumentPredicate`, `destinationReadModel`, FIFO, proyección de crédito, atribución de sitio ni ninguna variante parcial. No hizo falta ampliar los alias admitidos. El conteo inicial correcto era seis, no ocho; `replit.md` ya había corregido el antiguo conteo de dos antes de esta sesión.

**El cambio está realizado, pero no se declara toda la regresión en verde:** existen cinco fallos que se reprodujeron idénticos en la versión anterior y la actual.

## Evidencia ejecutada

| Comprobación | Resultado |
|---|---|
| Inventario antes de modificar | 6 copias, alias `f` y `t`; variantes diferentes documentadas y conservadas |
| Paridad con datos reales | Una misma transacción `REPEATABLE READ READ ONLY` y un mismo cliente PostgreSQL para anterior/actual: 8 pares de resumen, más margen de una sesión real; comparación de todos los campos, sin exclusiones ni diferencias |
| Casos positivos y límites | SQL real de ambas versiones sobre CTE `VALUES`, sin crear tablas: TICKET cobrado, NOTA autorizada, pendientes, cancelado, booleano nulo, cero y costo ausente; igualdad |
| Cobranza de Tiempo real frente a Cuentas Destino | Se comprobó el contrato de los dos consumidores del mismo hook/respuesta canónica y el total de cobranza, no se confundió con la tarjeta Contado cobrado |
| Diferencia entre cobranza y contado | En la consulta suplementaria: cobranza total **$18,000 = $0 contado + $16,000 abonos + $2,000 saldo a favor**; no se reutilizó otro snapshot para esta igualdad |
| Tarjeta/detalle en varias páginas | Consultas reales sobre CTE de solo lectura: **3 filas / $180**, recorridas con tamaño de página 1 (3 páginas) y 2 (2 páginas), con conteos e importes conciliados |
| Ventas = Contado cobrado + Ventas a crédito | Identidad verificada en los alcances y periodos consultados; el snapshot principal global dio **$16,000 = $0 + $16,000** |
| Regresión existente antes/después | Mismo manifiesto explícito de 28 archivos de API/frontend: **215 pruebas, 210 aprobadas y 5 fallidas en cada versión** |
| Guardia nueva | **3/3**; busca en 732 archivos fuente, incluidos los 16 `.mts` mantenidos |
| Prueba negativa real | Copia introducida en un `.mts` de un árbol temporal: el proceso real de prueba terminó con **exit 1**; retirada la copia, terminó con **exit 0** |
| Typecheck completo | `pnpm run typecheck`: todos los proyectos seleccionados terminados, 0 diagnósticos únicos y 0 fallos de proceso/parser |
| Último ajuste de guardia | Después de ampliar extensiones/registro de pruebas, `pnpm --filter @workspace/api-server run typecheck` aprobó nuevamente; los demás proyectos no cambiaron |
| Codegen | `pnpm --filter @workspace/api-spec run codegen` terminó con exit 0, sin diferencias en contratos ni archivos generados |
| Diff | `git diff --check` sin errores; ningún cambio de pantalla o estilo |

Los ejemplos monetarios pertenecen a comprobaciones distintas, identificadas en la evidencia; no se mezclan snapshots mientras otros usuarios operan.

## Guardia que permanece

Archivo: `artifacts/api-server/src/lib/accounted-document-source-guard.contract.ts`.

Recorre las fuentes de `artifacts`, `lib` y `scripts`, incluyendo `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` y `.sql`. Detecta el predicado completo con el mismo alias, booleano implícito o `=true`, diferencias de espacios, saltos de línea, separación alrededor del punto y mayúsculas de palabras SQL. No confunde las variantes parciales con copias completas.

No excluye directorios de fixtures. Conserva las exclusiones de dependencias y material generado/no fuente; el único módulo canónico exento es `accounted-document.ts`. Las pruebas permanecen dentro del barrido y construyen sus ejemplos por partes para no introducir una copia literal en el repositorio.

Se ejecuta con `pnpm --filter @workspace/api-server run test:accounted-document-source` y está incorporada al comando existente `test:admin-analytics`. La inyección negativa se hizo fuera de módulos vigilados; no se expuso una copia temporal en la aplicación.

## Cinco fallos anteriores, no corregidos

1. `artifacts/api-server/src/pos-caja-final.contract.test.ts`: espera el fragmento de interfaz `/Ticket"} folio/`.
2. Mismo archivo: espera `/projectCreditLedger\(ledger\)/`.
3. `artifacts/mariana-textil/src/pages/caja/tiempo-real-breakdown.contract.test.ts`: expectativa anterior de cantidad/composición de tarjetas.
4. `artifacts/mariana-textil/src/pages/caja/tiempo-real.contract.test.ts`: expectativa anterior de composición.
5. `artifacts/mariana-textil/src/pages/detail-link-tables.contract.test.ts`: espera `/href=\{row\.referenciaRolloRuta\}/`.

Se verificó su presencia antes de modificar. No se debilitaron ni ajustaron aserciones para conseguir un resultado verde. Requieren revisar las expectativas frente a las decisiones vigentes; no se presupone que todo fallo se resuelva cambiando la prueba.

Las suites de integración que crean bases, fixtures, usuarios o sesiones quedaron excluidas por la prohibición de escrituras. Se enumeran en el informe de regresión. Por tanto, **no se afirma que todas las pruebas existentes del proyecto hayan pasado**.

## Restricciones preservadas

- No se escribieron datos ni se ejecutaron migraciones, inicializadores, usuarios o sesiones de prueba.
- No se iniciaron ni reiniciaron workflows ni se activó una API para esta entrega. La verificación ejecutó módulos de lectura aislados, no endpoints autenticados.
- No se hizo comprobación de navegador ni se afirma que el código esté activado en el proceso que atiende a usuarios.
- El Grupo 1 del Prompt P sigue sin cerrar; los grupos 2–4 siguen detenidos.
- Las variantes parciales permanecen reportadas, no unificadas. El diseño de atribución del Prompt Q no se implementó.

## Informes de respaldo

- `inventario.md`: ubicaciones y diferencias previas.
- `mechanical-and-tests.md`: manifiesto, conteos antes/después y fallos; guardia con fallo y recuperación reales.
- `verification-final.md` y `verification-final.json`: comparaciones SQL y comprobaciones suplementarias, con límites de cada snapshot.
- `verification-prechange.md` y `verification-prechange.json`: preparación anterior; no sustituyen la comprobación final contra el archivo modificado.