# E5 integración y E7 atribución de solo lectura

Fecha: 2026-09-23

## Resultado

- **E7 atribución: PASS / habilitada.** Los gates de API, UI y OpenAPI quedaron en
  `true`. La ruta sigue siendo exclusivamente de lectura, revalida la sesión
  antes de entregar y conserva el cálculo FIFO global previo al filtro por
  sitio, las cuatro cifras globales autorizadas, el detalle por alcance y las
  leyendas de exportación.
- **E5 operaciones: OFF.** `E5_ENABLED=false` y
  `E5_CONTADOR_A_ENABLED=false`; no se habilitó recepción, aplicación,
  devolución, preparación E11 ni ningún productor monetario.
- **E1 atribución histórica: OFF.** No se cambió su gate ni se agregó ninguna
  escritura histórica.
- **Fondo / retiro dirigido / retenido: OFF.** Esta entrega no los abre ni los
  usa.

## PostgreSQL desechable y alcance E5

`node lib/db/src/run-e5-e7-isolated-tests.mjs` aplicó en un clúster desechable
la instantánea canónica de ensayo, el prerrequisito E3 y Tanda B 1–4. Probó:

1. rechazo HTTP de comandos E5 con `E5_DISABLED`, antes de continuar;
2. rechazo independiente de un `INSERT` E5 directo por la guarda PostgreSQL
   `e5_closed` (`P0001`, mensaje `E5_DISABLED`);
3. activación **sólo en el clúster desechable** mediante
   `E5_DISPOSABLE_LIFECYCLE=1`, deshabilitando únicamente el cierre general
   `e5_closed`; las guardas E1 de retenido, marcador dirigido, grafo,
   procedencia e inmutabilidad permanecieron habilitadas;
4. ciclo real `RECIBIR -> PROPONER` contra repositorio y PostgreSQL: **PASS**;
5. ciclo real `RECIBIR -> DEVOLVER` por cuenta bancaria evidenciada:
   **PASS**; no se usó caja ni Fondo;
6. ciclo real `AUTORIZAR/APLICAR`, incluida aplicación de crédito sin segundo
   ingreso, vínculo E5 y marcador dirigido singular: **PASS**;
7. ejecución real del adaptador SQL de atribución E7 dentro de
   `REPEATABLE READ READ ONLY`;
8. destrucción completa del clúster.

Evidencia vigente: `e5-lifecycle-disposable-pg.log`.

### Diagnóstico exacto de la falsa incompatibilidad E1

No había una incompatibilidad del adapter con la identidad canónica. La
instantánea SQL de ensayo crea `movimientos_credito.es_incobrable` sin el
`DEFAULT false` del schema canónico. El adapter omite legítimamente esa columna;
en la instantánea el valor real era `NULL`, por lo que la conjunción estrecha
`m.es_incobrable=false` de `e5_owned_credit_source` evaluaba `NULL` y el
`coalesce(...,false)` cerraba la fuente. Todos los demás predicados de identidad
—clave, importe, cliente, sitio, fecha, snapshot, propuesta y marca `birth_xid`
superior— eran `true`.

El runner desechable ahora restaura únicamente ese default canónico. No se
relajó `e5_owned_credit_source`, no se usó `xmin`, no se rellenó evidencia
histórica y no se abrió ninguna guarda de retenido o dirigido.

Durante el ensayo también se corrigieron colisiones PL/pgSQL reales entre
variables `record` y aliases (`a`, `m`, `v`, `d`) en `e5_graph_guard`; antes de
esas correcciones incluso recepción/propuesta abortaban al evaluar el grafo.

## Pruebas

- E5 + E7 backend: **65/65 PASS** (`backend-unit.log`).
- Contrato UI E7: **2/2 PASS** (`frontend-contract.log`).
- Contrato conjunto de gates: **9/9 PASS** (`gate-contract.log`).
- Typecheck API: **PASS** (`api-typecheck.log`).
- Typecheck UI: **PASS** (`ui-typecheck.log`).
- PostgreSQL desechable: **PASS de ciclo específico completo**, con marcadores
  `E5_RECEIVE_PROPOSE_APPLY_REFUND_E7_DISPOSABLE_PASS` y
  `E5_E7_DISPOSABLE_CLUSTER_DESTROYED_PASS`.

Los contratos dirigidos enfocados dieron **6/6 PASS**. Las dos expectativas
obsoletas ahora verifican la composición vigente: `pagos-dirigidos` se resuelve
al tab compuesto `clientes`, su bloque sigue consultándose allí, el tab legado
independiente permanece ausente y la exportación usa
`/api/reportes/vistas/{vista}/export.{formato}` con parámetros compartidos.

## Archivos de implementación

- `artifacts/api-server/src/lib/e7-feature.ts`
- `artifacts/mariana-textil/src/lib/e7-feature-flags.ts`
- `lib/api-spec/openapi.yaml`
- `artifacts/api-server/src/lib/e7.test.ts`
- `artifacts/api-server/src/lib/e11-tanda-d.test.ts`
- `artifacts/mariana-textil/src/components/e7-release.contract.test.ts`
- `artifacts/api-server/src/lib/e5-e7.pg.integration.ts`
- `lib/db/src/run-e5-e7-isolated-tests.mjs`
- `reports/tanda-b-b0-b1-20260923/r5/sql/4.sql`
- `reports/e5/01-preparado.sql`

## Commit y bloqueadores

- Commit: pendiente de integración por el agente principal; el árbol compartido
  también contiene cambios E9 concurrentes.
- No hay bloqueador para E7 de solo lectura.
- E5 completa el ciclo específico de integración autorizado en PostgreSQL
  desechable. Producción sigue cerrada y no se libera porque el gate operativo
  permanece explícitamente OFF.