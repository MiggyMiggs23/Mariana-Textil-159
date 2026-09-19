# Tarea 2 — E6, entrega parcial autorizada

## Resultado y límites

Solo presentación de Cuentas Destino y de la banda de cobranza de Tiempo real: encabezado, tarjeta y columna por tienda de destinos dicen **Cobranza del periodo**; componente contado y tarjeta de ventas dicen **Contado cobrado**. La banda del tablero usa también esos nombres y su aria-label de carga/error dice **Cobranza del periodo**. Se conservan los identificadores técnicos `text-monto-cobrado` y `text-monto-cobranza-del-periodo`, claves del contrato, hook, filtros, fuentes, enlaces y todos los importes. No se modificaron cálculos financieros ni `destinationReadModel`.

**Exportaciones/documentos BLOQUEADOS:** el propietario confirmó proteger el archivo completo `artifacts/api-server/src/routes/admin-analytics.ts` por contener el corte E2. Allí están `destinationsXlsx` y `/admin/cuentas-destino/export.xlsx`, `/admin/cuentas-destino/export.pdf`, además de `/admin/cuentas-destino/:cuentaDestino/movimientos/export.xlsx`. Los exportes actuales de resumen presentan cuenta, forma de pago, importe y operaciones, no un desglose del encabezado que distinga ambos conceptos. No se agregó un exportador paralelo, no se cambió su contrato ni se declara E6 completo. Documento PDF y XLSX quedan pendientes de autorización para ese archivo.

**Coordinación con tarea 3/main:** main confirmó que no había colisión en `tiempo-real.tsx` y autorizó finalizar sus etiquetas de presentación: se cambiaron exclusivamente título, etiqueta del componente contado y aria-label de la banda existente. Es un tablero, no un archivo de corte E2. No se editaron los cinco tests conocidos en rojo, ni archivos protegidos A+C, devolución, guardas E1 o corte E2. No se aplicó sustitución global a otros “Cobrado” del tablero (p. ej. contado por tienda), pues no son el agregado de cobranza del periodo.

## Evidencia aislada, sin API/DB

Comando:

`node scripts/src/frontend-test-runner.mjs --file src/pages/caja/cuentas-destino-labels.observable.test.ts`

Dos tests nuevos, montaje real con React/createRoot/act en JSDOM. Se transpilan y ejecutan ambos componentes reales completos; wrappers de UI, hooks con fixture explícito y navegación se aíslan, mientras React, date-fns, number-format, atención y funciones monetarias son reales. Tiempo real reutiliza las fixtures de dashboard/pending validadas por schema del soporte existente, normalizadas por JSON igual que su transporte al navegador; no se invoca el helper de navegador ni una query real. No hay conexión, solicitudes ni importación del backend. Las fixtures son exclusivamente de ensayo, no datos productivos.

Se montan ambos componentes **antes y después** sobre los mismos tres datos: centavos no redondos, reversos negativos en cada componente y cero neto con abonos/favor de signo contrario. La fuente anterior congelada de destinos viene de `3002b2359c4b09e520252e1eb5a27bdae0508aef`; coincidía exactamente con el archivo de inicio de tarea. `baseline-source.txt` conserva esa evidencia sin reescritura y el test fija su SHA-256 `d47f22f2a1e406c943f98adf8231f2cf8bcbf952159b5e7751efe35a8c35327a`. La fuente previa de Tiempo real viene del HEAD `173b7cf1373c7fb568209453721dbf510c5b1d38`, guardada en `baseline-tiempo-real-source.txt` con hash fijo `bf194277cc072572d40273b6bc27cbbc6f1e594fcdf641194fd0b02cec899596`.

Se exige igualdad de cada hoja numérica visible, componentes y totales (contado, abonos, favor, cobranza, crédito, vendido, por cobrar), comparativos, matriz y acumulados por tienda; también importes y porcentajes de enlaces, identificadores y argumentos del hook. Se comprueba que la respuesta original no fue mutada. No se sustituye por una prueba de fórmula duplicada.

Nueve mutantes se compilan/montan en VM y DOM independientes, sin modificar archivos servidos: cuatro en destinos (etiqueta contado vieja, título viejo, +$0.01 en abonos y +$0.01 en total) y cinco en Tiempo real (título, componente contado, aria-label, +$0.01 en componente y total). Los nueve producen **AssertionError esperado**; después se vuelve a montar la fuente restaurada y los tres escenarios de cada componente pasan. El aria-label se comprueba en la rama de carga, donde existe. `observable.log` guarda FAIL esperado y PASS restaurado: **2/2 PASS**. Son fallos de aserción capturados por el test negativo, no procesos completos con exit 1.

