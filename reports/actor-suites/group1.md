# Adaptación actores — grupo 1 (10 suites)

Estado: adaptación de las diez suites completada en fuente contra el contrato
estable `reports/actor-suites/contrato.md`. Sin ejecución de casos.

Inventario exclusivo: admin-alertas.integration, admin-invariants.integration,
aplicaciones-pago-proveedor.integration, auditoria.integration,
clientes-ajustes-api, contenedores.integration, cuadre-fiscal.integration,
equipos.integration, etiquetas-api.integration, inventory-six-view.integration
(todos `.test.ts` bajo artifacts/api-server/src).

Inspección estática:
- Clientes ajustes, equipos y etiquetas importaban DB/app estáticamente antes
  de cualquier validación local: convertidos a dinámicos tras preflight.
- Las diez invocan assertActorSuiteEnvironmentSync del helper puro compartido,
  y exigen ACTOR_SUITE_IDENTITY_VERIFIED=1 antes de importar DB/app. El bootstrap
  del propietario confirma la identidad efectiva antes de cargar suites.
  TEST_DATABASE_URL es target; DATABASE_URL es control local real DISTINTO.
  Ningún import de valor estático DB/app permanece; los imports type se borran.
- El helper compartido es ESM sin declaración TS: sólo su import lleva la
  anotación puntual ts-ignore, como el otro grupo; no se suprimen diagnósticos
  de negocio, DB, rutas ni aserciones.
- Alertas, cuadre y aplicaciones proveedor omitían integración sin URL mediante
  skip: reemplazados por fallo de infraestructura explícito, no omisión.
- Contenedores, inventory-six-view y etiquetas borraban evidencia en teardown;
  etiquetas habilitaba un bypass append-only. Retirado sólo ese teardown; el
  propietario desecha la DB/cluster. Se conservan rechazos de negocio y pruebas
  negativas de UPDATE/DELETE, incluyendo la prueba auditoría que demuestra que
  el antiguo flag de cleanup NO autoriza borrar.
- Aplicaciones proveedor tomaba usuario/sitio preexistentes: reemplazados por
  fixtures propios, dentro de sus transacciones de la DB privada.
- No se alteran casos, roles ni aserciones de negocio. Los cierres de servidor,
  release de conexiones y rollback transaccional se conservan.

No se han ejecutado tests, SQL, DB, API, apps, workflows, instalaciones ni commits.
Typecheck final full-source API (357 raíces y sus dependencias reales):
0 diagnósticos. ConfigFilePath absoluto, rootDir workspace, noEmit,
incremental=false, composite=false, projectReferences=[]; cero fuentes
lib/dist locales cargadas. No se emitieron bundles ni generados.
Comparación AST estática contra HEAD conserva el inventario ordenado de llamadas
test/t.test/assert de negocio en las diez suites. No constituye resultado de casos.

Coordinación con infraestructura: MAIN solicitó un HIJO POR RUTA para no
compartir el pool singleton entre suites que lo cierran. Las suites preservan
cierre de servidor/pool y no asumen cierre seguro compartido. El propietario
es responsable de implementar ese ciclo de vida y destruir el cluster; este
grupo no modificó runner, guardia compartida, producción ni suites ajenas.
La ejecución y sus resultados quedan exclusivamente a cargo de MAIN.

## Diagnóstico de corrida MAIN 2026-09-23T04-13-40.761Z-ce0c483a

Inspeccionados logs durables, no ejecutados por este grupo. Manifest: primeras
cuatro rutas PASS; clientes-ajustes 6 casos PASS/3 FAIL. Terminal declara
clusterDestroyed=true. No son tres errores 500:

- Concurrencia ticket/baja: HTTP 400 SOURCE_ROLLO_REQUIRED frente al 201 esperado.
  Fixture METRO antigua no tenía fuentesRollo. Preparación corregida en la suite:
  proveedor/entrada/rollo DISPONIBLE de su propio target, ALTA física y fuente
  explícita de un metro. Conservados rol, locks, caso y todas sus aserciones.
- INE: HTTP 500. La suite ya instalaba memoria para save/read, pero
  privateObjectPath exige PRIVATE_OBJECT_DIR antes de invocar el adapter. El
  runner no hereda esa configuración. Preparación corregida: namespace local
  inerte para el adapter existente, restaurado en teardown. Sin secretos, bucket
  real, credenciales ni alteración de políticas de acceso/slots/MIME/auditoría.
- Baja vencida: HTTP 400 SIN code, no 500. Con adminUsuario/adminPassword presentes
  el handler actual primero exige readCreditEvidenceInput; el fixture heredado
  carece de esa evidencia y recibe CreditEvidenceError serializado sólo como
  error. Además, incluso aportando evidencia, el motivo corto se rechaza al
  principio con esa misma clase, antes de la rama INCOBRABLE_REASON_REQUIRED.
  Este desacople entre aserción legacy y contrato actual no se resuelve sólo con
  preparación conservando la aserción. NO se cambió producción, gate, request E1,
  respuesta esperada ni se omitió el caso: requiere decisión de MAIN.
