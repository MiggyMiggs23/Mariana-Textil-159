# 3. Cierre de suites actor

Fuente de ejecución: `1031a630fd461c3df89767bad7a14cc777e56261`, posterior
a las correcciones de BODEGA y formato monetario. Solo MAIN ejecutó integración.

## Resultado

**27/28 suites calificadas; 27/27 dentro del alcance habilitado.**
La única exclusión es `artifacts/api-server/src/pagos-dirigidos.integration.test.ts`,
por dependencia de una puerta apagada. No se abrió esa puerta ni se cambió la
naturaleza del dinero para conseguir un verde.

El auditor general conserva **INCOMPLETE_OR_FAIL** porque exige 28/28. No se
modificó su contrato para ocultar la exclusión autorizada. Su único error es
`Missing route evidence: artifacts/api-server/src/pagos-dirigidos.integration.test.ts`.
Evidencia: `reports/actor-suites/tanda-c-final-audit.json`.

## Ejecuciones nuevas

| Run bajo `reports/actor-suites/runs/` | Resultado |
|---|---|
| `2026-09-23T07-47-45.605Z-fde60edd` | Permisos 29/29 y security-api 49/49; PASS, clúster destruido |
| `2026-09-23T07-49-18.302Z-468a61e0` | 13 suites PASS y pos-location con 5/5 casos nativos, pero terminal UNSAFE por reconocimiento de nombres dinámicos; parada y clúster destruido |
| `2026-09-23T07-52-48.786Z-e344098b` | Continuación explícita de las 11 rutas aún no ejecutadas; PASS, clúster destruido |

El auditor existente acepta pos-location mediante relectura de su log durable,
comparación con los nombres de la fuente y comprobación de procedencia. No se
editó el manifest UNSAFE ni se cambió el runner. El resultado no se presenta como
una sola corrida verde; tampoco reutiliza las 25 aprobaciones antiguas.

## Comandos y aislamiento

Se usó `env -i PATH="$PATH" HOME="$HOME" LANG=C.UTF-8 node
lib/db/src/run-isolated-tests.mjs --actor-ids=<rutas explícitas>
--actor-continue-on-failure`.
La primera selección fue permisos/security; la segunda las otras 25, excluyendo
pagos-dirigidos; la tercera únicamente las 11 pendientes después de la parada.
Las selecciones completas están en cada `selection.json`.

Consolidación:

```text
node reports/actor-suites/audit.mjs
  --run reports/actor-suites/runs/2026-09-23T07-47-45.605Z-fde60edd
  --run reports/actor-suites/runs/2026-09-23T07-49-18.302Z-468a61e0
  --run reports/actor-suites/runs/2026-09-23T07-52-48.786Z-e344098b
  --output reports/actor-suites/tanda-c-final-audit.json
```

Salida 1 esperada por la única exclusión documentada. Los 27 casos tienen
procedencia compatible de runner/helpers/schema y targets distintos; no hay
otro error de consolidación. Los tres terminales acreditan destrucción.
Los logs originales se conservan expresamente en Git, sin limpiar ni alterar
sus bytes. Advertencia conservada: `pg` anuncia deprecación de consultas
concurrentes sobre un cliente; no convirtió los tests en fallo.

No hubo SQL en la base de la API, actores operativos, reinicio, cambio de
workflow/bundle activo ni liberación.