### Suplemento T2: procesos realmente rojos, fuente congelada

La auditoría de main observó correctamente que los `assert.throws` de la prueba verde anterior no satisfacían por sí solos la exigencia de ver fallar el proceso. **No se acredita retrospectivamente `observable.log` como nueve procesos rojos.** Se añadió únicamente evidencia bajo este directorio, sin modificar código ni tests del commit T2 `9c337df`.

Ejecución: `node reports/tanda-nocturna-20260919/tarea-2/process-red-runner.mjs`, sobre HEAD `7643992863b4956757d18a32b92a3c0f5fe9f6ad`. Resultado: **9/9 procesos hijos con exit 1 por la aserción primaria prevista**, seguidos por proceso normal restaurado **exit 0, 2/2 PASS**. Cada hijo seleccionó uno de los dos tests comprometidos, que se ejecutó sin cambiar sus aserciones. Un preload de evidencia interceptó únicamente la lectura UTF-8 de la fuente del componente correspondiente e inyectó el defecto en memoria; el snapshot anterior y la fuente/test de disco permanecieron intactos. El guard offline canónico estuvo cargado en todos los hijos. Se usó `--test-isolation=none` dentro de cada proceso hijo ya separado para no propagar preloads a procesos adicionales.

| Proceso | Defecto real inyectado | Fallo primario comprobado |
|---|---|---|
| destino-label | Contado cobrado → Cobros directos | Número de etiquetas exactas de tarjeta/componente incorrecto |
| destino-title | Cobranza del periodo → Cobrado | Falta título exacto |
| destino-component-cent | Abonos 25.17 → 25.18 | Comparación antes/después difiere en $0.01 |
| destino-total-cent | Total 875.09 → 875.10 | Comparación antes/después difiere en $0.01 |
| realtime-title | Título anterior | Falta título de cobranza |
| realtime-label | Etiqueta anterior del componente | Número de etiquetas exactas incorrecto |
| realtime-aria | Aria-label anterior | Falta nombre accesible en rama de carga |
| realtime-component-cent | Abonos 25.17 → 25.18 | Comparación antes/después difiere en $0.01 |
| realtime-total-cent | Total 875.09 → 875.10 | Comparación antes/después difiere en $0.01 |

El runner exige exit 1, `AssertionError`, evidencia específica del defecto y nombre del test correspondiente; rechaza errores de infraestructura/red/sintaxis. No considera las impresiones de los `assert.throws` anteriores como prueba de exit 1. En los mutantes monetarios, el error uncaught procede del `deepEqual` antes/después; en los de etiquetas, de `checkLabels`/`checkAria` primarios.

Evidencia nueva: `process-red-runner.mjs`, `process-red-runner.log`, `process-red/*.cjs`, nueve `process-red/*.red.log`, `process-red/restored.green.log` y `process-red/summary.json`. Los hashes de ambos componentes y del test se verifican antes y después de cada hijo, e íntegros al terminar. No se reejecutaron otras regresiones ni typecheck, no se editaron archivos productivos temporalmente, no hubo API/SQL/DB ni commit. Este suplemento pertenece al commit final de verificación de main, no cambia el commit de código T2.

Regresión acotada: `cuentas-destino.contract.test.ts`, `caja-cobranza.contract.test.ts`, `cuentas-destino-financial.contract.test.ts`: **20/20 PASS**, `regression.log`.

Se conservan dos intentos iniciales de preparación, **no acreditados como mutantes**: `setup-guard-rejection.log` (el guard offline bloqueó ejecutar git desde el test; se cambió a snapshot previamente capturado) y `setup-label-comparison.log` (comparar todo el texto del enlace incluía justamente la etiqueta renombrada; se separó la comparación de href e importes de la aserción de etiqueta). No se alteraron importes esperados para conseguir verde.

También se conservan `setup-realtime-transport.log` (schema devuelve Date; el helper existente entrega fechas ISO tras JSON) y `setup-realtime-loading.log` (el aria-label está en carga/error, no en éxito). Se corrigió el montaje para respetar esas condiciones reales. Ninguno de esos intentos preliminares se acredita como prueba negativa válida; solo la ejecución final de `observable.log`.

Sin SQL, conexiones a ninguna base, API, reinicios, builds, cambios dist, dependencias, variables de entorno, usuarios ni sesiones. No hay screenshot autenticado ni validación de legibilidad a 402 px: el montaje JSDOM no acredita geometría. Main conserva el typecheck raíz y el commit separado; este agente no hizo commit.

## R6 — alcance preciso de la discrepancia

