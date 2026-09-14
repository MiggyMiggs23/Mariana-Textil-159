# Abonos, estados, saldo a favor y contador de rollos

Fecha de ejecución: 14 de septiembre de 2026.

## Resultado: incompleto; detenido tras fallos

**Actualización del 2026-09-14, recuperación de acceso:** ante el reporte de imposibilidad de entrar, se corrigió exclusivamente el cierre de la llamada que impedía compilar la ruta de notificaciones. La API compiló y arrancó; el endpoint de login respondió con su validación habitual a una solicitud vacía, sin intentar autenticar a ningún usuario. No se cambiaron credenciales. Los resultados siguientes conservan la evidencia de la tanda original; los demás problemas financieros y verificaciones siguen pendientes.

No se presenta esta implementación como terminada. El propietario indicó que cualquier fallo de verificación debía reportarse sin corregirlo por iniciativa del agente. Se detuvieron las correcciones de código tras la tanda de verificaciones.

## Cambios realizados

- Contador circular grande, derivado de las series capturadas, en salida para venta a cliente.
- Rótulo “Abonos a notas” en Cuentas Destino.
- Función canónica de estado de nota y presentación de los cuatro estados.
- Saldo deudor y saldo a favor separados; presentación de excedentes y aplicación opcional al autorizar.
- Contratos de API regenerados, sin nuevas columnas ni migraciones.

## Diagnóstico del abono

Hay dos fuentes distintas llamadas Cobrado:

1. El tablero principal usa tickets/pagos de caja y no incorpora ABONO del ledger.
2. Cuentas Destino incorpora ABONO por fecha de recepción, pero su consulta exige cuenta destino no nula.

El estado de cuenta y la cartera no tienen ese filtro de destino. Además, el flujo actual de pagos dirigidos de clientes ya exige una cuenta válida.

La base actualmente conectada a la app no contiene ningún ABONO. No existe una base de producción publicada en este proyecto. La conexión Neon consultada por separado mostró un esquema parcial distinto, no el conjunto operativo de esta app. No fue posible identificar el abono que originó el reporte ni verificar su cuenta destino.

**No se corrigió el cálculo del Bloque 2.** La propuesta pendiente es exigir destino en todos los nuevos ingresos y presentar históricos sin destino en una categoría explícita, sin inventar su cuenta. Se necesita la pantalla, el sitio y el folio/fecha del caso original.

## Verificación pedida, punto por punto

| Punto | Resultado observado |
|---|---|
| 1. Typecheck completo y codegen sin diferencias | Codegen aprobado; segunda generación idéntica. Typecheck fallido: TS1135 en la ruta de notificaciones. |
| 2. Suites de crédito, caja, analytics y POS | Pruebas unitarias/contratos seleccionados: servidor 150/153; interfaz 57/60. Integraciones bloqueadas por falta de TEST_DATABASE_URL. No se acredita aprobación de las suites completas. |
| 3. Escanear varios rollos y comprobar contador | Código implementado. Su contrato falló; comprobación de navegador bloqueada. No aprobado. |
| 4. Autorizar nota y abonar el mismo día; revisar cuatro superficies | No ejecutado con persistencia. No se creó un caso financiero ni se encontró el abono original. No aprobado. |
| 5. Cuatro estados y vencida parcial roja | Prueba unitaria de estados aprobada. Verificación visual bloqueada. No aprobado de extremo a extremo. |
| 6. Saldo pendiente junto a los tres estados impagos | Presentación implementada, pero la revisión encontró importe original en notificaciones. Verificación visual bloqueada. Incompleto. |
| 7. Sobrepago genera saldo a favor visible | Proyección unitaria de exceso y saldo resultante aprobada. Recepción real y ficha no verificadas. |
| 8. Aplicación no cambia Cobrado | Prueba de conservación en memoria aprobada, insuficiente para analytics real. Revisión detectó cambio de Cobrado por sitio. Requisito incumplido. |
| 9. Saldo a favor no editable directamente | Implementación usa movimientos/evidencia, sin campo de edición directa. Sin prueba operativa real; cancelación/reaplicación presenta inconsistencia. |
| 10. Pantallas en teléfono | Intento de navegador con datos simulados bloqueado por respuestas incompletas. No aprobado. |

