---
name: Precedencia de operadores JSON en SQL
description: Parentetizar la extracción JSON antes de aplicar operadores de resta u otros operadores sobre el valor extraído.
---

En PostgreSQL, una expresión compacta como
`d->'investigacion'-ARRAY['estado','cierre']` puede asociarse de forma distinta
a la intención y convertir el literal `investigacion` a `jsonb`, produciendo
`22P02`.

**Why:** El operador `->` y la resta sobre JSONB/arreglos comparten una expresión
cuya resolución de operadores y coerciones no documenta visualmente el objeto
intermedio. El valor equivocado puede aparecer como token JSON inválido aunque
los datos guardados sean correctos.

**How to apply:** Materializar la intención con paréntesis:
`((d->'investigacion')-ARRAY['estado','cierre'])`. Ante `22P02`, capturar el
valor exacto que PostgreSQL intentó convertir y el tipo esperado antes de tocar
datos o casts. Reproducir la transición completa con el productor real en una
base desechable; una prueba pura del fragmento no acredita triggers, auditoría
ni rollback.