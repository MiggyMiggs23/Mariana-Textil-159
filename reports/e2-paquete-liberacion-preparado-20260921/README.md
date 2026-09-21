# Preparación aislada de liberación E2 — CLOSED, candidato en directorio definitivo

**Fecha:** 2026-09-21. **Estado: PAQUETE PREPARADO Y VALIDADO; NO LIBERADO; FASE B NO AUTORIZADA NI EJECUTADA.**

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
El control retenido arrancó; el candidato anterior falló. Los fallos y su
diagnóstico histórico permanecen preservados, no se borraron. Bajo la
autorización condicional se restauró únicamente la importación eager de app
en commit `226509cae4d6e850782763a0f4d15139ddedd568`.
**El agente principal confirmó el candidato corregido: preflight positivo
real, healthz 200, ambos workers, INSPECTION y catálogo/filas/secuencias sin
cambios.** Detuvo candidato y PostgreSQL y destruyó la base desechable.
El preflight por symlink y la exigencia de prueba positiva del wrapper están
corregidos: regresión 1→0, 20 comprobaciones PostgreSQL y 9 tests de wrapper PASS.
La fase B del documento 09 identifica los bytes finales y solo deja la hora
en blanco. Aún requiere autorización expresa: no se tocó la API/base/workflow
activos, no se hizo respaldo Drive ni SQL operativo ni primer cierre.

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
- Bundle final corregido: `artifacts/api-server/dist-e2-20260927/index.mjs`,
  SHA-256 `008dfd54d93f6a1606370d44cb2086673669c51278c92ebb6a5a63f4d503e7f5`.
  Versión anterior completa preservada en `candidato-antes-fix-import/`.
  Overlays: tests `07cc804a35b6bba7f3ed640129231ba7434a8767` y salida de build
  `e0f1c227e013c59987c06604e21a8036e73c82a5`. No se instala desde HEAD arbitrario.
  Se añade el overlay de importación/test `226509cae4d6e850782763a0f4d15139ddedd568`.

## Alcance propuesto

1. Código del corte E2: lectura canónica para sesiones abiertas y snapshot de
   un cierre nuevo dentro de la auditoría existente.
2. Esquema y código A+C preparados, con productores de captura y devolución
   apagados. Instalar evidencia **no significa abrir captura**.
3. Registro de intentos mediante `api-start-audit.sh` de este paquete,
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
| [06-resultado-preparacion.md](06-resultado-preparacion.md) | Antecedente histórico de la primera detención |
| [07-cinco-pruebas-y-recompilacion.md](07-cinco-pruebas-y-recompilacion.md) | Pruebas autorizadas y antecedente de rutas Pino |
| [08-directorio-final-preflight-y-recuperacion.md](08-directorio-final-preflight-y-recuperacion.md) | Estado actual, verificaciones, respaldo y recuperación |
| [09-fase-b-texto.md](09-fase-b-texto.md) | Texto final para autorización futura; solo hora en blanco |
| [10-fallo-arranque-real.md](10-fallo-arranque-real.md) | Fallos históricos preservados, superados por la validación final |
| [11-control-y-correccion-import.md](11-control-y-correccion-import.md) | Control, delta causal y candidato corregido PASS |
| [manifest-final.json](manifest-final.json) | Procedencia, hashes y validación final real |
| [anexos/clasificacion-arrastre.json](anexos/clasificacion-arrastre.json) | Clasificación por archivo del diff completo, incluido arrastre no E2 |
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