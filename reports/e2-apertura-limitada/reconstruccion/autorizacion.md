# Autorización de reconstrucción aislada

El propietario ordenó:

> No busques el bundle anterior: no existe copia. Reconstrúyelo desde su commit
> verificado y comprueba que el resultado sea el esperado. Dime qué commit vas a
> usar y su hash antes de construir. Si al construir el hash no coincide con lo
> esperado, detente y repórtalo.

Antes de construir, el agente principal informó:

- commit limpio verificado en E10:
  `7cb77f8cfc6287fa51325a25122c48af392a7ada`;
- SHA-256 esperado de `dist/index.mjs`:
  `655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2`;
- limitación: la evidencia disponible no vinculaba históricamente ese commit al
  bundle; la comparación estricta de la reconstrucción debía comprobarlo.

Alcance ejecutado: una sola compilación aislada y comparación del hash. No
autorizaba instalar dependencias, sustituir el `dist` activo, arrancar servicios,
consultar/escribir bases ni probar otros commits.