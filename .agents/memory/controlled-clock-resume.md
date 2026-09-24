# Reanudación de pruebas con reloj controlado

## Why

Una simulación que cambia el reloj de procesos puede invertir fechas si una prueba de preparación restablece el reloj al reanudar una base ya avanzada. Un timeout del arnés no demuestra un defecto de producto; corregir después sus timestamps borraría la evidencia del problema.

## How

Ejecutar la prueba del reloj sólo antes de iniciar una copia fresca. Conservar un cursor durable y avanzar únicamente hacia fechas posteriores; dividir recorridos largos en tramos con pausa en límites diarios. No restablecer el reloj de una fecha ya en curso al reanudar. Si la historia quedó contaminada, archivar íntegro el intento y repetir desde una restauración fresca, sin mezclar resultados. Verificar orden de timestamps y conciliaciones finales antes de declarar PASS; conservar temporizadores monotónicos reales para los límites del arnés.