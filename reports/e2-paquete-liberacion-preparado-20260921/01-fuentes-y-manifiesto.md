# 1. Fuentes, contenido y manifiesto

## Fuente de compilación propuesta

El candidato funcional es **`31804125a1e752bde128d72e9fd44d23972ffff1`**,
árbol **`6337df3ae1dc67b8de91fabda3cbf73dd255cf59`**.
Los commits posteriores consultados documentan evidencia/cierre; no sustituyen
la identificación del candidato validado.

La compilación futura se haría en una exportación limpia de esa revisión,
fuera de `artifacts/api-server/dist` activo, sin credenciales/conexiones a la
base operativa y sin arrancar/importar el backend para inspeccionarlo.
El script de build declarado es `node ./build.mjs`; desde el workspace exportado,
el comando previsto es `pnpm --filter @workspace/api-server run build`.
**No se ejecutó.** No usar `dev`: encadena build y start.

Registrar antes/después: commit/árbol, ausencia de modificaciones locales,
lockfile y entradas del build, versiones de herramientas/dependencias, comando,
salidas completas, código de salida, SHA-256 de bundle/mapas y demás salidas.
No sustituir el bundle activo como forma de ensayar una compilación.

### Selección aún pendiente

Un build completo de esta revisión no es un cherry-pick de E2. Comparado con
la fuente del bundle retenido, también existen cambios en rutas de clientes,
inventario, permisos, precios y otros componentes. El inventario adjunto
enumera las diferencias; no afirma que todas entren en el bundle ni que estén
autorizadas. En particular, no declarar excluido código alcanzable solo porque
una funcionalidad relacionada tenga su flag apagado.

El propietario debe decidir:

- aprobar la revisión completa tras revisar ese arrastre, **o**
- solicitar un candidato acotado a E2, que requiere nueva revisión exacta y
  verificación antes de asignarle un hash de liberación.

Hoy no se elige ninguna de las dos opciones ni se modifica código para resolverlo.
No es necesario resolver las decisiones comerciales de remate/precios para
describir E2; sí hay que evitar liberarlas por arrastre sin autorización.

## Contenido funcional E2 previsto

| Parte | Fuentes del candidato | Comportamiento |
|---|---|---|
| Aritmética de efectivo | `artifacts/api-server/src/lib/caja-cash-ledger.ts` | Centavos enteros; desglose y validación del snapshot |
| Lectura del corte | `artifacts/api-server/src/lib/caja-corte-reader.ts` | Sesión abierta: fuentes canónicas; cerrada: snapshot, sin recalcularlo con datos actuales |
| Cierre nuevo | `artifacts/api-server/src/lib/pos.ts`, `cerrarSesionCaja` | Bloqueo de sesión, cálculo previo al cierre y snapshot en auditoría `CERRAR_CAJA` dentro de la transacción |
| Superficies de consulta | rutas POS y lectura administrativa del candidato | Mismo contrato monetario; preservar tratamiento LEGACY de cierres sin snapshot |
| Evidencia A+C | `credit-abono-evidence.ts`, contratos y productores relacionados | Código presente pero captura/finalización funcional deshabilitada por flags |
| Arranque protegido | `startup-mode.ts`, `limited-startup-preflight.ts`, `index.ts` | Modos explícitos sin inicializadores/backfills/monitor escritores |

**Snapshot no es una tabla A+C.** Se almacena como
`auditoria.datos_despues.cashSnapshot` (propiedad TypeScript `datosDespues`).
No requiere columna/tabla nueva según la fuente; sí requiere que el esquema
existente sea compatible, algo que hoy no se consultó.

El SQL y los scripts de arranque son archivos operativos versionados separados:
no se presupone que queden incrustados en `dist/index.mjs`.

### Invariantes CLOSED del candidato

Todos permanecen `false`, sin overrides ni edición para este corte:

- `CREDIT_CASH_INCOME_CAPTURE_ENABLED`
- `CREDIT_ABONO_REFUND_EVIDENCE_ENABLED`
- `CREDIT_CASH_RETURN_CAPTURE_ENABLED`
- `CREDIT_PENDING_RECEIPTS_ENABLED`
- `CREDIT_HISTORICAL_ATTRIBUTION_ENABLED`

El modo de arranque exige simetría entre captura y evidencia funcional.
“A+C instalado con captura apagada” significa objetos SQL presentes y
verificados, pero productores/finalizador de la ruta de captura inactivos;
**no** inventar `abonoEvidence=true` con `incomeCapture=false`.
Las guardas E1C01, E1P01 y E1A01 siguen CLOSED en PostgreSQL.

La compatibilidad del frontend visible con los contratos del candidato debe
verificarse antes de liberar. Este paquete no autoriza un build/cambio del
frontend completo. Si hiciera falta, su revisión, artefacto y alcance deben
presentarse separadamente; no expandir el release automáticamente.

## Manifiesto de archivos SQL exactos

Copiados sin modificaciones desde los archivos A+C de la revisión funcional.
La comparación estática contra esa revisión no encontró diferencias.

| Archivo del paquete | SHA-256 |
|---|---|
| `sql/01-install-evidence-prepared.sql` | `3360d2b7edea27342cc073a7d6f864690dfb677f73dd3a0d57de46a522120a7c` |
| `sql/02-revert-before-capture-only.sql` | `0f5952b874bb9fead4f782b9b169636564d302f00f20d5e4bf135896c9b32b3c` |
| `sql/03-preflight-schema-prepared.sql` | `b368c7239f83b088d1fa5c30d1c1d0dd08538842d18a694315bd88b7f1e5980c` |

## Identidad retenida: referencia histórica, no autorización nueva

Fuente documentada del bundle actual:
`7cb77f8cfc6287fa51325a25122c48af392a7ada`,
árbol `c36407dc8310b9da47a0d3bbc40ffe44c6183f60`.

- Bundle retenido:
  `3415998ed6eb1b8d6977793ac53f43ce91477f691b12f5c8dc11d14a2b801a98`.
- Preflight retenido:
  `9a87b47b52d3776b10d760bdab6b9f5e71158f75ef71921ec8adbb3e0585de9f`.
- Última comprobación citada: 2026-09-21T18:15:50.491Z, PID 132.
  **No se volvió a comprobar el proceso hoy.**

El manifiesto final aún debe añadir:

1. Selección final de fuentes y hash de cada salida de la compilación autorizada.
2. Revisión/hash/ruta del preflight nuevo y sus expectativas de catálogo/datos.
3. Revisión y hashes del wrapper y del registrador para esa combinación.
4. Modo aprobado, identidad de base sin credenciales, guardas y flags esperados.
5. Evidencia de compatibilidad operativa, respaldo/restauración y rollback
   compatible con snapshots. Ninguno se presume aprobado por el 51/51 sintético.