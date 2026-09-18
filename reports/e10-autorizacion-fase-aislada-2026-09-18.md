# E10 — Autorización textual de fase aislada

## Respuesta del propietario

Pregunta: «¿Autorizas únicamente la fase aislada de E10 descrita en el informe?»

Respuesta seleccionada: **«Autorizo sólo la fase aislada descrita»** (`autorizo_fase_aislada`).

Alcance referenciado: `reports/e10-bloque-0-y-alcance-propuesto-2026-09-18.md`.

Comentario textual del propietario:

> 1. Cero conexiones a heliumdb para escritura. Si necesitas leer de la operativa para comparar, dilo antes y que sea solo lectura.
> 2. No crees usuarios ni sesiones, ni siquiera en la copia aislada.
> 3. La copia se identifica por su socket y nombre exactos, como hiciste en E1, y el arnés rechaza cualquier otro destino.
> 4. Conserva la copia hasta que E10 cierre completo.
>
> Lo que quiero ver en el ensayo, además de lo que ya planteaste:
>
> • Saldo e historial conciliados al centavo: la suma de los movimientos da el saldo exacto.
> • Arqueo con sobrante y con faltante, y la diferencia persistida — que no desaparezca al cerrar.
> • Una corrección por inverso, comprobando que el original se conserva.
> • Que ningún movimiento del Fondo cambia Ventas, Contado cobrado, cobranza ni deuda de clientes. Compruébalo antes y después.
> • Que el Fondo es siempre Mariana, incluso manipulando la solicitud para pedir otra ubicación.
> • Que solo ADMIN obtiene datos, probado también sobre endpoints y exportaciones, no solo sobre la pantalla.
>
> Guarda esta autorización en reports/ antes de la primera escritura.
>
> Cuando termines, preséntame el resultado con sus tiempos medidos y el SQL operativo. La aplicación a heliumdb requiere autorización separada, igual que en E1.

## Fronteras de ejecución

- Este archivo se guarda antes de cualquier escritura de base de esta fase.
- Se anunció previamente al propietario la lectura de la operativa para identificación, respaldo consistente y comparación. Toda conexión que abra este trabajo a la operativa deberá forzar modo de solo lectura.
- Restaurar identidades existentes del respaldo no habilita altas, cambios de cuentas, credenciales o roles. No copiar filas de sesiones de autenticación ni fabricar sesiones. No ejecutar seeds de usuarios ni suites que los creen.
- No arrancar ni reiniciar la API operativa. No ejecutar en ella DDL, inicializadores, fixtures, login ni escrituras E10.
- Fijar socket, puerto interno y nombre exactos de la copia en un manifiesto antes de la migración/ensayo; validar también la identidad efectiva desde la conexión. Rechazar cualquier destino distinto.
- Conservar respaldo local y copia aislada hasta el cierre completo de E10. No modificar el clon conservado de E1 ni Drive.
- El SQL operativo se entrega como archivo para revisión; **no se aplica** con esta autorización.
- No habilitar Fondo operativo ni E9/E12. El saldo inicial real corresponde al propietario.