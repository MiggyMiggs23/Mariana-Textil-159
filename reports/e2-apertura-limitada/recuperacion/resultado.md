# Recuperación exclusiva del servicio anterior — detención preventiva

## Dictamen

**STOP / NO ARRANCADO.** La identidad y las tres guardas E1 coincidieron, pero
aparecieron dos condiciones contrarias a la autorización:

1. el bundle en disco ya no tiene el hash autorizado;
2. el intento automático de arranque normal posterior al reinicio sí produjo
   escrituras de inicialización.

No se arrancó la API. El workflow API quedó detenido. El frontend ya existente
continúa ejecutándose y no se reinició.

Autorización previa: `autorizacion.md`.

## Preflight de lectura

Lectura observada entre `2026-09-18 21:30:01+00` y
`2026-09-18 21:34:19+00` mediante la base de desarrollo administrada que aporta
las credenciales runtime de la aplicación. No se leyó el clon E10.

La identidad coincidió con la referencia operativa aceptada de
`reports/e10-operativo-2026-09-18/resultado-operativo.md`:

- base `heliumdb`;
- OID `16384`;
- esquema `public`;
- rol `postgres`;
- PostgreSQL `16.10`.

Las tres guardas están presentes, habilitadas y exactamente cerradas. En cada
caso se comprobaron tabla/función en `public`, `tgtype`, `tgenabled='O'`, cero
argumentos/atributos, ausencia de constraint/parent/qual, retorno `trigger`,
`plpgsql`, owner `postgres`, `SECURITY INVOKER`, volatilidad/parallel,
`proacl IS NULL`, `search_path=pg_catalog, public` y EXECUTE efectivo de
`PUBLIC` vía grantee OID 0 sin grant option.

| Guarda | Tipo trigger | SHA-256 de `prosrc` | Resultado |
|---|---:|---|---|
| E1C01 efectivo | 5 | `994ad4041bf1f8d96e0dbafcb81f07829d915f32598b4fd3721560c77461c6fd` | exacta/cerrada |
| E1P01 retenidos | 4 | `50840f6e50fd29907e4458a55170599877512db315b659dba10ff4f1c41ef5c5` | exacta/cerrada |
| E1A01 atribución | 4 | `25f74b9765fef1eb3578915706fe7bd8bece469d20ced5ed9cd67e4cbb5e8365` | exacta/cerrada |

El inventario actual (`69` tablas, `34` triggers no internos y `62` funciones
en `public`) es compatible con los objetos E1 más la instalación E10 ya
autorizada y verificada: E10 añadió tres tablas, ocho triggers y cuatro
funciones. `evidencia_no_aplicada_e2` y la tabla de devolución no existen. Fondo
mantiene cero movimientos y cero arqueos.

## Estado transaccional y operaciones

En las dos lecturas posteriores:

- otras transacciones cliente abiertas: `0`;
- sesiones `idle in transaction`: `0`;
- transacciones preparadas: `0`;
- esperas de lock observadas en la primera lectura: `0`.

Desde el reinicio de PostgreSQL (`2026-09-18 21:26:23.072369+00`) se observaron:

- tickets nuevos: `0`;
- pagos de ticket nuevos: `0`;
- aperturas/cierres de caja: `0` / `0`;
- movimientos de crédito nuevos: `0`;
- filas nuevas de auditoría: `0`;
- movimientos/arqueos de Fondo: `0` / `0`.

Persisten dos sesiones de caja marcadas `ABIERTA`, IDs `43` y `44`, abiertas
antes del reinicio (`2026-09-17 01:27:10+00` y
`2026-09-18 19:27:28+00`). No fueron creadas por esta recuperación. El último
movimiento de crédito y la última auditoría observados también son anteriores
al reinicio (`19:27:45+00` y `19:29:03+00`).

Esto confirma ausencia **actual** de transacciones abiertas y ausencia de esas
operaciones de negocio después del reinicio. No se presenta como prueba general
de que nunca pudo ocurrir un COMMIT anterior.

## Escrituras automáticas detectadas

Sí hubo un estado persistente producido por el arranque automático del
workspace:

- `permisos_rol`: 70 filas con `updated_at` entre
  `21:26:24.589377+00` y `21:26:25.425432+00`;
- `permisos_ubicacion`: 54 filas con `updated_at =
  21:26:25.425432+00`;
- secuencias observadas: `permisos_rol_id_seq = 33917` y
  `permisos_ubicacion_id_seq = 9774`.

Los tiempos empiezan inmediatamente después del inicio de PostgreSQL. Son el
patrón ya documentado para los inicializadores normales: actualizan
`updated_at` de permisos y consumen secuencias. Esta recuperación no ejecutó
ese comando; al comenzar se encontró el workflow API en estado `finished` y
configurado todavía con:

`pnpm --filter @workspace/api-server run dev`

El script `dev` ejecuta `build` y después `start`. No se conservó scrollback de
logs tras el reinicio, por lo que no se atribuyen otros efectos no demostrados.
La evidencia de base sí demuestra las escrituras anteriores y basta para
detener la recuperación.

## Drift del bundle

Hash exigido por la autorización:

`655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2`

Hash encontrado antes de intentar arrancar:

`75d1e77f34e040af2c05e86befd6e2a6f288ca5fa5683f52a2919651c31794b9`

El archivo actual mide `9,395,387` bytes y tiene `mtime`
`2026-09-18 21:26:20.952011597+00`, durante el reinicio y antes del nuevo inicio
de PostgreSQL. No se encontró en el workspace otra copia con el hash
`655cad…`. Esta recuperación no ejecutó build ni codegen y no modificó el
bundle.

Al preparar el arranque autorizado se sustituyó primero la configuración del
servicio administrado por ejecución directa. Tras detectar el drift, el
propietario autorizó una corrección exclusivamente preventiva: el comando
gestionado final es exactamente:

```text
test $(sha256sum artifacts/api-server/dist/index.mjs | cut -d' ' -f1) = 655cad5082301d1456184fac8206f317bc0c88e9a33afe4679f806a62e1010c2 && exec node --enable-source-maps artifacts/api-server/dist/index.mjs
```

Se mantienen `API_INSPECTION_BOOT=1` y `NODE_ENV=development` dentro del
servicio. La comparación ocurre antes de importar o ejecutar `dist`; un
mismatch termina con estado distinto de cero, sin alternativa, build ni
invocación de Node. También evita que un futuro intento use el comando `dev`
que construye.

Se probó únicamente la expresión aislada de comparación de hash, sin ejecutar
el wrapper ni importar la aplicación. Resultado:
`HASH_GUARD_COMPARISON=REFUSED`, con el hash observado `75d1e77f…`. Es el
rechazo esperado.

La herramienta de configuración no arrancó el workflow. Su estado final sigue
siendo `finished`, sin proceso API. No se invocó restart. Esta configuración
queda como barrera preventiva del bundle autorizado, no como autorización para
arrancar ni como selección/recuperación del bundle actual.

## Acciones no realizadas

- cero restart/start de API;
- cero build, codegen o modificación de `dist`;
- cero DDL/DML, fixtures, migraciones, usuarios o sesiones de prueba;
- cero arranque/restauración del clon E10;
- cero aplicación o activación E2;
- cero login o captura viva;
- cero reinicio del frontend.

La recuperación sólo puede continuar con una nueva decisión sobre qué bundle
exacto se autoriza. No debe reconstruirse ni sustituirse silenciosamente el
hash perdido.