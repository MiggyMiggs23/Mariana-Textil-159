# Prompt A actualizado — resultado de la auditoría documental

Fecha: 2026-09-15.

## Alcance y resultado

Se auditó el documento inicial completo y se corrigió **únicamente `replit.md`**. Los demás archivos creados por esta entrega son reportes nuevos en `reports/`. No se modificaron reportes históricos, aplicación, contratos, scripts, memoria, datos ni configuración.

Se hicieron lecturas estáticas y búsquedas de archivos. **No se ejecutaron typecheck, build, codegen, pruebas, navegador, SQL, conectores, login, migraciones, operaciones financieras ni reinicios.** Los resultados financieros y visuales anteriores conservan su procedencia histórica; no se presentan como verificaciones nuevas.

## Correcciones aplicadas

| Bloque / afirmación | Resultado y cambio documental |
|---|---|
| Dos definiciones de Cobrado | Se creó «Cobrado: dos definiciones sin reconciliar», enlazada desde POS/Caja y Cuentas Destino. Se conserva la identidad de ventas con el rótulo vigente Contado cobrado y, por separado, la cobranza que incluye abonos/favor. Decisión abierta del propietario; sin unificación propuesta. |
| Asimetría Cruces/global | Alta prioridad antes del piloto. Evidencia histórica: $25,000 en Cruces y $0 neto global el 15/09. Reversos de favor sin sitio frente a recapturas atribuidas al sitio de la nota. No corregida. |
| Predicado contabilizado | Seis copias manuales: cinco en `getSalesSummary` y una en `getSessionMargin`. Se retiraron las referencias numéricas falsas y se identificaron sus contextos. No se cambió SQL. |
| Referencias de código | Se completaron prefijos y sustituyeron citas `archivo:línea` por función, handler o declaración. Se distingue endpoint OpenAPI, segmento de router y ruta frontend. |
| FIFO y favor | Se conserva aplicación automática al autorizar y pago dirigido como intervención separada. Se evita afirmar un invariante universal sobre históricos con vetos o límites de evidencia. |
| Fechas | Se distingue instante financiero de calendario. Se documentan los flujos estrictos de cliente y las excepciones reales de proveedor/solicitud dirigida; no se describen como corregidos. |
| Autorización financiera | Nueva exigencia de guardar el texto original antes de escribir. La autorización original de movimientos 47–50 queda **no comprobada**; la prosa de un reporte no la acredita. |
| Insignia y saldo | Se mantiene estado/icono/color en la insignia y saldo pendiente actual separado. No se convierte un dato ausente en cero. |
| Cuatro diagnósticos de tipos | Se retiró el conteo incompleto de dos. Quedan dos de API y dos de Alertas según evidencia previa; no se ejecutó ni corrigió typecheck. |
| Primer fallo / verdes falsos | Se documentan ejecución parcial, paquetes omitidos, deduplicación y errores de preparación/cleanup absorbidos aunque el proceso termine en cero. |
| Corte | Se conserva como pendiente de alta prioridad: `listarSesionesCajaHistorial` y `buildCorteCaja` no incorporan ABONO del ledger al efectivo esperado. Sin ejecución ni corrección del corte. |
| Bloque 4 histórico | Se conservan IDs, saldos, fechas y límites como hechos reportados, no como nueva consulta o autorización. No repetir, revertir ni modificar 47–50. |
| Bloque 5 histórico | Sigue como propuesta no implementada. No se reabrió ni se creó una tarea. |
| Favor tras reversos / AJUSTE | Se documenta capacidad ocupada por aplicaciones históricas y diferencia entre saldo proyectado y origen admisible para evidencia. Siguen abiertos. |
| Aviso favor/deuda | Los datos de vista previa existen, pero el aviso específico no está implementado. |
| Nomenclatura | Persisten «Ticket #» / «Cancelar Ticket» para notas y dos significados de PENDIENTE. |
| Navegador | No se acredita cobertura real de PAGADA y CON RETRASO ni cinco superficies por cuatro estados. SSR, interceptación o login no equivalen a recorrido autenticado. |
| Vencimiento | Se conserva la coincidencia histórica 2026-10-15 en documento/movimiento; el corrimiento se trata como pendiente de lectura/presentación, no como dos fechas distintas en DB. |
| Equipos y módulos | Se confirmaron siete tipos, ambas impresoras, filtro TIENDA/BODEGA y 32 módulos. No se duplicaron como faltantes implementables. |
| Roles | Siete valores del enum frente a seis roles no ADMIN de la matriz; no se confunden. |
| Purga A/B/C | A=33 tablas; B=7 tablas más una secuencia independiente; C=18 tablas. Resultados de purga y procesos quedan como históricos. |
| Impresión Salida | Se eliminó la contradicción que decía que su hoja imprimía series: el layout productivo no las imprime. |
| Evidencia ausente | Se retiró la cita `/tmp` inexistente y se escribió la ruta exacta del JSON de Prompt C. |

## Contradicciones entre el prompt y el código o la evidencia

