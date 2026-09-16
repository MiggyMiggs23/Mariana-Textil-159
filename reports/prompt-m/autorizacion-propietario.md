# Prompt M — autorización textual del propietario

Pregunta presentada:

> ¿Qué cambios de default autorizas para el Prompt M?

Alcance mostrado:

> Guardaré tu respuesta textual antes de escribir. Los ALTER autorizados se ejecutarán en una sola transacción, sin modificar valores de filas existentes. Las pruebas de inserción serán únicamente en una base desechable.

Respuesta textual del propietario:

> Autorizo los tres: entradas a 0, salidas a 0 y series a 10000000

Comentarios adicionales: no proporcionados.

Identificador de la respuesta:
`inv_18wN1nIEeAOk7uaV9Ucw43Bh82hkd6whix:call_4pGu72nKuUfJVmXnnAsqHOQc`

Esta autorización se guarda antes de ejecutar cualquier escritura del Prompt M.

SQL autorizado, dentro de una sola transacción:

```sql
ALTER TABLE public.entrada_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.salida_folio ALTER COLUMN ultimo_folio SET DEFAULT 0;
ALTER TABLE public.series_consecutivo ALTER COLUMN ultimo_numero SET DEFAULT 10000000;
```

No autoriza modificar filas existentes, otros defaults, usuarios, sesiones o inicializadores. No se utilizará `drizzle-kit push`.