## Fallos de la tanda estática

### Typecheck

`pnpm run typecheck` terminó con código 2:

`artifacts/api-server/src/routes/notificaciones.ts(562,9): error TS1135: Argument expression expected.`

No se reinició el servidor API con este código: el proceso que sigue activo conserva el código compilado anterior. La interfaz sí se reinició; ese arranque no valida el nuevo servidor.

### Servidor: 150 aprobadas, 3 fallidas

- El contrato de notas todavía exige la función y los tres estados anteriores.
- La suite de notificaciones de crédito no pudo cargar por el error de sintaxis.
- El contrato de detalle de ticket no aporta el nuevo `estadoNota` requerido.

### Interfaz: 57 aprobadas, 3 fallidas

- Contrato de explicaciones estadísticas: falta la coincidencia esperada `dashboard-inventory-explanation`.
- Contrato del contador: la expresión exige un orden de clases diferente del código.
- Contrato de Nota: no encuentra la comparación textual esperada con `PENDIENTE`.

Estos resultados no se corrigieron ni se reejecutaron.

### Integraciones

Los comandos de ledger, esquema de crédito, analytics, POS y conciliación de caja abortaron antes de ejecutar sus casos por la protección que exige `TEST_DATABASE_URL`. No se aprovisionó una base ni se crearon fixtures/usuarios para sortear esta restricción. Un primer intento de conciliación usó un nombre de script inexistente; después se invocó el script configurado `test:admin-realtime-reconciliation`, que también quedó bloqueado por la protección.

## Hallazgos adicionales de revisión

1. **Cobrado por sitio cambia al aplicar saldo a favor.** El dinero no aplicado se omite con filtro de sitio, mientras que su aplicación se atribuye al sitio de la nota. Aunque la suma global pueda conservarse, el total filtrado no permanece igual.
2. **Favor tras cancelación puede ser inutilizable.** La proyección libera el importe, pero el límite de la base sigue restando aplicaciones históricas append-only; autorizar su reutilización puede rechazarse.
3. **Autorización bloqueada aunque el favor cubra el exceso.** La interfaz sigue exigiendo la bandera inicial de autorización calculada sin el importe seleccionado.
4. **Notificaciones presentan saldo incorrecto.** El estado canónico va acompañado del importe original, no del pendiente actual.

Son hallazgos dentro de este trabajo, no funcionalidades adicionales. Quedan sin corregir a la espera de autorización.

## Intento de navegador

Se interceptaron las solicitudes de API con datos simulados. No hubo login real, usuarios nuevos, escrituras de base ni operaciones financieras persistidas.

Los fixtures no cubrieron todos los datos requeridos por la app: faltaron arrays de notificaciones y métricas de caja, y la ruta del cliente encontró un valor indefinido antes de `.find`. Ninguno de los recorridos solicitados pudo acreditarse. No se atribuyen estos errores de fixtures al funcionamiento de la app con datos reales.

La fecha 2025-01-15 que figura en el reporte bruto de navegador corresponde al contexto simulado; la ejecución de esta tanda fue el 2026-09-14.

## Evidencia guardada

- `codegen.log`, `codegen-diff.log` y listas SHA antes/después.
- `typecheck.log`.
- `servidor-pruebas.log` e `interfaz-pruebas.log`.
- Logs de intentos de integración.
- `navegador-reporte.md` y `revision.md`.

No se modificaron registros de la base por fuera de migraciones; tampoco se ejecutaron migraciones, se crearon usuarios/ADMIN temporales ni se utilizó `executeSql({ environment: "development" })`.