1. **Dinero físico:** $25,000 de recapturas no demuestra otro ingreso al cajón ni un sobrante físico de ese importe. El código sí demuestra la omisión de abonos en el cálculo del corte. No se convirtió una cifra contable en observación física.
2. **Todas las fechas con hora/zona:** los filtros y vencimientos son calendario. Además, los flujos dirigidos genéricos y de proveedor todavía tienen cobertura incompleta del parser/builder estricto. Se documentó el estado real, no la regla ideal como si ya estuviera implementada.
3. **Autorización acreditada:** los reportes dicen que se autorizó, pero no contienen la cita original identificable. La búsqueda no la localizó; se retiró esa afirmación como hecho acreditado.
4. **Favor sin deuda como garantía absoluta:** los históricos protegidos y los límites de evidencia permiten excepciones; no se quitaron vetos para satisfacer una afirmación documental.
5. **Veto perpetuo:** una fuente anterior al cargo puede quedar bloqueada; no implica que toda fuente posterior quede bloqueada para siempre.
6. **Toda ruta en OpenAPI:** las rutas frontend y los segmentos internos del router no son claves públicas del contrato.
7. **Pendientes ya resueltos:** Equipos ya tiene los siete tipos y las dos impresoras; el saldo ya está separado de la insignia. Se comprobaron, no se volvieron a implementar.

## Comprobaciones complementarias al inventario inicial

Estas lecturas posteriores completan o precisan filas que inicialmente quedaron no comprobadas en el informe de verificabilidad.

| Afirmación | Evidencia estática | Resultado |
|---|---|---|
| Umbrales 90/70, mínimo 5, utilización 75 | `artifacts/api-server/src/lib/payment-behavior.ts`, `projectPaymentBehavior`, constantes `PAYMENT_BEHAVIOR_GREEN_MIN_PERCENT`, `PAYMENT_BEHAVIOR_YELLOW_MIN_PERCENT`, `PAYMENT_BEHAVIOR_MIN_SETTLED_NOTES`, `CREDIT_INCREASE_SUBSTANTIAL_UTILIZATION_PERCENT` | Comprobados; no son porcentajes inventados por la documentación. |
| Plazos 7/15/30/60 | `artifacts/api-server/src/lib/clientes-aging.ts`, `isCreditTerm`; validaciones de NOTA en `artifacts/api-server/src/lib/pos.ts` | Comprobado el uso del validador y mensaje del contrato operativo. |
| Salida 10 filas | `artifacts/mariana-textil/src/pages/salida-documento.tsx`, declaración `SALIDA_PRODUCT_ROWS_PER_PAGE = 10` y partición con `slice` | Comprobada partición de código, no PDF nuevo. |
| Nota 8 filas | `artifacts/mariana-textil/src/pages/ticket-detail.tsx`, `NOTE_PRODUCT_ROWS_PER_PAGE = 8` | Comprobada declaración. |
| Entrada 10 productos | `artifacts/mariana-textil/src/pages/entrada-documento.tsx`, `rowsPerPage = 10` | Comprobada declaración. |
| Entrada 22 series | No se localizó declaración productiva; fixture con 23 no es sustituto | **No comprobado**, marcado en `replit.md`. |
| Series en Salida impresa | El layout renderiza producto, color, rollos, cantidad y SKU, no serie; la verificación de series pertenece a entrega | Corregida contradicción interna del documento. |
| Componente Cuentas Destino | `CajaCuentasDestino` en `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx` | Nombre comprobado y corregido en cita. |
| Detalle documental | `TicketDetailPage` en `artifacts/mariana-textil/src/pages/ticket-detail.tsx` | Nombre comprobado. |
| DEVOLUCION | Enum y presentación localizados, no flujo generador productivo acreditado | Se retiró la afirmación absoluta de ausencia de ruta/servicio/prueba; queda límite explícito. |

## Informes y evidencia textual

- `reports/prompt-a-verificabilidad.md`: tabla del documento inicial completo: rutas, archivos, funciones, constantes, enums, conteos y límites.
- `reports/prompt-a-verificabilidad-salida.txt`: salidas del barrido inicial.
- `reports/prompt-a-finanzas-auditoria.md` y `reports/prompt-a-finanzas-salida.txt`: reglas financieras, fuentes, copias del predicado, fechas, corte e insignias.
- `reports/prompt-a-auditoria.md`: búsqueda y matriz de procedencia de autorización.
- `reports/prompt-a-alcance-inicial.txt`: estado inicial y huella protegida.
- `reports/prompt-a-cierre-salida.txt`: comprobación final de alcance, citas y conservación.

Los informes parciales describen el documento **antes** de corregirlo y propuestas de corrección del revisor. La tabla de este resultado identifica las correcciones efectivamente aplicadas; sus números de línea históricos no son citas estables del documento final.

## Conservación

La huella de los **1432 archivos rastreados** bajo `artifacts/`, `lib/` y `scripts/` coincide con la inicial:

`8ad59087781b492cda373c9a4fd91157ef10f3fd21260e87ce1ce4ae80067ce0`

Algoritmo: ordenar las rutas de `git ls-files -z artifacts lib scripts`; concatenar para cada archivo ruta, NUL, contenido, NUL; SHA-256 del conjunto. No hubo cambios rastreados protegidos. El adjunto original del usuario permanece intacto y no se considera un archivo creado por el agente.

No se deduce de esta conservación una nueva comprobación de saldos o de DB. No se investigaron ni reiniciaron procesos: esa operación está fuera del alcance documental.