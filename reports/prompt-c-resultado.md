# Prompt C — resultado y límites de verificación

## Estado

Cambios implementados en código. **La aprobación visual autenticada permanece pendiente.** No se da por cumplida la revisión en navegador de las cinco superficies de notas y sus cuatro estados.

Esta entrega no ejecutó movimientos financieros, escrituras de base, migraciones, creación de usuarios, login ni sesiones de prueba. No se usaron credenciales operativas. No se reinició la API ni se publicó.

## Implementación

1. **Contado cobrado** sustituye el rótulo Cobrado (Caja), también en su desglose. Conserva cálculo e identificador interno COBRADO.
2. **Cobranza del periodo** aparece en una banda separada. Tablero y Cuentas Destino consumen `useSharedCuentasDestino` → `useGetAdminCuentasDestino` → endpoint existente → `getDestinationAccounts`. Total y grupos vienen del mismo encabezado, sin otra implementación financiera.
3. Los enlaces conservan día CDMX, sitio y fuentes y abren el detalle canónico. Los tres filtros públicos POS, ABONO y ABONO_SALDO_FAVOR se expanden a las cinco fuentes internas de cobranza; incluyen reversos y excluyen CREDITO. No debe añadirse REVERSO_ABONO como un filtro público independiente.
4. Cuentas Destino está organizada en **Venta / Cobranza / Cartera**. Se conservaron cifras, comparaciones, desgloses, tablas, gráfica y enlaces. Las cuentas efectivas quedan subordinadas a Cobrado.
5. La insignia compartida muestra únicamente icono/color/estado. El pendiente actual queda en campo separado en las superficies correspondientes. En estado de cuenta también se muestra cero en notas pagadas; una ausencia se declara «No disponible». Los no-nota conservan su guion y Deudor/A favor queda subordinado a Importe.
6. Las tarjetas de detalle Estado de Nota / Saldo pendiente / Vencimiento tienen estructura alineada; el importe original se conserva como información secundaria. No se modificó la derivación de estados del servidor.
7. Un error o demora de la nueva cobranza no oculta las cuatro tarjetas anteriores. La fecha de la nueva consulta usa explícitamente America/Mexico_City.

## Cifras reales antes/después

Fecha: **15/09/2026, America/Mexico_City**. Se usaron las funciones reales, un cliente y transacciones `REPEATABLE READ READ ONLY`; cada ejecución registró 19 lecturas de aplicación. El JSON original se conservó inmutable.

| Cifra | Alcance | Antes | Después |
|---|---|---:|---:|
| Ventas | Cruces y Global | $37,772.00 | $37,772.00 |
| Contado cobrado | Cruces y Global | $0.00 | $0.00 |
| Ventas a crédito | Cruces y Global | $37,772.00 | $37,772.00 |
| Utilidad | Cruces y Global | $6,880.00 | $6,880.00 |
| Cobrado canónico | Cruces | $25,000.00 | $25,000.00 |
| Cobrado canónico | Global | $0.00 | $0.00 |

- Identidad comprobada: **$37,772 = $0 + $37,772**.
- Se compararon las 125 hojas numéricas de Cuentas Destino: 62 Cruces y 63 Global, además de los campos de las cuatro tarjetas. Sin diferencias; se excluyeron metadatos de tiempo.
- Cruces: detalle canónico de **2 movimientos / $25,000**, una página con tamaño 2.
- Global: **4 movimientos / $0 neto**, dos páginas con tamaño 2.
- Se verificaron conteo e importe de cada página y los grupos de las cinco fuentes al centavo.
- Las huellas de movimientos **43–50** y el conteo/huella de `preventImplicitFavor` consultado permanecieron iguales. No se deduce que un conteo histórico descrito en otros documentos sea el conteo actual.

Tablas completas y huellas: `reports/prompt-c-readonly-2026-09-15-after.md`. Datos originales: `reports/prompt-c-readonly-2026-09-15.json`; comparación: `reports/prompt-c-readonly-2026-09-15-after.json`.

## Corte de caja — documentado, no corregido

La revisión estática de `listarSesionesCajaHistorial` y `buildCorteCaja`, en `artifacts/api-server/src/lib/pos.ts`, muestra efectivo esperado = fondo inicial + pagos EFECTIVO de tickets − salidas. El camino no incorpora los ABONO de `movimientos_credito`. No se ejecutó un cierre o cuadre para comprobarlo.

