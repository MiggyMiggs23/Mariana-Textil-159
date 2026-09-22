# E9 — verificación MAIN, construcción OFF

## Resultado

- Backend: **58/58** ciclos verde/defecto semántico/verde restaurado.
  Proceso terminado, exit 0, manifiesto `status:PASS`.
  `logs/backend-2026-09-22T21-27-12.909Z/manifest.json`.
- Interfaz: **59/59** ciclos sobre componentes montados reales.
  Proceso terminado, exit 0, manifiesto `PASS_E9_UI_MUTATIONS`,
  terminado `2026-09-22T21:34:15.226Z`.
  `frontend-node-mutants-2026-09-22T21-27-16.625Z/manifest.json`.
- Typecheck API y frontend: exit 0. API sin emisión y build-info en `/tmp`;
  frontend contra fuentes actuales, referencias de proyecto vacías en memoria,
  sin emitir `dist`. Se conservaron también errores de configuración como
  diagnósticos, no solamente errores del programa.
- Vista previa básica: pantalla de acceso renderizada sin iniciar sesión.
  Los 401 de consultas de sesión corresponden a la sesión no autenticada.
  No se presenta esta captura como verificación funcional de E9 ON.

## Aislamiento y límites

Ambos runners usaron copias físicas, guardias y mutantes independientes.
No se ejecutaron los casos contra la API activa ni su base. Backend sintético:
no prueba locks/concurrencia PostgreSQL ni aplicación del SQL preparado.
Interfaz: infraestructura de hooks controlada; no prueba transporte HTTP real.
Los manifiestos conservan los hashes y resultados individuales.

SQL y reversión siguen preparados, no ejecutados. E9 permanece OFF.
No se cambió el workflow, el bundle E2 ejecutado ni los paquetes E3 sellados.
La comparación del inventario protegido no encontró diferencias inesperadas:
solo se añadió el registro autorizado de reanudación API, con prefijo anterior
byte a byte conservado.

Los documentos de preparación y sus afirmaciones de «sin ejecutar» describen
la etapa previa; este informe registra las ejecuciones posteriores por MAIN.
El checkpoint de fuentes previo a la verificación era
`4f9de12`; no se reescribió ese historial automático.