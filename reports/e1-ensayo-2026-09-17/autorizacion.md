# E1 — autorización de respaldo y ensayo, no de migración operativa

Fecha: 17 de septiembre de 2026.

## Instrucción textual del propietario

> Sobre la identidad: la API responde pero su proceso no es accesible desde tu sesión. En el Prompt H sí lograste obtener current_database() desde el pool del proceso de la API. Revisa cómo lo hiciste entonces y repítelo. Si esta vez no es posible, dime exactamente qué lo impide en vez de aceptar el antecedente documentado: ese antecedente es de hace días y no acredita la conexión efectiva de hoy.
>
> Sobre el respaldo: tómalo con el API pausado, verificado por restauración contra base desechable —60 tablas, conteos, huellas, columnas, restricciones, índices y los 14 triggers—, subido a Drive con comprobación del SHA-256 de la copia descargada. Igual que en el Prompt H y que en la desactivación del catálogo.
>
> Sobre los bloqueos, una pregunta que necesito resuelta antes de autorizar: dices que los límites de 2 y 15 segundos no acotan la duración total y que no hay duración medida. Con un bloqueo exclusivo del libro de crédito, eso importa.
>
> Dime qué pasa si la transacción se alarga: ¿queda la operación de crédito detenida mientras tanto? ¿Hay forma de acotar la duración total o de saber cuánto tardaría con el volumen actual? Recuerda que hoy son tres movimientos, así que probablemente sea instantáneo — pero quiero el dato, no la suposición.
>
> Y ejecuta el ensayo primero en el clon desechable, como hiciste con el catálogo. Ahí sí puedes medir la duración real y comprobar que las 28 sentencias de reversión funcionan. Con eso enfrente te doy la autorización.
>
> Resumen del orden: identidad confirmada hoy → respaldo nuevo verificado → ensayo en clon con duración medida → me presentas todo → autorización textual → ejecución.

## Alcance aplicado

- Se autoriza detener la API, leer la base efectiva, generar respaldo, restaurarlo en una base desechable, verificarlo y subirlo al Drive ya conectado con comprobación por descarga.
- Se autoriza ensayar el DDL y su reversión **únicamente en el clon desechable**, incluyendo un ensayo de cancelación para medir la liberación del bloqueo.
- No se crean identidades de aplicación ni fixtures de usuarios/sesiones. La restauración reproduce los registros existentes como parte del respaldo completo; no se ejecutan semillas ni las suites de creación de usuarios.
- **No se autoriza ejecutar la migración ni su reversión en la base operativa.**
- La lectura actual del pool encontró 63 tablas y 17 triggers: se verificará todo el catálogo actual, sin excluir las tres tablas adicionales de evidencia de auditoría ni sus tres triggers.
- No se reiniciará la API entre respaldo y decisión de ejecución; se mantiene la referencia protegida de inicializadores.