Se registró en este reporte financiero y en **«Tablero: venta y cobranza» de replit.md** como pendiente de alta prioridad antes del piloto. Un abono realmente ingresado al cajón y omitido podría causar una diferencia, pero **los $25,000 de recapturas no acreditan un ingreso físico adicional ni un sobrante real de ese día**.

## Verificaciones ejecutadas

- **Codegen: PASS**, salida 0 y sin diferencias en cliente, Zod o especificación. `reports/prompt-c-codegen.log`.
- **Pruebas explícitas: 9 PASS / 0 FAIL**. Incluyen guarda de fuente compartida con casos negativos, ejecución del hook con la misma respuesta/filtros, accesores de fuentes, aislamiento de error y render real del componente de insignia para los cuatro estados. Este render es SSR, no una aprobación de las cinco pantallas en navegador.
- Comando final:
  `pnpm --filter @workspace/mariana-textil exec tsx --tsconfig tsconfig.render-tests.json --test src/caja-cobranza.contract.test.ts src/components/cliente-nota-estado-badge.contract.test.ts src/components/cliente-nota-estado-badge.render.test.ts`
- El render de prueba necesitó configurar JSX automático para el ejecutor; no se cambió la aplicación para simular el componente. `reports/prompt-c-contract-tests-final.log`.
- **Build frontend: PASS**, salida 0. Conserva advertencias de sourcemaps y tamaño de chunks; no se intentó resolverlas. `reports/prompt-c-build-final.log`.
- **Typecheck completo: FAIL por los cuatro errores preexistentes**, no un PASS. Se ejecutó `pnpm run typecheck`, se completaron API/frontend con `--no-bail` tras el corte temprano de scripts y se confirmó el frontend final. Dos errores nuevos de implementación detectados durante el trabajo —queryKey y componentes Alert sin importar— fueron corregidos; no permanecen.
  - `pos.ts(445,41)`: `toISOString` sobre `never`.
  - `clientes.ts(1380,10)`: propiedad duplicada.
  - `alertas.tsx(206,55)` y `(224,51)`: `pendiente` no existe en `AdminAlertaCredito`.
- Logs: `prompt-c-typecheck.log`, `prompt-c-typecheck-complemento.log`, `prompt-c-typecheck-frontend-final.log`, dentro de `reports/`. Se deduplicaron diagnósticos repetidos entre API y scripts.
- Se revisaron las objeciones de arquitectura sobre fecha, aislamiento de errores, pruebas de fuente y documentación del corte, y se atendieron. No se afirma una segunda aprobación independiente.
- Se reinició únicamente el workflow frontend: Vite quedó listo. El workflow API conserva el fallo previo de puerto ocupado; no se arrancó para evitar ejecutar sus inicializadores.
- Sin diferencias en backend, librerías generadas o scripts existentes; no se tocaron el corte, los cuatro diagnósticos protegidos ni los predicados financieros manuales. La prueba de contrato existente de insignia quedó sin cambios; las pruebas adicionales son nuevas.

## Navegador y capturas: alcance exacto

**Sesión real: no disponible.** Las capturas `prompt-c-antes-sin-sesion.jpg` y `prompt-c-despues-sin-sesion.jpg` muestran login con 401. No son comparaciones visuales del tablero ni acreditan notas reales.

Con respuestas interceptadas y bloqueo de llamadas API reales se observaron componentes montados de:

- Tablero a 1280px, cuatro tarjetas y banda de cobranza.
- Cuentas Destino a 1280px y 402px, con las secciones nuevas. En 402px se midió scrollWidth = clientWidth = 387px, sin desbordamiento horizontal de página.
- Detalle canónico con periodo, contexto de sitio, importe y tabla. No se completó la navegación final a folios reales.

Las primeras respuestas interceptadas estaban incompletas y provocaron errores de presentación; se corrigieron solo esas respuestas. Filas genéricas que mostraron `/tickets/undefined` no son evidencia de un defecto del producto. Tampoco se considera una fuente faltante que los enlaces públicos agrupen los reversos mediante ABONO.

Capturas disponibles en `reports/prompt-c-visual/`. Al revisar la captura de escritorio se detectó recorte del porcentaje de una cuenta: se permitió ajuste de fila y un ancho mínimo adaptable. Esa corrección final quedó comprobada por código/build, **no por otra captura interceptada**.

**Pendientes visuales:** comparación antes/después auténtica; cinco superficies con PENDIENTE / ABONO_PARCIAL / PAGADA / CON_RETRASO; notas reales solicitadas; recorrido completo por folios y comprobación visual final de todos los importes/porcentajes. No se inició sesión ni se crearon datos para eludir este límite.