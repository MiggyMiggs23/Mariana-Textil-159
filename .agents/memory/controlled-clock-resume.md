---
name: Reanudación de pruebas con reloj controlado
description: Coherencia entre reloj de negocio, autenticación, PostgreSQL y procesos auxiliares en ensayos.
---

# Reanudación de pruebas con reloj controlado

## Why

Una simulación que cambia el reloj de procesos puede invertir fechas si una prueba de preparación restablece el reloj al reanudar una base ya avanzada. Un timeout del arnés no demuestra un defecto de producto; corregir después sus timestamps borraría la evidencia del problema.

## How

Ejecutar la prueba del reloj sólo antes de iniciar una copia fresca. Conservar un cursor durable y avanzar únicamente hacia fechas posteriores; dividir recorridos largos en tramos con pausa en límites diarios. No restablecer el reloj de una fecha ya en curso al reanudar. Si la historia quedó contaminada, archivar íntegro el intento y repetir desde una restauración fresca, sin mezclar resultados. Verificar orden de timestamps y conciliaciones finales antes de declarar PASS; conservar temporizadores monotónicos reales para los límites del arnés.

## Reloj de negocio frente a reloj de sesión

No adelantar globalmente Date para cerrar períodos cuando PostgreSQL conserva su reloj real. Separar el reloj evaluador de períodos del reloj de autenticación; los procesos auxiliares no deben heredar un reloj simulado sin intención explícita.

**Why:** El login puede crear una sesión con fecha SQL real y rechazarla inmediatamente porque el reloj JavaScript adelantado la considera expirada. Un preload heredado por el worker de logging también puede terminar el servidor antes de probar el negocio.

**How to apply:** Diseñar una inyección de reloj limitada al cálculo temporal que se prueba, identificarla como simulación y conservar el reloj real de sesiones y límites de ejecución. No presentar una prueba instrumentada como una observación natural del bundle publicado.