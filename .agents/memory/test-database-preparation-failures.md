---
name: Preparación DB sin verdes falsos
description: Fallos no obvios de CLI e idempotencia SQL que pueden hacer parecer completa una base de pruebas parcial.
---

No confiar exclusivamente en el código de salida de una herramienta de schema. Rechazar también errores explícitos en stdout/stderr y comprobar el resultado estructural antes de continuar al seed.

**Why:** La versión usada de Drizzle Kit imprimió un error porque un prompt requería TTY, pero terminó con status 0 y permitió que el orquestador avanzara.

**How to apply:** Capturar la salida de cada paso de preparación, tratar marcadores de error como fallo aunque el status sea 0 y verificar tablas/constraints mínimas antes del siguiente paso.

`ADD COLUMN IF NOT EXISTS columna ... REFERENCES ...` no agrega la FK si la columna ya existía: PostgreSQL omite toda la definición de columna.

**Why:** Un schema push creó la columna sin que el inicializador pudiera reconciliar la referencia declarada dentro de `ADD COLUMN`.

**How to apply:** Crear la columna y la FK en sentencias idempotentes separadas; detectar la relación por catálogos, no solo por nombre, y validar antes de commit.