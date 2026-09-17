# Prompt O — verificación AFTER

Estado: **PASS_AFTER_READONLY** para la reproducción compilada de fuente.

## Comando ejecutado

```text
TZ=America/Mexico_City artifacts/api-server/node_modules/.bin/tsx scripts/src/prompt-o-after-readonly.ts
```

El script ejecutado fue preparado como una compuerta posterior al cambio:

- usa el pool efectivo de `@workspace/db`;
- ejecuta una única transacción `REPEATABLE READ READ ONLY`;
- hace rollback y no realiza escrituras;
- no inicia/reinicia la API;
- no crea, autentica ni renueva sesiones;
- no imprime PII ni credenciales.

La ejecución observó DB `heliumdb`, esquema `public`, `transaction_read_only=on`
y aislamiento `repeatable read`.

## Nota real y cuatro representaciones

Se verificó una vez la misma nota real: ticket `106`, folio `1000`.
La fecha de base es `2026-10-16`.

El schema generado actual para
`GetClienteNotaCreditoResponse.shape.fechaVencimiento` conserva un string
validado como día `YYYY-MM-DD` (sin coerción a instante). La proyección de
impresión también conserva el mismo string.

| Paso | Valor exacto |
| --- | --- |
| Base, día de calendario | `2026-10-16` |
| Endpoint/source-compiled, campo serializado | `2026-10-16` |
| Componente/formateador compartido | `16/10/2026` |
| Impresión sin cambios | `16/10/2026` |

Resultado ejecutado: `screenFormatted === printFormatted` es `true`.
No aparece `T` ni `Z` en el camino posterior.

## Bordes ejecutados contra schema y formateador actuales

Con `TZ=America/Mexico_City`, los tres casos pasaron conservando el string:

| Caso | Entrada | Schema | Formato |
| --- | --- | --- | --- |
| Día 1 | `2026-09-01` | `2026-09-01` | `01/09/2026` |
| Último día | `2026-09-30` | `2026-09-30` | `30/09/2026` |
| Hoy en Ciudad de México | `2026-09-16` | `2026-09-16` | `16/09/2026` |

## Límite

El backend no fue activado después del cambio, por lo que esto es evidencia de
la fuente compilada, del schema generado actual, del formatter compartido y de
la proyección de impresión dentro de la transacción READONLY; **no** es una
observación HTTP viva ni una aprobación de navegador. La sesión no estuvo
disponible y no se intentó crearla ni renovarla.