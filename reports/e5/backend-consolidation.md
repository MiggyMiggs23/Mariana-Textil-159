# E5 — consolidación estática de evidencia backend

## Resultado

La auditoría estática reconcilia 49 IDs únicos con ciclos terminales
verde / mutante rojo `ERR_ASSERTION` propio / verde restaurado. No presenta los
fragmentos como una ejecución única ni cambia el estado de ningún manifiesto:
los cinco manifiestos que terminaron `FAIL` continúan `FAIL`; el último conserva
`COMPLETE_EXPLICIT_SUBSET`.

El resultado mecánico está en `reports/e5/backend-consolidation.json` y se
reproduce, sin ejecutar tests, con:

```sh
node reports/e5/audit-backend-consolidation.mjs
```

## Reconciliación de snapshots

La evidencia terminal seleccionada usa tres hashes históricos de
`e5.test.ts`. La auditoría reconstruye esos textos exactamente, los parsea con
el AST de TypeScript y compara por ID cada declaración con la actual:

- `a749f3ca…d4dce5`: 38 casos terminales. Frente al archivo actual solo cambian
  las declaraciones de `E5-CASH-RETAINED-WITHOUT-APPLICATION`,
  `E5-LOAD-FOR-UPDATE` y `E5-E1-CORRECT-PRODUCER`; ninguno de esos tres toma su
  evidencia de este snapshot.
- `2d2277ea…a93b87`: 3 casos terminales. Solo cambian las declaraciones de
  `LOAD` y `E1`; ninguno toma su evidencia de este snapshot.
- `efa7f410…19261`: 8 casos terminales, incluidas las declaraciones actuales de
  `LOAD` y `E1`.

El único helper añadido entre snapshots es `spySequence`. El análisis AST de
referencias lo limita a `LOAD` y `E1`, ambos ejecutados después de añadirse. No
se aplana ni se atribuye retrospectivamente a snapshots anteriores.

Para cada caso también se exige que el archivo productivo actual conserve el
hash del manifiesto, que el ancla sea única, que el hash mutante recalculado
coincida y que los tres logs existentes acrediten exit 0, rojo no cero con
`ERR_ASSERTION` e ID, y restaurado exit 0. No hay IDs invalidados ni repetición
necesaria.

## Historial preservado

- Los intentos iniciales de bundle/anclas siguen siendo fallos de
  infraestructura y aportan cero ciclos.
- Los manifiestos parciales posteriores aportan ciclos individuales, pero no se
  renombran `PASS`.
- Los gates fuente `E5_ENABLED` y `E5_CONTADOR_A_ENABLED` permanecen en
  `false`.
- No se modificó el inventario/guard E3.

## Límites

La evidencia usa actores y repositorio en memoria y captura solicitudes SQL.
No prueba PostgreSQL real, aislamiento, locks, rollback del motor, triggers ni
DDL. Tampoco ejecuta la app ni acredita routing HTTP/auth integrado final. La
auditoría no ejecuta tests, API, SQL ni DB; solo lee manifiestos, logs y fuentes.