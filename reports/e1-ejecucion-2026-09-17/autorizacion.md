# E1 — autorización textual de migración operativa y continuación de código

Registrada antes de cualquier escritura operativa de esta entrega, el 17 de septiembre de 2026.

## Texto del propietario

> 1. La API permanece pausada durante la ejecución y después de ella. Tú mismo lo señalaste: instalar el DDL no adapta los productores actuales y sus inserciones serían rechazadas. No reanudes la operación hasta que el código esté adaptado y verificado.
> 2. Con el supervisor de 30 segundos activo, el que ya probaste. Si se agota, interrumpe antes de COMMIT y revierte.
> 3. Si se pierde la respuesta después de enviar COMMIT, verifica el resultado real. No presumas rollback ni repitas a ciegas, como planteaste.
> 4. Guarda esta autorización en reports/ antes de la primera escritura, con el alcance: las 27 sentencias de migración, sobre heliumdb, sin recapturas, sin atribución de históricos y sin activar ninguna captura.
> 5. Revalida inmediatamente antes de ejecutar que la base sigue idéntica al respaldo y con cero objetos E1. Si algo difiere, detente.
> 6. Conserva el clon desechable y el respaldo de Drive hasta que E1 cierre completo.
>
> Verificación posterior: las 27 sentencias aplicadas; los tres movimientos de crédito intactos en importe, fecha y contenido; las 63 tablas y 17 triggers conservados más los objetos nuevos; ninguna captura activada; y el tiempo real de ejecución medido.
>
> Después de la migración, continúa con la implementación del código de E1. Repórtame cuando el sistema esté listo para reanudar la API, y hasta entonces no la reanudes.

## Alcance inequívoco

- Únicamente las 27 sentencias de `reports/e1-ensayo-2026-09-17/operativo-propuesto/01.sql`.
- SHA-256 autorizado: `680f8f4d339d20775dabeb540c43d4945391652f1eabd6e0162f3a1ca48ce57f`.
- Destino: `heliumdb/public`, identidad acreditada en `reports/e1-ensayo-2026-09-17/api-pool-identity.json`.
- Referencia: respaldo SHA-256 `583ac96297ca40573aa96249e2b25de68812f98bd7b675214473932fe81f2925`, con restauración y descarga de Drive verificadas.
- Sin recapturas, atribución real de históricos, semillas, usuarios o sesiones de prueba, activación de capturas ni reanudación de la API.
- No se autoriza ejecutar las 28 sentencias de reversión operativa. Un fallo antes del COMMIT permite únicamente revertir la transacción sin confirmar.
- La implementación posterior conserva el alcance E1 y las restricciones previamente aprobadas; no habilita E2–E12.
- El respaldo de Drive y el clon desechable se conservan hasta cerrar E1 completo.