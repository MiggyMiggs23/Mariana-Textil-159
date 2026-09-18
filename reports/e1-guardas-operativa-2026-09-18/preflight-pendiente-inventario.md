# Aclaración requerida antes de abrir la ventana de identidad

## Estado

**Preparación únicamente. No se arrancó la API, no se cambiaron variables de entorno ni se abrió una conexión a la base durante esta preparación. No hubo DDL ni escrituras operativas.**

La ampliación de autorización está guardada en `autorizacion-ventana-e-instalacion.md`. Los efectos previstos del arranque normal se anunciaron antes de iniciarlo. La ventana aún no se abrió.

## Diferencia encontrada en la referencia documental

El propietario exige revalidar «27 objetos E1» y detenerse ante diferencias. La evidencia de la migración aplicada indica **27 sentencias SQL**, desde S01 BEGIN hasta S27 COMMIT. No acredita un catálogo de 27 objetos.

El inventario guardado de la migración contiene estos objetos con sufijo `_e1`, aplicando el criterio de catálogo usado por su preflight:

| Familia | Cantidad |
|---|---:|
| Relaciones: tres tablas, cinco índices y una vista | 9 |
| Funciones | 5 |
| Tipos, incluidos tipos de fila y arrays implícitos | 10 |
| Triggers no internos | 6 |
| Restricciones | 30 |
| **Total** | **60** |

Se conserva la lista completa en `inventario-e1-referencia.json`, SHA-256 `d2512753ad9279e0c604c9d77e9357b14f7b8645791be8205db15d0b5762512e`. Se cotejaron los nombres contra `reports/e1-ensayo-2026-09-17/migrated.json` y las huellas de siete categorías de catálogo contra `reports/e1-ejecucion-2026-09-17/ejecucion-after-name-array.json`, el informe de la migración efectivamente confirmada.

**Esto no demuestra que haya cambiado la base actual.** Es una discrepancia entre la cantidad literal solicitada y la referencia documental; no se consultó el estado operativo actual ni se reinterpretó la autorización.

## Aclaración resuelta por el propietario

El propietario confirmó que debe usarse el **inventario completo de la migración aplicada**, con los 60 objetos enumerados y sus definiciones, además de las siete columnas E1 y el resto de comprobaciones de conservación. La instalación autorizada sigue limitada a las mismas tres funciones y tres triggers removibles; no se amplía el DDL.

La aclaración documental está resuelta. La ventana y el DDL aún requieren las verificaciones previas y posteriores detalladas en `autorizacion-ventana-e-instalacion.md`, incluida la condición adicional de **cero inserciones del backfill de compras a proveedores**.

## Preparación conservada, no ejecutada

- Bloqueo HTTP temporal e inspector del pool real: `.local/e1-identity-window-preload.cjs` y `.local/e1-identity-window.mjs`; comprobados sólo sintácticamente.
- `scripts/src/e1-operational-guards.mts`: captura READ ONLY preparada; `--execute` permanece bloqueado.
- `scripts/src/e1-operational-guard-probes.mts`: 15 controles preparados, no ejecutados; sin usuarios de prueba, sin retiros de guardas y con fixtures transaccionales de IDs explícitos que deben revertirse.

No se afirma que estas herramientas nuevas hayan pasado un ensayo operativo.