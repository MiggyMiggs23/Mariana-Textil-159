# Preparación aislada de liberación E2 — CLOSED, detenida por pruebas

**Fecha:** 2026-09-21. **Estado: CANDIDATO COMPILADO; VERIFICACIÓN INCOMPLETA; NO LIBERAR.**

La autorización íntegra está en `autorizacion-propietario.txt`; la aceptación
posterior de Entradas está en `aclaracion-entradas.txt`. Se permite preparación
aislada y las pruebas expresamente enumeradas, no liberación ni conexión a la
base de la API. Se compiló la revisión exacta en una exportación aislada,
sin credenciales ni archivos `.env`, y se ejecutaron typecheck raíz y selección
sin base. El typecheck pasó; las pruebas terminaron con **114 PASS / 5 FAIL**.
Véase `06-resultado-preparacion.md`. No se corrigieron fuentes para ocultar esos
fallos ni se declara terminado el preflight, wrapper, manifiesto final o fase B.

## Revisiones exactas

- Revisión del repositorio observada al preparar el paquete:
  `c48f0a268e3be977393fce574ab7db6fb8728813`.
- **Fuente funcional candidata de compilación y origen de los tres SQL:**
  `31804125a1e752bde128d72e9fd44d23972ffff1`.
- Árbol de esa fuente: `6337df3ae1dc67b8de91fabda3cbf73dd255cf59`.
- No compilar desde un `HEAD` móvil ni incorporar cambios locales. El archivo
  previamente modificado `reports/e2-correccion-sql-y-registro-arranques-20260921.md`
  no se modificó ni se considera una nueva autorización.
- Bundle aislado: `candidato/dist/index.mjs`, SHA-256
  `f22be73ed8c17ed96d6f22cd62a126bf965a59c55781446fcd1a03c8c16e002c`.
  No se sustituyó el bundle activo. No existe aún wrapper/preflight final
  verificado ni autorización de fase B ejecutable.

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