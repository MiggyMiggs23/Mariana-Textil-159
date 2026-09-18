# Protocolo de reconstrucción aislada

- Fuente extraída con `git archive` del commit exacto
  `7cb77f8cfc6287fa51325a25122c48af392a7ada` a
  `.local/e2-rebuild-7cb/workspace`.
- Árbol Git: `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`.
- Node: `v24.13.0`; pnpm: `10.26.1`.
- Lockfile SHA-256:
  `a7a54d756eb12b9f33e6bec8d70872026de72bee9567aa640a021324a0fcbc6d`.
- `build.mjs` SHA-256:
  `45c45660b2e07faf9e0d45c2165ed1b0127431c810154a7cba33666a427fc588`.
- El almacén externo `node_modules` se copió mediante hardlinks dentro del árbol
  aislado. Los enlaces relativos `@workspace/db` y `@workspace/api-zod` se
  comprobaron contra los paquetes del mismo `git archive`, no contra la fuente
  activa.
- No se instalaron ni actualizaron dependencias.
- Única invocación:
  `env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production node ./build.mjs`,
  desde el paquete API aislado.
- `build.mjs` solo ejecutó esbuild y copió las fuentes tipográficas al `dist`
  aislado. No se importó ni ejecutó `src/index.ts`.
- Salida, errores, inventario y hashes del `dist` aislado se conservaron en este
  directorio.
- El hash del `dist` activo se comprobó antes y después para confirmar que no fue
  sustituido.

No se hizo normalización, segunda compilación ni prueba con otro commit después
de la discrepancia.