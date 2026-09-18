# E2 — preparación de código y límites de liberación

## Autorización y estado

El alcance autorizado está en `../e2-alcance-autorizado-2026-09-18.md`: construir E2 con la devolución inactiva. No se autorizaron ni ejecutaron escrituras en base, migraciones, cierres o devoluciones. Se conservaron las guardas E1 y se añadió un bloqueo propio de devolución; no hay parámetro, variable de entorno ni cuerpo HTTP que lo abra.

La API ejecuta su bundle anterior. No se reinició ni se ejecutaron sus inicializadores. La interfaz sí recibió los cambios de preparación; las nuevas consultas E2 no estarán disponibles en la API hasta una reanudación autorizada. Un error al cargarlas debe mostrarse explícitamente, no sustituirse por candidatas o sesiones ficticias.

## Preparado

- Lector común de efectivo, importes en centavos, identidad de recepción disjunta y exclusión de aplicaciones, transferencias, correcciones y reversos como segundo egreso.
- Fondo + tickets físicos + abonos físicos + retenidos físicos − salidas físicas.
- Cierre que congela el desglose en su auditoría existente dentro de la transacción y el bloqueo de sesión.
- Compatibilidad exacta para históricos sin snapshot, por superficie. No se homogeniza retrospectivamente el cálculo administrativo que antes omitía salidas.
- Detalle compartido con documentos, enlaces existentes y evidencia visible en pantalla e impresión.
- Servicio transaccional de devolución íntegra de abono o retenido, ADMIN vigente, motivo, fuente nunca aplicada, disponibilidad completa, sesión de devolución abierta de hoy, idempotencia, disposición única y auditoría.
- El sitio y sesión de devolución se corresponden entre sí; no se exige que sean los del ingreso original. Una devolución actual en otra tienda no cambia el corte de recepción.
- El servicio adquiere tanto el advisory lock de crédito como el row lock del cliente: los ajustes contables existentes no comparten todos el primero.
- Contrato GET de opciones de devolución para ADMIN: fuentes reales por cliente y sesiones abiertas de hoy. Listar una candidata **no acredita elegibilidad económica**.
- Contrato POST y ruta registrados, pero inactivos. La antigua rama física de reverso no es una alternativa para eludir el bloqueo.
- Interfaz ADMIN integrada con opciones reales de abono y retenido: origen, importe íntegro, motivo y selección independiente de caja actual. Prepara UUID y payload real hacia el hook generado. El bloqueo cliente impide incluso un submit programático; la confirmación permanece deshabilitada. El sitio de recepción es contexto, no la caja de devolución.
- SQL de soporte separado y no instalado, sin inicializador automático.

## SQL preparado: no ejecutar sin nueva autorización

Archivo `sql/credit-refunds-prepared.sql`. Alcance:

1. Tres tablas nuevas en `public`: `evidencia_no_aplicada_e2`, `disposiciones_credito_e2`, `devoluciones_credito_e2`, con sus claves, restricciones e inmutabilidad.
2. Cuatro funciones nuevas: validación de prueba de origen, atestación de retenido nuevo, atestación de abono nuevo e inmutabilidad.
3. Seis triggers nuevos, incluidos los dos que reutilizan **sin cambiarla** la función existente `public.e1_guard_cash_capture_closed`.
4. Una restricción diferida de completitud sobre la nueva tabla de disposiciones.

No contiene backfill ni alteración de sesiones/cortes existentes, tampoco retiro o reemplazo de guardas E1. Preparar este archivo no autoriza aplicarlo. Antes de cualquier ejecución se requerirán identidad de base, preflight, autorización textual específica y evidencia de conservación.

Los productores futuros de recepciones deberán integrar las atestaciones dentro de la misma transacción de origen. No se creó una captura E3 ni conversión E5. Abrir únicamente el bloqueo E2 tampoco supera la guarda E1.

## Verificación ejecutada

Los manifiestos, comandos, salidas terminales y hashes de fuente están en `../e2-verificacion-2026-09-18/`. La referencia de comparación es `80eaa93d4300e86d9be54492e634f88f0c0abc90`. No se atribuyen a E2 pruebas de trabajos anteriores.

