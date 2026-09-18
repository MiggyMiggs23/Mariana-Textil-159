# E10 — autorización operativa textual

Autorización recibida el 2026-09-18 y registrada antes de la primera escritura
de esta fase sobre la base de datos.

## Texto del propietario

> Recibido el nuevo punto de comparación 80eaa93d. A partir de aquí, cualquier rojo nuevo lo trajo la entrega que lo produjo.
>
> Autorizo aplicar el SQL operativo de E10 sobre heliumdb, con las sentencias exactas de reports/e10-aislado-2026-09-18/sql/operativo.sql, tal como fueron ensayadas.
>
> Mismas condiciones que en E1:
>
> 1. Confirma la identidad desde el pool del proceso de la API antes del primer DDL. La API está corriendo, así que esta vez el proceso existe.
> 2. Supervisor activo con su límite. Si se agota, interrumpe antes de COMMIT y revierte.
> 3. Si se pierde la respuesta después de COMMIT, verifica el resultado real. No presumas rollback ni repitas a ciegas.
> 4. Guarda esta autorización en reports/ antes de la primera escritura, con el alcance exacto.
> 5. Revalida inmediatamente antes de ejecutar que la operativa está como esperas y sin objetos de E10. Si algo difiere, detente.
> 6. Respaldo nuevo antes, verificado por restauración y con SHA-256 comprobado en Drive. Desde el último se aplicó la migración de E1 y se instalaron las tres guardas.
> 7. Conserva la copia aislada y el respaldo hasta que E10 cierre.
>
> Dime si hace falta pausar la API para esto. En E1 la pausamos porque los productores adaptados rechazarían inserciones del código viejo. Aquí el Fondo es estructura nueva que nadie está usando todavía, así que puede que no aplique. Decídelo tú y explícame por qué.

## Alcance exacto

- Destino autorizado: únicamente `heliumdb`, previa identidad actual obtenida
  desde el pool del proceso vivo de la API y cotejada con la conexión ejecutora.
- Archivo SQL autorizado: `reports/e10-aislado-2026-09-18/sql/operativo.sql`.
- SHA-256 verificado antes de preparar la ejecución:
  `a7eb52a85b3b3b6072d1b88941b9998bcafe15b253e52b0520b8bfc8cc43cdb4`.
- Se autoriza exclusivamente el SQL exacto de ese archivo, con sus límites
  transaccionales; no otras migraciones, DDL de E1 ni cambios de sus guardas.
- La ejecución queda condicionada a completar todas las verificaciones
  anteriores, documentar límites del supervisor y detenerse ante discrepancias.
- No autoriza saldo inicial real, movimientos de Fondo, arqueos, usuarios,
  sesiones, activación del Fondo ni E9/E12. No se ejecutarán fixtures.
- Conservar el respaldo nuevo y la copia aislada existente hasta el cierre E10.
- Línea base de código aceptada:
  `80eaa93d4300e86d9be54492e634f88f0c0abc90`.