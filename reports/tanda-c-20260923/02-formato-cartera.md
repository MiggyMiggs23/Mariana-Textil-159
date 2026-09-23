# Tarea 2 — formato XLSX de cartera (S-26)

## Corrección productiva

`artifacts/api-server/src/lib/clientes-cartera-export.ts:35-55` define la hoja
`Cartera` y convierten `saldoAFavor` a número para el alcance global. La columna
tenía tipo numérico, pero no recibía `numFmt`. Se agregó en la línea 45 el mismo
`EXCEL_NUMBER_FORMAT.money` que usan las demás columnas monetarias.

## Regresión unitaria sin DB

`artifacts/api-server/src/lib/clientes-cartera-read-model.test.ts:138-150`
genera el modelo global mediante las dependencias de memoria existentes,
serializa un XLSX real con ExcelJS, vuelve a abrirlo y comprueba:

- `C2` conserva el valor numérico real `0`.
- `C2.numFmt` es `"$"#,##0.00`.
- La columna 3 completa conserva ese formato monetario.

Prueba ejecutada:

```text
cd artifacts/api-server && pnpm exec tsx --test src/lib/clientes-cartera-read-model.test.ts
tests 5; pass 5; fail 0
```

No se ejecutó `security-api.test.ts`, ninguna integración, DB/SQL, red, API,
workflow, reinicio, bundle ni gate; esa validación queda para la tarea 3 de
MAIN.