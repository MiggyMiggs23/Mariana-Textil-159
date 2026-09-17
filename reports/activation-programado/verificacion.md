# Restricción de activación a PROGRAMADO

## Cambio y alcance

Comprobación previa: `compatibilidad-previa.md`. No se encontró un consumidor
legítimo del proyecto dependiente de activar desde otros estados.

El único cambio productivo es la comprobación de origen en `activarRollo`,
después de releer el rollo bajo FOR UPDATE y resolver el reintento UUID
existente, antes de escrituras y de validar producto/costo.

- PROGRAMADO conserva la recepción normal.
- BAJA indica reverso del movimiento incorrecto o Reactivación de faltante
  si reapareció una ausencia de auditoría.
- VENDIDO indica reverso por la vía correspondiente; cancelar el ticket
  cuando la venta pertenece a uno.
- EN_TRANSITO indica recibir o cancelar el traslado.
- DISPONIBLE explica que no corresponde una recepción duplicada.
- MOSTRADOR se identifica como terminal.

El motor usa `ACTIVATION_REQUIRES_PROGRAMADO`; el endpoint existente
convierte el error a HTTP 400 y transmite su mensaje. No se cambia el
contrato HTTP, los permisos, el alcance operativo ni la tabla compartida
de transiciones. Tampoco se modifica FIFO, crédito, reversos, reactivación
o candados por par.

## Comparación ejecutada contra el estado anterior

| Grupo | Antes | Después |
|---|---:|---:|
| Suite original | 354/354 | 354/354 |
| Motor T + exclusión reverso/reactivación | 20/20 | 20/20 |
| Interfaz T + exclusión | 9/9 | 9/9 |
| Contrato de impresión T | 1/1 | 1/1 |
| Activación: pruebas nuevas | — | 6/6 |
| **Total** | **384/384** | **390/390** |

Sin fallos, omitidas, canceladas ni pendientes en estas corridas.
`pnpm run typecheck` completo: salida 0, cero diagnósticos.
`git diff --check`: sin errores.

La suite acumulada anterior se volvió a ejecutar antes del cambio; no se
usó solamente su reporte histórico como línea base.

Comandos de pruebas (desde la raíz salvo el bloque indicado):

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  node scripts/src/frontend-test-runner.mjs

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  ./artifacts/api-server/node_modules/.bin/tsx --test \
  artifacts/api-server/src/lib/prompt-t.test.ts \
  artifacts/api-server/src/lib/single-roll-return.test.ts

(cd artifacts/mariana-textil &&
  env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm exec vitest run \
  src/pages/auditorias-inventario.test.tsx \
  src/pages/rollo-detail.test.tsx \
  src/components/auditoria/reactivacion-faltante-dialog.test.tsx \
  src/lib/api-related-movement-error.dom.test.tsx \
  src/pages/rollo-detail-movement-navigation.dom.test.tsx \
  --environment jsdom --reporter=verbose)

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  node scripts/src/frontend-test-runner.mjs \
  --file src/components/auditoria-inventario-print.contract.test.ts

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  ./artifacts/api-server/node_modules/.bin/tsx --test \
  artifacts/api-server/src/lib/activar-rollo-programado.test.ts

pnpm run typecheck
```

## Negativos semánticos de cada prueba nueva

Cada prueba ejecutó funciones reales del motor, falló con un defecto
semántico en una copia aislada bajo `/tmp` y pasó con la fuente restaurada.
Los archivos de prueba en las seis copias se compararon con el final y
coinciden. No se sustituyó código vigilado por la aplicación.

| Prueba | Defecto introducido | Evidencia roja |
|---|---|---|
| Recepción PROGRAMADO conserva cantidad/datos/cache | Guardar cantidad inicial 49 en vez de 50 | `negatives/mutant-01.txt` |
| Rechazos BAJA/VENDIDO/EN_TRANSITO sin mutar | Volver a admitir esos orígenes | `negatives/mutant-02.txt` |
| Explicación DISPONIBLE/MOSTRADOR | Omitir esos estados de la comprobación explicativa | `negatives/mutant-03.txt` |
| Baja → activar → reverso no duplica | Volver a admitir BAJA | `negatives/mutant-04.txt` |
| UUID de activación ya realizada no duplica | Comprobar estado antes del reintento idempotente | `negatives/mutant-05.txt` |
| Decidir con el estado releído bajo candado | Usar el candidato anterior al candado | `negatives/mutant-06.txt` |

Cada negativo contiene una prueba ejecutada y fallida con salida 1. Sus
cambios exactos están en los `.diff` correspondientes. Para reproducirlos,
aplicar cada diferencia únicamente a una copia aislada de la API y ejecutar
`tsx --test --test-name-pattern "<pattern de negatives/summary.txt>"`
sobre `src/lib/activar-rollo-programado.test.ts` de esa copia, con las mismas
dependencias externas. No aplicar estas diferencias al servicio activo.

La secuencia parte de un historial coherente de recepción +50 y baja −50.
Incluso en el negativo ejecuta después el reverso real: el registro final
muestra **100.000 frente a 50.000 esperados**. Con la protección, cantidad
individual y caché quedan en **50.000**, con un rollo disponible y un único
movimiento de restitución.

## Documentación y límites

`replit.md` contiene los diez pendientes con ejemplos concretos y la
conclusión del Bloque 2. El ejemplo antiguo VENTA → activar → reverso queda
expresamente cerrado en su eslabón activar; no se presenta como aún
reproducible. Se documentó una combinación restante del reverso de VENTA
que no usa activar. No se corrigieron esas otras vías ni se reanudó Prompt P.

Los nuevos escenarios usan dobles transaccionales deterministas:
**no son concurrencia PostgreSQL real ni llamadas HTTP autenticadas**.
No se ejecutaron las suites de integración que escriben datos, ni se
crearon usuarios, sesiones o movimientos de negocio para pruebas.

La API se reconstruyó y reinició una vez. Sus inicializadores habituales
completaron, el servidor quedó escuchando y el backfill de compras reportó
0 inserciones. La captura `preview.jpg` muestra el acceso sin sesión;
los 401 de `/api/auth/me` son los esperados. No prueba una operación
autenticada y no se presenta como tal.

Evidencia completa: `baseline/`, `current/`, `negatives/`,
`typecheck.txt`, `typecheck-exit.txt` y `preview.jpg`.