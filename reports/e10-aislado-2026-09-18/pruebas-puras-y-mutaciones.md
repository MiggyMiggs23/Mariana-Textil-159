# E10 — pruebas puras y comprobación por mutaciones

No se abrió una base ni se crearon usuarios/sesiones. `artifacts/api-server/src/lib/fondo.test.ts` importa sólo el servicio inyectable y cubre aritmética exacta con `bigint`, rechazo de representaciones no canónicas y canonicalización estable de payload idempotente.

## Mutaciones que deben hacer fallar las pruebas

Ejecutar sólo en una copia de trabajo, con red bloqueada:

1. Cambiar `* 100n` por `* 10n` en `parseMoney`: falla la ida/vuelta exacta.
2. Permitir `^-?` en `MONEY`: falla el caso `-1.00`.
3. Quitar `.sort(...)` de `canonicalPayload`: falla la igualdad con distinto orden de inserción.
4. Excluir `importe` del payload antes del hash (mutación futura de helper): el caso de contenido diferente debe fallar.
5. Quitar el guard obligatorio dentro de `createFondoRouter` que comprueba `req.auth.user.rol === "ADMIN"`: el arnés de rutas debe montar `authorizeAdmin: []`, inyectar contexto no-ADMIN y comprobar `403` sin ninguna llamada al pool. Este mutante es independiente del segundo mutante que elimina `requireRole("ADMIN")` del montaje productivo; ambos guards deben quedar cubiertos.

Comando puro ejecutado mediante Node test runner + `tsx` y `scripts/src/offline-test-guard.cjs`, con entorno hijo sanitizado y URL inválida: 6/6 PASS en 571 ms de pared. Se ejecutaron seis mutantes reales en árboles temporales: escala monetaria, signo monetario, orden del payload, prueba inicial, prefijo CSV y guard ADMIN; los seis dieron RED de aserción sin fallos de parse/import. Matriz y tiempos completos: `backend-schema-contract-resultado.md`.

No requiere ni debe recibir una URL de DB real; el módulo Fondo no importa el singleton DB. Las pruebas de router/servicio con PostgreSQL corresponden al arnés aislado del propietario.