La búsqueda literal en `artifacts`, `lib` y `docs` no encuentra **Cobros de periodos anteriores** en fuente actual. En `cuentas-destino.tsx` el bloque relacionado hoy dice **Cobros por abonos y saldos a favor**, subtítulo **Neto del periodo, incluidos reversos**; las claves históricas como `cobrosAnteriores` NO fueron renombradas.

La cadena sí está en `replit.md:1115` y en antecedentes: `reports/credito-saldo-favor/resultado-2026-09-15.md:21`, `reports/prompt-j/visual-preview.md:16` y el plan U (E6/R6). Los dos antecedentes no concuerdan: uno registra que faltaba cambiarla, el otro afirma que fue renombrada. Se conserva esa historia; no se reescribieron reportes, snapshots, documentos ya emitidos ni resultados pasados. `r6-search.log` registra la búsqueda previa a crear este informe. Ausencia en fuente no prueba ausencia en un bundle servido, captura antigua o PDF guardado, ni confirma lo visto hoy en pantalla. R6 continúa como discrepancia histórica/visual a conciliar.

## Propuesta exacta para main: replit.md (NO editado por este agente)

1. En las declaraciones vigentes de identidad (párrafos de líneas 100 y 946 y el apartado de dos definiciones), sustituir la identidad anterior por **Ventas = Contado + Ventas a crédito**. `Contado` es el concepto de la identidad; **Contado cobrado** es su etiqueta de presentación, no un cálculo nuevo.
2. En el párrafo de línea 100, sustituir la frase que dice que la decisión de nomenclatura sigue abierta por:

   «La nomenclatura E6 distingue Contado cobrado de Cobranza del periodo; la identidad canónica es Ventas = Contado + Ventas a crédito. La cobranza incluye el contado más abonos a notas y saldos a favor recibidos, netos de reversos, conforme al lector vigente. Esto no resuelve la atribución por sitio ni habilita las extensiones E7.»

3. Sustituir el título `Cobrado: dos definiciones sin reconciliar` por `Ventas y cobranza: nombres distintos, atribución pendiente`, actualizando referencias internas vigentes. Sustituir solo su introducción y los dos bullets de nombres por:

   «**Nomenclatura decidida en E6.** Ventas y cobranza son mediciones distintas; no se unifican sus cálculos. La identidad canónica es **Ventas = Contado + Ventas a crédito**. **Contado cobrado** presenta los tickets cobrados por caja, sin sumar abonos del libro de crédito. **Cobranza del periodo** presenta contado más abonos a notas y saldos a favor recibidos, netos de reversos, según `destinationReadModel`/`getDestinationAccounts`. `useSharedCuentasDestino` conserva la fuente compartida. Los cobros nuevos pendientes de aplicación pertenecen a E7; E6 no los añade. La asimetría por sitio y la evidencia histórica descritas abajo siguen pendientes.»

   Conservar íntegros el párrafo de asimetría y sus importes históricos.
4. En el párrafo vigente de Cuentas Destino (línea 599), usar `Cobranza del periodo` para encabezado y agregados, `Contado cobrado` para su tarjeta, y sustituir la referencia a decisión del propietario por:

   «La decisión de nombres está fijada en E6; la implementación de Cuentas Destino en fuente conserva los importes. Exportaciones/documentos quedan detenidos por la protección del archivo de corte E2 y no se declaran actualizados. La atribución por sitio sigue pendiente.»

5. Sustituir únicamente la afirmación de título actual en la línea 1115 por:

   «**R6 — discrepancia histórica pendiente:** reportes anteriores registraron de manera contradictoria el título “Cobros de periodos anteriores”. La búsqueda actual no lo encuentra en fuente; Cuentas Destino muestra “Cobros por abonos y saldos a favor”, con “Neto del periodo, incluidos reversos”. No se verificó hoy la pantalla autenticada ni se reescribieron snapshots/reportes históricos; no se declara cerrado R6.»

No sustituir indiscriminadamente toda palabra Cobrado: hay claves técnicas, métricas de contado, efectivo contado de cortes y snapshots históricos con otros alcances.

## Archivos propios

- `artifacts/mariana-textil/src/pages/caja/cuentas-destino.tsx`
- `artifacts/mariana-textil/src/pages/caja/tiempo-real.tsx`
- `artifacts/mariana-textil/src/pages/caja/cuentas-destino-labels.observable.test.ts`
- Evidencia de esta tarea bajo `reports/tanda-nocturna-20260919/tarea-2/`, inventariada en `manifest.sha256` (el manifiesto no se incluye a sí mismo).

Revisión de inicio observada al finalizar comprobaciones: `173b7cf1373c7fb568209453721dbf510c5b1d38`; no representa commit de esta entrega. Los hashes propios fijan exactamente el candidato; no se atribuyen cambios concurrentes de otros agentes.