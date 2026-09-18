# Apertura limitada y arranque acotado — autorización de preparación

## Instrucción textual del propietario

> Y sobre la apertura limitada: autorizo prepararla, con estas condiciones:
>
> • Solo ABONO / INGRESO_FISICO / EFECTIVO, con sesión abierta y sitio correctos.
> • Devolución física, cobros retenidos y atribución histórica siguen cerrados.
> • No se enciende ningún booleano global que abra ingreso y devolución juntos: los dos permisos quedan separados en la aplicación.
> • La reversión debe volver a bloquear capturas nuevas sin borrar abonos legítimos ya recibidos.
>
> Presenta el SQL exacto, la revisión del código, las comprobaciones y la reversión antes de aplicar nada. La ejecución se autoriza aparte, como en E1 y E10.
>
> Y de acuerdo en no reiniciar la API de forma indiscriminada. Prepara ese arranque acotado sin inicializadores ni backfills, con comprobación previa de esquema que falle si falta algo, y preséntamelo junto con lo demás.

## Límite vigente

- Se autoriza preparar código, SQL, documentación y comprobaciones offline.
- No se autoriza ejecutar el SQL, activar capturas, escribir en ninguna base, crear usuarios/sesiones de ensayo, cambiar variables del entorno ni reiniciar servicios.
- El propietario generará el primer corte histórico con las operaciones actualmente habilitadas. No se alterarán el bundle API en ejecución ni la interfaz servida durante esa referencia.
- Ambos permisos de efectivo permanecen cerrados en el código preparado por defecto. La apertura posterior es una acción separada y revisable.
- Tampoco se autoriza aplicar las tablas de soporte de devolución E2, abrir retenidos/atribución, modificar FIFO/proyección/límites ni avanzar otros alcances E3–E12.
- Cualquier ejecución futura requiere identidad del entorno, revisión y hashes exactos, evidencia previa y autorización textual adicional guardada antes de la primera escritura.