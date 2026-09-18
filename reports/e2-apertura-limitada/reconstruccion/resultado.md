# Resultado de la reconstrucción

## Dictamen

**STOP: EL HASH NO COINCIDIÓ.**

La única compilación aislada terminó correctamente (`exit 0`), pero produjo:

`3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`

El valor autorizado esperado era:

`655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2`

Conforme a la orden del propietario, se detuvo el procedimiento inmediatamente.
No se intentó normalizar la salida, reconstruir otra vez ni probar otro commit.
El resultado aislado se conserva en:

`.local/e2-rebuild-7cb/workspace/artifacts/api-server/dist/`

## Integridad del árbol activo

El `artifacts/api-server/dist/index.mjs` activo no se tocó. Su hash antes y
después fue:

`75d1e77f34e040af2c05e86befd6e2a6f288ca5fa5683f52a2919651c31794b9`

## Acciones no realizadas

- no se copió el candidato sobre el `dist` activo;
- no se arrancó ni configuró API o frontend;
- no se ejecutó preflight de base ni se conectó a una base;
- no se ejecutó SQL, inicializador, backfill o poller;
- no se instalaron dependencias;
- no se compiló otro commit ni se repitió la compilación.

Los archivos `build-result.txt`, `build.stdout.txt`, `build.stderr.txt`,
`source-and-dependencies.txt`, `isolated-dist-files.txt` e
`isolated-dist.sha256` contienen la evidencia reproducible de esta única pasada.