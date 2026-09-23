---
name: Registro nativo sin aislamiento interno
description: Evitar el ciclo entre evaluación ESM y Promises de node:test al ejecutar cada suite en un hijo externo.
---

Con `--test-isolation=none`, no esperar la Promise de un test nativo durante la evaluación del módulo. Registrar los casos y dejar el cierre de recursos para hooks posteriores.

**Why:** El runner de Node espera que termine el import antes de finalizar su bootstrap; los tests esperan ese bootstrap. Un `await test(...)` top-level que a su vez espera `node:test` produce un ciclo. El proceso puede seguir vivo por el pool sin emitir terminales. La dependencia se confirmó leyendo los módulos internos del Node instalado.

**How to apply:** Antes de convertir un harness secuencial, comprobar que no hay efectos top-level intercalados que dependan de casos anteriores. Conservar ejecución secuencial y errores originales, mover cleanup a `after` y exigir terminales reales, no el éxito sintético del archivo. Si cada ruta ya tiene un hijo externo propio, desactivar el segundo aislamiento interno no comparte pools entre suites.