- Error asíncrono independiente: worker exige DATABASE_URL/control distinto
  después de que @workspace/db normalizó DATABASE_URL al target. Logger no
  production usa pino-pretty transport; bootstrap heredado por workers explica
  el conflicto de alias. MAIN ya encargó diagnóstico/fix al propietario infra;
  este grupo no tocó logger, bootstrap ni runner.

La segunda corrida notificada por MAIN falla en regex de contenedores por nombre
target sin test/ci/e2e; infraestructura ajustará el nombre. Regex intacta.
Typecheck después de las dos correcciones de preparación: full-source 357 raíces,
0 diagnósticos, cero lib/dist locales; noEmit y sin projectReferences. El primer
intento de la herramienta se desconectó sin resultado; el reintento estático
terminó correctamente. No se ejecutaron casos ni SQL.

## Adaptación puntual de contrato E1 autorizada por MAIN

MAIN aprobó expresamente sustituir la aserción legacy
INCOBRABLE_REASON_REQUIRED, NO relajar la obligación de rechazar motivo corto.
Replit E1 incluye baja incobrable como CORRECCION_CONTABLE con origen explícito,
justificación y autorizaciones existentes. Se comparte entre negativa y positiva
un request válido: tienda local, UUID, monto positivo 80.00, justificación y
credenciales ADMIN. Sólo cambia motivo.

Negativa: status 400 y body exacto
`{error:"Declara monto incobrable positivo y motivo de al menos 20 caracteres."}`.
Comprueba cliente activo, saldo 80.00, cero ajustes incobrables, cero auditorías
de baja y cero claims para ese UUID. Positiva reutiliza exactamente ese UUID,
exige un claim BAJA_INCOBRABLE/CORRECCION_CONTABLE y conserva todas las
aserciones de baja, auditoría, ticket, reactivación sin reverso e incobrables.
La negativa anterior sin credenciales conserva 401/ADMIN_AUTH_REQUIRED.

No afirmar AST idéntico para esta aserción: hay una sustitución contractual
aprobada y dos nuevas aserciones de causalidad/no-efectos dentro del caso ya
existente. Cero casos nuevos; roles y demás obligaciones no cambian.
En la fuente reabierta no estaban las preparaciones METRO/namespace INE del
diagnóstico anterior; quedaron aplicadas y verificadas ahora en el mismo archivo.
No se modificaron las otras nueve suites del loop MAIN, producción, gates o infra.
Typecheck final: 357 raíces, 0 diagnósticos, cero lib/dist locales, noEmit.
No ejecución de casos/SQL/API/DB ni afirmación de PASS runtime.

## Diagnóstico G1 v2: 2026-09-23T05-50-23.441Z-0fb10cb2

MAIN comunica diez rutas ejecutadas: ocho PASS, clientes-ajustes (05) y
etiquetas (09) FAIL. Diagnóstico basado en excerpts de MAIN y lectura estática,
sin consultar logs ni ejecutar casos/SQL:

- 05: crearTicket devuelve 400 VALIDATION_ERROR en vez de 201. La cantidad
  de fuentesRollo estaba preparada como string "1.000"; crearTicketBody exige
  zod.number() positivo. La conversión a string es posterior, dentro del handler.
  Corregido únicamente el dato HTTP a número 1; fixture físico y aserciones
  de serialización permanecen intactos.
- 09: búsqueda SKU devuelve cero en lugar de 50 y tela/color no devuelve filas.
  El namespace aleatorio del fixture acaba en UUID. interpretarCodigoEscaneado
  reconoce un sufijo de siete u ocho dígitos como serie; etiquetas entonces usa
  igualdad de serie, no búsqueda ILIKE en SKU/tela/color. Un UUID puede generar
  ese sufijo accidentalmente. Es una ambigüedad comprobable en fuente y
  compatible con ambos fallos; falta el UUID concreto de la corrida para
  confirmar esa instancia. Añadido sufijo alfabético -TEXT al namespace para
  garantizar que estos datos sigan siendo texto libre. No se alteran cantidades,
  filtros, roles, permisos, sitios, casos ni aserciones.

No se modifican las ocho suites PASS, producción, parser, schemas ni guards.
La confirmación runtime y preservación de terminales corresponden a MAIN/auditor.
Typecheck estático posterior: 357 raíces, cero lib/dist locales, noEmit; un
diagnóstico ajeno al alcance, TS2304 en security-api.test.ts:3283 (cleanup no
definido). No se modificó ese archivo. Sin diagnósticos en las dos suites editadas.