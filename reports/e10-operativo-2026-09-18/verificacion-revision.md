# E10 — verificación de revisión exacta

Fecha: 18 de septiembre de 2026.

- Revisión comprobada: `7cb77f8cfc6287fa51325a25122c48af392a7ada`.
- Árbol comprobado: `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`.
- Base anterior aceptada: `80eaa93d4300e86d9be54492e634f88f0c0abc90`.
- El árbol estaba limpio al ejecutar y terminar las comprobaciones. Este
  informe es evidencia posterior; no se atribuye el resultado a otro commit.

## Typecheck completo

`pnpm run typecheck`: salida terminal 0, **PASS**.

- Cuatro paquetes de artifacts/scripts y siete resultados de librerías.
- Cero diagnósticos TypeScript únicos o repetidos.
- Cero fallos de proceso/parser.
- Se completaron todos los controles seleccionados; sin descontar errores E1
  ni invocar una supuesta condición preexistente.
- Log: `typecheck-completo.log`.
- SHA-256 del log:
  `4426a7a9dbaebe702a1076ecc89e01ddff5f6480d5dd478bdfb3efd0cb34c97a`.

## Comprobaciones offline del operador

`node --test scripts/src/e10-operational-runner.test.mjs`: salida 0,
5 pruebas aprobadas, cero fallos, omisiones o cancelaciones.

Estas pruebas son offline: no se presentan como un ensayo real del disparo
del supervisor a los 30 segundos contra una base de datos.
La ejecución operativa sí acreditó supervisor independiente activo,
permisos antes de las sentencias y desaparición del backend antes de
desarmarlo; no agotó su límite.

- Log: `operador-offline.log`.
- SHA-256:
  `acf46628749dfed34ca23a4ce8564b2a256cda27c633512c2fbaaad35ba2244f`.
- Operador ejecutado y comprobado:
  `7d281592cf2a07275424a507a1f41f0b4e7700c963fbbaa85683bddcd9f32a2d`.

## Herramientas y dependencias

- Node v24.13.0; pnpm 10.26.1; TypeScript 5.9.3.
- `pnpm-lock.yaml` SHA-256:
  `a7a54d756eb12b9f33e6bec8d70872026de72bee9567aa640a021324a0fcbc6d`.
- No se instalaron ni actualizaron dependencias.
- No hubo archivos fuente no versionados que alteraran estas comprobaciones.
- La API y las banderas del Fondo no se reiniciaron ni modificaron.

Una nota Git en la revisión comprobada conserva este vínculo y los logs
completos. El informe operativo y la evidencia de Drive se conservan por
separado; no se confunden con una prueba funcional de la aplicación.