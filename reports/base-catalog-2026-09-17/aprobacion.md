# Autorización del propietario — catálogo Base

Transcripción del alcance autorizado en la conversación del 17 de septiembre de 2026:

> Apruebo la desactivación de los 12 candidatos, exactamente estos y ninguno más:
>
> BOM-BAS, DUB-BAS2, GABCAM-BAS, GABDUC-BAS, LICMET-BAS, MIC-BAS, POL-BAS, SOC-BAS, TUL15-BAS, TUL70-BAS, TULEST-BAS, TULGLI-BAS.
>
> Los cuatro protegidos —ENC-BAS, FRACILBAB-BAS, MAN-BAS y PIQVER-BAS— permanecen activos.
>
> Antes de ejecutar, toma un respaldo nuevo.
>
> Respaldo con el API pausado, verificado por restauración contra la base desechable, subido a Drive con comprobación del SHA-256 de la copia descargada. Igual que en el Prompt H.
>
> Revalida los conteos inmediatamente antes: 1,234 productos activos, 16 coincidencias con Base, 1,010 productos con historial y 1,016 filas en precio_historial. Si alguno difiere, detente y repórtalo.
>
> Una sola transacción. Si algo falla, revierte todo.
>
> Solo activo = false sobre esos 12 SKU. No borres ninguna fila, no toques precio_historial, no toques ningún otro producto.
>
> Auditoría individual de cada cambio con sus valores antes y después.
>
> Revalida después: 1,222 activos, y los conteos de historial idénticos a la línea base.
>
> Confirma que los cuatro protegidos siguen activos.

El respaldo protege el estado actual posterior a la purga, incluidas las cargas, ventas, abonos y cambios de serie posteriores. La anterioridad del respaldo de la purga era correcta para aquella operación; no lo convierte en una referencia actual.

No se autoriza purga, eliminación de filas, cambios de precios ni la reanudación de tareas detenidas.