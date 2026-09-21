# Cinco pruebas actualizadas y mismo hash — portabilidad pendiente

Autorización literal: `autorizacion-cinco-pruebas.txt`.
Commit separado exclusivamente de los dos archivos de pruebas:
`07cc804a35b6bba7f3ed640129231ba7434a8767`.
No incluye informes, SQL, wrapper, preflight productivo ni fuente runtime.

## Cinco comprobaciones positivas / defecto / restauración

Se actualizaron una aserción antigua de procedencia y cuatro casos con fixtures
anteriores a xid8. El helper de fixture compartido alimenta únicamente esos
cuatro casos. Los cuerpos de funciones se leen del SQL sometido a prueba,
no se fabrican desde los hashes esperados.

Para cada caso se ejecutó un proceso real de pruebas independiente en una
exportación aislada, se introdujo la comparación obsoleta basada en
`xmin` / `txid_current() % 4294967296` únicamente en su copia de SQL, y se
restauró el archivo original antes de la siguiente fase.

| Caso | Original xid8 | Defecto xmin/txid_current | Restaurado xid8 |
|---|---:|---:|---:|
| DDL reconciliado de devolución | exit 0 | exit 1, aserción semántica | exit 0 |
| Inventario combinado A+C y derivas | exit 0 | exit 1, cuerpo A+C distinto | exit 0 |
| Preflight positivo con guardas E1 | exit 0 | exit 1, cuerpo A+C distinto | exit 0 |
| Rechazo de trigger E1 ausente | exit 0 | exit 1, error A+C anterior al E1 esperado | exit 0 |
| Rechazo de guarda E1P01 incorrecta | exit 0 | exit 1, error A+C anterior al E1 esperado | exit 0 |

Los quince logs TAP y `results.json` están en `verificacion-cinco-pruebas/`.
La ejecución conjunta de ambos archivos aprobó **17/17** pruebas.
No se atribuye el rojo a errores de importación, sintaxis o red.
El SQL original/restaurado tiene SHA-256
`3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c`.
El mutante aislado tiene SHA-256
`9fd4345e2c78a57747146648760164b886efe037e9676b5c15782e849b2067bd`.

Se verificaron 1,259 archivos de código/JSON de API y librerías contra los
blobs de `31804125a1e752bde128d72e9fd44d23972ffff1`, excluyendo únicamente
los dos archivos de tests autorizados: **cero diferencias**.

## Condición de mismo bundle — CUMPLIDA al reproducir el directorio original

En el primer intento la ruta temporal anterior ya no existía; la exportación quedó en
`/tmp/e2-release-preparation-A9XYf6/source`.
La compilación terminó exit 0, pero su SHA-256 fue:

`d1a676a12d49df5ce8789e3aa24548412fec5b712caa46d25c156a0ce80da019`

Al repetir el proceso en la ruta absoluta original, previamente comprobada
ausente y segura, se reprodujo el hash exigido **sin sustituirlo**:

`f22be73ed8c17ed96d6f22cd62a126bf965a59c55781446fcd1a03c8c16e002c`

La comparación estática muestra una única línea diferente: el plugin de Pino
incrusta la ruta absoluta del directorio de salida en
`pinoBundlerAbsolutePath`. El candidato anterior contiene la ruta temporal
`/tmp/e2-release-preparation-adkcNR/source/artifacts/api-server/dist`;
el recompilado contiene la nueva ruta temporal. Esa línea participa en
la resolución de los workers de Pino, no es solamente un comentario.

La segunda exportación se creó con `git archive` de la misma revisión en
`/tmp/e2-release-preparation-adkcNR/source`, con solo los dos tests autorizados
superpuestos. Los enlaces de paquetes internos se remapearon a esa exportación.
Typecheck raíz: exit 0, todos los paquetes completos y 0 diagnósticos.
Build: exit 0. Comprobación de SHA-256: exit 0. `cmp` contra el candidato
anterior: exit 0, igualdad byte por byte. Logs en `verificacion-cinco-pruebas/`.

No se parchearon bytes, normalizaron rutas, cambiaron hashes esperados ni
corrigió el plugin. La primera discrepancia procede del directorio como
entrada del build, no de cambios en fuentes runtime ni de las cinco pruebas.
Se conserva el primer diff como evidencia histórica, no como bloqueo actual.

## Bloqueo restante: dependencia de workers respecto de una ruta temporal

Inspección exclusivamente estática del bundle:

- Líneas 35957–35965: `pinoBundlerAbsolutePath` toma el `outputDir` absoluto
  del build y retorna `path.resolve(outputDir, ...)`. No comprueba la existencia
  del archivo. Su alternativa relativa a `import.meta.url` está en el `catch`;
  mover o borrar la ruta no hace que `path.resolve` lance una excepción.
- Línea 35967: se asignan así las cuatro rutas de `thread-stream-worker`,
  `pino-worker`, `pino/file` y `pino-pretty`; esas claves sobrescriben las que
  pudieran existir antes en `globalThis.__bundlerPathsOverrides`.
- Líneas 33887–33890: `new Worker` usa directamente la ruta configurada para
  `thread-stream-worker`. La resolución del transporte también toma estos
  overrides y devuelve sin cambiar las rutas absolutas (líneas 34331–34376).
- `src/lib/logger.ts` selecciona el transporte `pino-pretty` cuando NODE_ENV
  no es production. El modo INSPECTION autorizado exige development.

Por tanto, copiar `dist` a la ruta operativa no relocaliza por sí solo los
workers: seguirían apuntando a `/tmp/e2-release-preparation-adkcNR/source/artifacts/api-server/dist`.
Si el temporal desaparece, faltan esos destinos; si permanece, el artefacto
movido seguiría dependiendo de esos archivos temporales externos al destino.
Mantener ahora el temporal no demuestra portabilidad ni es una corrección.

No se ejecutó el bundle ni sus workers para investigar la relocalización.
No se atribuye este hallazgo a las cinco pruebas: estas ya aprobaron y
demostraron el rechazo de la regresión de procedencia. No se cambió el plugin,
el build, el logger ni el modo de operación para sortear el problema.

## Estado de continuación

Las cinco pruebas y la identidad del bundle ya no bloquean. El bloqueo
restante es la portabilidad de los workers identificada estáticamente.
Por la instrucción de detenerse y no corregir el plugin, no se continuó con wrapper/preflight finales,
PostgreSQL desechable, manifiesto final ni fase B. No se ejecutaron respaldos,
no se accedió a ninguna base, no se reinició la API ni se modificó su workflow
o bundle activo. No se propone un hash sustituto como si estuviera autorizado.

Preparaciones abortadas conservadas como tales: primero se detectó que la
exportación anterior no existía (sin ejecutar pruebas); el primer intento del
runner de mutantes rechazó un ancla SQL repetida antes de mutar o ejecutar
casos. El runner fue corregido para exigir las dos declaraciones reales de
`source_xid`; la evidencia de la tabla procede de la corrida completa posterior.