- Línea base seleccionada: 149 pruebas, 144 pasan y cinco fallan. La comparación posterior conserva exactamente ese conjunto de fallos; no se afirma que toda la suite del repositorio esté verde.
- Núcleo de efectivo: 16 pruebas pasan; matriz de 17 mutantes semánticos detectados con fallo individual de cada prueba, en copias aisladas. Evidencia: `../e2-cash-negative-proofs/`.
- Devolución y opciones: 25 pruebas puras/mock pasan, incluyendo ambos orígenes, otros sitios, bloqueo de cliente, rollback simulado, replay, autorización y guardas. No es una prueba PostgreSQL.
- Interfaz montada final: dos pruebas pasan; ambos orígenes, payload de caja actual, UUID y ausencia de POST. Mutantes del código fuente, ejecutados en copias temporales con el mismo runner, fallan al permitir enlaces externos o abrir el bloqueo cliente.
- Negativos de devolución: `refund-mutant-results/matrix.json` documenta 25 tests objetivo con fallo observado `AssertionError` al mutar copias de fuente, sin errores de importación/sintaxis ni cambios a los originales. **Límite:** dos son meta-pruebas de sensibilidad y dos verificaciones estáticas de arquitectura/DDL; varias prueban contratos de error, no todas las ramas de negocio. No equivalen a 25 defectos de negocio independientes ni a ejecutar PostgreSQL. SHA-256 de matriz: `424c0498da2b4fba867e3d69ff15be3b55951db2250a6886ea7cea15c6fdc440`.
- Impresión: componente real y CSS real compilado, fixture aislado sin API/DB, escritorio y móvil. Se comprobó visibilidad y geometría bajo estilos print de sumandos, esperado y evidencia documental. `../e2-print/report.json`. No se generó PDF ni se abrió impresión nativa.
- Preview general: pantalla de acceso renderizada sin error JavaScript, sin iniciar sesión. No acredita el recorrido E2 con datos reales.

### Revisión exacta de la confirmación final

- HEAD de partida: `1ad2cad601a667c586e084accbf52b3ca3b7cef7`, más los cambios de preparación sin commit propio.
- Manifiesto de fuente productiva final: **4,066 archivos**; SHA-256 agregado `2f075fd4533845ba694ff4d12a1ee7a1e70690eca82e24600f6302c9b469e292`, idéntico antes y después de las comprobaciones.
- Evidencia terminal: `../e2-verificacion-2026-09-18/latest-final-after-result.txt` y archivos `latest-final-*`.
- `pnpm run typecheck` canónico: **exit 0**, cuatro paquetes de artefactos/scripts y siete resultados de bibliotecas completos, **cero diagnósticos TypeScript**.
- Reconfirmación con los mismos manifiestos de 149 pruebas: **144 pasan, los mismos cinco fallos conocidos, cero fallos nuevos**. No se volvió a ejecutar la línea base.
- No hubo cambios de código productivo después de esta confirmación; los resultados no se extienden a DDL no aplicado ni a activación operativa.

## Resultado histórico de la lectura real

`../e2-historico-lector-final.json` registra una conexión y transacción READ ONLY, con salida interna **2 / NO_CLOSED_ROWS**: dos sesiones existentes, ninguna cerrada. No se creó una sesión para obtener un resultado favorable.

Por tanto, **no hay evidencia positiva de conservación de cortes históricos reales en esta base**. La lógica legacy/snapshot sí tiene pruebas offline, pero no se confunden ambas afirmaciones. La captura registra hashes de fuentes, identidad técnica hasheada y conteos; no incorpora credenciales.

## Lo que permanece sin aceptación operativa

- Cierre concurrente real con ingreso o devolución y rollback/idempotencia reales en PostgreSQL.
- Conversión positiva de retenido a abono: E1 no tiene ese flujo ni vínculo inmutable. E2 rechaza representaciones ambiguas y no implementa E5.
- Conservación sobre un universo no vacío de cortes cerrados anteriores.
- Activación de devolución, integración autorizada de productores de evidencia, aplicación de SQL y reanudación de API con inicializadores.
- Conteo físico, comprobante y confirmación de salida real, que corresponden al propietario.

No se declara E2 liberado ni operativamente aceptado. El resultado entregado es preparación con bloqueos vigentes, no autorización para E3–E12, Fondo o Prompt P.