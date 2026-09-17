# Verificación de contratos observables

## Resultado

**9 de los 10 contratos reescritos y acreditados. Uno permanece pendiente.
La suite amplia todavía no está completamente en verde.**

Se usó el mismo manifiesto explícito de **99 archivos**, con **354 pruebas**:

| Etapa | Aprobadas | Fallidas | Omitidas | Canceladas |
|---|---:|---:|---:|---:|
| Antes | 342 | 12 | 0 | 0 |
| Después de corregir JSX en el corredor | 344 | 10 | 0 | 0 |
| Después de las nueve reescrituras | 353 | 1 | 0 | 0 |

Evidencia: [antes](before.txt), [después de JSX](after-jsx.txt),
[verificación final](after-observable.txt).

Las dos pruebas que abortaban con `React is not defined` llegaron a sus
aserciones y aprobaron. No aparecieron fallos adicionales detrás de esos dos
errores. Se corrigió el corredor para usar el tsconfig de JSX automático
existente, sin añadir imports a componentes de aplicación.

**Typecheck completo: 0 errores**, salida 0, sin etapas pendientes ni fallos
de proceso/parser. Incluye bibliotecas, API, frontend, mockup-sandbox y scripts.
Evidencia: [typecheck final](typecheck-final.txt).

## Nueve negativos acreditados

En cada caso se introdujo el defecto en una copia temporal, se ejecutó el
corredor canónico y se exigió una `AssertionError` de comportamiento. Después
se restauró el archivo en **la misma copia** y se volvió a ejecutar.

| Contrato | Defecto introducido en la copia | Salida con defecto | Salida restaurada |
|---|---|---:|---:|
| Utilidad del cliente | Utilidad visible al cargar | 1 | 0 |
| Saldo a favor automático | Mostrar el remanente en lugar del importe aplicado | 1 | 0 |
| Contador de rollos | Quitar una serie deja intacta la lista | 1 | 0 |
| Desgloses de Caja | Contado cobrado abre el detalle equivocado | 1 | 0 |
| Venta facturada | Texto azul en lugar de rojo | 1 | 0 |
| Cantidad, unidad y cámara | Posición absoluta de la unidad provoca solapamiento | 1 | 0 |
| Kardex | Sustituir la ruta documental resuelta por otra ruta | 1 | 0 |
| Estado de nota | Insignia de abono parcial incorrecta | 1 | 0 |
| Utilidad / Margen | Rotular el porcentaje como Utilidad | 1 | 0 |

### Aserciones observadas en los procesos fallidos

1. `utility begins obscured on a newly mounted client page`
2. `the real Cobros authorization dialog presents the automatic server preview without a manual favor control`
3. `quitar una serie debe disminuir el mismo contador visible` — observado `'2' !== '1'`.
4. `click preserves the Contado cobrado detail identity`
5. `the invoiced sale is visibly red`
6. `unidad y cámara no se superponen para METRO en móvil` — observado `false !== true`.
7. `desktop opens the API-resolved document route`
8. `ABONO_PARCIAL keeps its canonical badge label free of currency`
9. `supplier metric labels distinguish monetary utility from percentage margin`

### Evidencia final por grupo

- Captura y contador: [resumen](capture-observable-negative.json),
  [log con ambos ciclos](capture-observable-negative.log).
- Utilidad cliente, favor y nota: [resumen](GROUP-finance-observable-negative.json).
  Logs `GROUP-finance-red-*.txt` y `GROUP-finance-restored-*.txt`.
- Desglose Caja: [resumen](GROUP-caja-breakdown-summary.json),
  [rojo](GROUP-caja-breakdown-red-wrong-cobrado-detail.txt),
  [restaurado](GROUP-caja-breakdown-restored-wrong-cobrado-detail.txt).
- Facturada, Kardex y nomenclatura: [resumen](identity-observable-negative-summary.json).
  Logs `identity-*-red.log` y `identity-*-restored.log`.

Sólo los archivos enumerados aquí acreditan la entrega final. Los otros logs
intermedios conservados en este directorio no se suman como pruebas acreditadas.
En particular, el intento de preparación de captura y los resúmenes antiguos
`GROUP-observable-*` no sustituyen estos resultados.

## Contrato pendiente: orden de Caja

`src/pages/caja/tiempo-real.contract.test.ts` se conserva **íntegro** y es el
único fallo restante del manifiesto. Su aserción original todavía inspecciona
la fuente y rótulos antiguos; no se presenta como una prueba observable nueva.

Al preparar su reescritura se confirmó una discrepancia de aplicación:
`replit.md:800` exige Cobranza separada **antes de las señales**, pero el
componente real montado coloca las señales antes de Cobranza.

La medición aislada registró `signalTop: 203` y `cobranzaTop: 374`.
La aserción de la regla vigente falló con:

```text
AssertionError [ERR_ASSERTION]:
DOCUMENTED CONFLICT: Cobranza must be before signals
```

Evidencia: [montaje y geometría](GROUP-caja-current-order-positive.txt),
[conflicto documentado](GROUP-caja-current-order-conflict.txt).

Este diagnóstico **no se cuenta como un décimo negativo**: no se introdujo
un defecto, sino que se observó una discrepancia existente. No se cambió el
orden de la aplicación, no se adaptó la regla para aceptarlo y no se omitió
la prueba. Corregir ese orden y completar su contrato requiere autorizar
el cambio de aplicación.

## Cobertura y límites

- Las reglas se declararon antes de editar: [reglas y referencias](rules.md).
  Se informó expresamente que el contador circular y la distribución
  cantidad/unidad/cámara no tenían una regla explícita en `replit.md`.
- Se montan los componentes reales; datos y dependencias de infraestructura
  se aíslan en memoria. Se observan DOM, interacción, estilos calculados y
  geometría, no nombres de variables, clases en cierto orden ni repeticiones
  de texto fuente.
- El contador se verifica en escritorio, 390 y 402 px, hasta volver a cero.
  Entradas cubre METRO, KILO, BOLSA y PIEZA, en escritorio y móvil.
- Utilidad del cliente incluye ocultamiento tras recargar, control táctil
  de al menos 44 × 44 px y favor cero. Nota incluye estados, historial,
  vencimiento ausente y reparto. Caja comprueba los seis desgloses por clic
  y Enter.
- Nomenclatura conserva las seis superficies: Tiempo real, Comparativo,
  Corte, Proveedor, Clientes y detalle de Cliente. También ejecuta el
  generador XLSX de clientes y los handlers XLSX/PDF de corte reales con
  lecturas simuladas. No acredita autenticación ni acceso a datos reales.
- La política de aceptación se añadió al final de `replit.md`; todo el
  contenido anterior se conserva como prefijo idéntico. Prompt P y su
  Grupo 1 no se modificaron ni se cerraron.
- No cambiaron módulos de aplicación, API, esquema ni dependencias. No se
  crearon usuarios o sesiones ni se ejecutaron escrituras en una base.
  Sólo se reinició el frontend; no se reinició la API.
- El frontend arrancó correctamente y se comprobó la pantalla de acceso
  sin iniciar sesión: [captura](app-preview.jpg).

## Reproducción

```sh
node scripts/src/frontend-test-runner.mjs
pnpm run typecheck

node scripts/src/observable-capture-negative.mjs
node scripts/src/observable-finance-negative.mjs
node scripts/src/observable-caja-negative.mjs
node scripts/src/observable-identity-negative.mjs
```

La suite amplia debe seguir informando el caso pendiente, no ocultarlo.
Los scripts de negativos modifican únicamente sus copias temporales.