# E1 — autorización del ensayo en el clon desechable

Registrada antes de ejecutar el ensayo o escribir sus fixtures.

## Texto del propietario

> Haz ese ensayo en el clon desechable, no en la base operativa. Ahí puedes escribir sin restricción: son datos de una copia y se desecha después.
>
> Preséntame antes el script y el alcance, con:
>
> • Qué productor ejercita cada caso, y que estén los siete.
> • Qué escribe exactamente y con qué datos.
> • Qué comprueba: que un movimiento con contrato completo se acepta, y que uno sin origen, sin naturaleza o con naturaleza incompatible se rechaza.
> • Que la clave de operación devuelve el resultado original con los mismos datos y rechaza por conflicto con datos distintos.
> • Que un productor simulando código antiguo, sin los campos nuevos, es rechazado.
> • Que las capturas deshabilitadas —efectivo, cobros retenidos, atribución histórica— siguen sin poder activarse por ninguna vía.
>
> Si el ensayo exige escribir en la base operativa por algo que el clon no pueda reproducir, dime exactamente qué y por qué, antes de pedir esa autorización. Es distinta y la evaluaría aparte.
>
> Con el clon, la autorización es esta misma: puedes escribir libremente ahí. Adelante.

## Alcance vigente

- La autorización de escritura se limita al clon desechable existente, `restore_disposable_20260917165108-3655`, accesible por su socket local privado `/tmp/prompt-h-block2-20260917165108-3655-3655`.
- Sustituye las restricciones anteriores de escritura, fixtures e identidades de prueba **solamente dentro de ese clon**. Permite preparar datos sintéticos y ejecutar productores reales con PostgreSQL.
- No autoriza conexiones de escritura a la base operativa, reanudación de la API, activación operativa de capturas ni cambios del respaldo local o de Drive.
- Antes de la ejecución se presentarán el script y su alcance concreto, con casos, fixtures y aserciones. La autorización ya está concedida; no se presume una autorización adicional para la base operativa.
- Se conservarán resultados y trazas del ensayo. No se requiere borrar el clon para probar los productores; se mantendrá disponible para inspeccionar los resultados.
- Si aparece una dependencia que exigiera escribir fuera del clon, detenerse y explicar exactamente la necesidad antes de solicitar otra autorización.