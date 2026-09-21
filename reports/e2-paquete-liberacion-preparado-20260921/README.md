# Preparación aislada de liberación E2 — CLOSED, candidato en directorio definitivo

**Fecha:** 2026-09-21. **Estado: NO AUTORIZABLE — ARRANQUE CANDIDATO FALLIDO; CONTROL AUTORIZADO PENDIENTE; NO LIBERAR.**

La autorización íntegra está en `autorizacion-propietario.txt`; la aceptación
posterior de Entradas está en `aclaracion-entradas.txt`. Se permite preparación
aislada y las pruebas expresamente enumeradas, no liberación ni conexión a la
base de la API. Se compiló la revisión exacta en una exportación aislada,
sin credenciales ni archivos `.env`, y se ejecutaron typecheck raíz y selección
sin base. El typecheck inicial pasó; las pruebas iniciales terminaron con
**114 PASS / 5 FAIL**. El propietario autorizó corregir únicamente esas cinco
pruebas en commit separado: los cinco casos demostraron verde/rojo/verde y ambos
archivos aprobaron 17/17. La recompilación en la ruta original reprodujo
exactamente el hash inicial. La nueva autorización permitió compilar directamente
en `artifacts/api-server/dist-e2-20260927`, con un commit separado solo para
seleccionar salida. Preflight completo PostgreSQL: 19 comprobaciones PASS;
wrapper: 8/8 PASS; selección sin base: 119/119 PASS; typecheck: cero errores.
Esos resultados independientes siguen siendo válidos, pero **la prueba real
ejecutada por el agente principal falló: no obtuvo healthz 200 en 30 segundos**.
La traza demuestra carga real de thread-stream-worker y pino-pretty y se emitió
el aviso INSPECTION. El ciclo async observado es una hipótesis de diagnóstico,
no causa demostrada sin control: el ciclo de fuentes ya existía en 7cb77f8.
Además, el enlace simbólico del
runner hizo omitir el CLI del preflight: esa ejecución no prueba el preflight
del recorrido completo. Candidato detenido; PostgreSQL detenido y destruido.
Manifiesto y fase B quedan **bloqueados, no simplemente pendientes de una prueba**.
La nueva autorización `autorizacion-control-y-preflight.txt` permite probar
7cb77f8 y corregir independientemente el preflight. Este último ya ejecuta
su CLI por symlink y el wrapper exige prueba positiva; regresión 1→0,
20 comprobaciones PostgreSQL y 9 tests de wrapper PASS. No se modificó runtime.
El control fue compilado, pero su ejecución corresponde al agente principal.
Véase
`10-fallo-arranque-real.md`; no basta completar la hora para autorizar fase B.

## Revisiones exactas

- Revisión del repositorio observada al preparar el paquete:
  `c48f0a268e3be977393fce574ab7db6fb8728813`.
- **Fuente funcional candidata de compilación y origen de los tres SQL:**
  `31804125a1e752bde128d72e9fd44d23972ffff1`.
- Árbol de esa fuente: `6337df3ae1dc67b8de91fabda3cbf73dd255cf59`.
- No compilar desde un `HEAD` móvil ni incorporar cambios locales. El archivo
  previamente modificado `reports/e2-correccion-sql-y-registro-arranques-20260921.md`
  no se modificó ni se considera una nueva autorización.
- Bundle inicial histórico: `candidato/dist/index.mjs`, SHA-256
  `f22be73ed8c17ed96d6f22cd62a126bf965a59c55781446fcd1a03c8c16e002c`.
  No se sustituyó el bundle activo.
- Bundle final preparado: `artifacts/api-server/dist-e2-20260927/index.mjs`,
  SHA-256 `1102baeec9de7d7c7773f142a835f39234ec1ba2f278373cdedcd4814ff2feb3`.
  Overlays: tests `07cc804a35b6bba7f3ed640129231ba7434a8767` y salida de build
  `e0f1c227e013c59987c06604e21a8036e73c82a5`. No se instala desde HEAD arbitrario.

## Alcance propuesto

1. Código del corte E2: lectura canónica para sesiones abiertas y snapshot de
   un cierre nuevo dentro de la auditoría existente.
2. Esquema y código A+C preparados, con productores de captura y devolución
   apagados. Instalar evidencia **no significa abrir captura**.
3. Registro de intentos de arranque mediante `scripts/api-start-audit.sh`,
   conectado al mismo arranque autorizado del nuevo bundle.
4. Comprobaciones de solo lectura posteriores y **un primer cierre real nuevo,
   separado y expresamente autorizado**, para acreditar el snapshot.

No incluye abrir abonos físicos de efectivo, devoluciones, cobros retenidos,
atribución histórica, remate/precios, backfills, seeds, purgas, reconstrucción de
cierres antiguos, pruebas financieras ficticias ni inicializadores escritores.

## Contenido

| Documento | Uso |
|---|---|
| [01-fuentes-y-manifiesto.md](01-fuentes-y-manifiesto.md) | Procedencia y selección aprobada; referencias iniciales |
| [02-sql-y-preflight.md](02-sql-y-preflight.md) | SQL exacto, orden, preflight previo/posterior y reversión |
| [03-arranque-y-registro.md](03-arranque-y-registro.md) | Activación del logger en el mismo reinicio |
| [04-verificacion-y-primer-cierre.md](04-verificacion-y-primer-cierre.md) | Aceptación posterior y evidencia del snapshot |
| [05-autorizacion-propietario.md](05-autorizacion-propietario.md) | Decisiones de preparación otorgadas; fase B aún no emitida |
| [06-resultado-preparacion.md](06-resultado-preparacion.md) | Resultados terminales y detención |
| [07-cinco-pruebas-y-recompilacion.md](07-cinco-pruebas-y-recompilacion.md) | Pruebas autorizadas y antecedente de rutas Pino |
| [08-directorio-final-preflight-y-recuperacion.md](08-directorio-final-preflight-y-recuperacion.md) | Estado actual, verificaciones, respaldo y recuperación |
| [09-fase-b-texto.md](09-fase-b-texto.md) | Borrador bloqueado, NO AUTORIZABLE |
| [10-fallo-arranque-real.md](10-fallo-arranque-real.md) | Fallo observado, diagnóstico, evidencia y limpieza |
| [manifest-final.json](manifest-final.json) | Procedencia y hashes; fallo real y bloqueos explícitos |
| [sql/](sql/) | Copias exactas de instalación, reversión y preflight A+C |
| [anexos/inventario-diferencias-fuentes.txt](anexos/inventario-diferencias-fuentes.txt) | Diferencias entre fuente del bundle retenido y candidato |

## Evidencia existente, no repetida hoy

[Validación SAVEPOINT](../e2-validacion-savepoint-20260921.md):
**51/51 PASS y 5/5 suplementos PASS**, PostgreSQL 16.10, sobre la revisión
funcional indicada; bases desechables destruidas. Typecheck API PASS previo.
La preparación abortada antes del primer caso está conservada.

No demuestra compatibilidad con el catálogo operativo completo, preflight
TypeScript en runtime, integración HTTP/UI ni primer cierre operativo.
El caso observacional de reverso tras IMMEDIATE no autoriza devolución.

**Criterio de uso:** ningún campo pendiente puede completarse por suposición.
La autorización final debe identificar bytes y alcance; si cambia la revisión,
el SQL, las guardas o el estado esperado, se detiene y se vuelve a presentar.