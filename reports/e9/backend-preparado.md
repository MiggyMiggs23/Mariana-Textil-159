# E9 — backend preparado OFF, entrega a MAIN

## Estado y límites

Backend implementado; **no ejecutado** contra API/DB. E9 fuente sigue `false`.
SQL/reversión solo preparados. No pruebas corridas por implementador, no apps,
workflows, DB/SQL, dists ni commits. No E5 ni cambios en fuentes/evidencia congelada
E3. UI pertenece a otra mano. No se editó el runner/guard aceptado E12.

Se comprobó sintaxis del runner, cardinalidad/anchors de mutantes y typechecks
noEmit. Eso **no acredita** verdes/rojos ni comportamiento PostgreSQL.

## Integración concreta

- Lector canónico: `buildCorteCaja` incorpora `versionCorte?` solo ON/CERRADA,
  desde snapshot E2 validado y contenido original completo. Mismo lector bajo
  lock en envío. `corteId=sesion.id`; no nonce local ni fecha reconstruida.
- Sin snapshot, no token ni inferencia; duplicado/corrupto/inconsistente falla
  explícitamente. Enviar toma efectivo contado congelado, no ventas/esperado.
- API E9 gate antes de autenticación/lecturas. Consulta bajo permiso existente
  `cortes.ver`, envío también `cortes.crear` y ADMIN/SUPERVISOR. Tienda propia
  obligatoria para no ADMIN. Sin nuevas concesiones de permisos.
- Un envío por corte, tabla lateral de custodia. No UPDATE de corte/sesión ni
  INSERT de salida; no retirar otra vez el dinero ni convertir retenidos en E5.
- Cada conteo agrega evidencia; diferencia firmado recibido−enviado. Cero:
  investigación abierta, sin ingreso, sin autorización ni cierre documental.
- Solo ADMIN autoriza conteo vigente positivo. Ingreso E10 `OTRO_INGRESO`,
  confirmación, CAS, historial y auditoría en la **misma** transacción Drizzle.
  Puente parametrizado E12 existente; no pool/commit anidado.
- Cierre documental ADMIN después de autorización, una vez, sin cambios
  monetarios. Historia anterior intacta; investigación/diferencia no desaparecen.
- Locks: UUID de intención → sesión para envío o entrega para otros comandos →
  lock transaccional E10 al autorizar. Clave E10 derivada en namespace separado.
  Replay idéntico antes de efectos; contenido/actor distinto = conflicto.
- Privacidad: tienda recibe su entrega sin `fondo`. Auditorías fuente llevan
  módulo `FONDO` para reutilizar exclusión no ADMIN. Detalle E10 ADMIN expone
  `origenE9` (entrega/corte exactos), nunca en un lector de tienda.
- Inverso Fondo independiente de recepción E9 rechazado. El hook E10 es
  inyectado; el módulo Fondo no importa código E9 y E12 nativo sigue autocontenido.

## DDL preparado, no aplicado

`01-preparado.sql`: agregados con corte único/revisión CAS; operaciones inmutables
por UUID/revisión; validación de transiciones/importe real/actor/evidencia; ingreso
Fondo único ligado; evento de cada revisión obligatorio al commit; guardas
diferidas de ingreso huérfano/inverso independiente; prohibido borrar/truncar.
`02-reversion-preparada.sql`: solo DDL E9 vacío, rehúsa cualquier remesa, operación,
auditoría o ingreso E9. No elimina datos previos, E10, E2 ni asientos.

Requisitos de instalación se describen, **no son bloqueos de construcción**.
No parser/servidor PostgreSQL utilizado; revisar/aprobar SQL antes de cualquier
ejecución separadamente autorizada. La prueba de SQL/concurrencia real está
pendiente; no sustituirla con el modelo serial de los tests offline.

## Casos preparados

Hay 58 casos preparados. La lista exacta (un `test()` por nombre y un defecto por caso) está en
`backend-mutants.mjs`; el runner exige correspondencia uno-a-uno con `e9.test.ts`.

- OFF: escritura, middleware opciones/mutación, lector de corte, detalle/lista,
  origen Fondo e inverso sin lecturas nuevas.
- Corte: cerrado, periodo operativo original separado de fecha de cierre, snapshot ausente/duplicado/inconsistente, hash de evidencia
  completa, físico frente a ventas/retenciones, centavos y versión obsoleta.
- Envío: completo, sin monto parcial inyectado, rol/permiso/sitio, cero, unicidad,
  replay/conflicto y concurrencia de modelo.
- Conteos: ADMIN, falta/sobra/cero, apertura de investigación, historia append,
  CAS de conteo vigente y prohibición de reconteo tras ingreso.
- Autorización: ADMIN, cero sin asiento, importe real exacto, motivo por diferencia,
  una sola autorización, concurrencia/rollback de modelo ante error de historial.
- Investigación: rol, evidencia, estado, cierre único y ausencia de efecto dinero.
- Privacidad/adapter: tienda sin Fondo, scope de lista, CAS real del adapter,
  solicitudes de lock UUID/corte/entrega, auditoría FONDO, origen exacto/inverso
  prohibido, llamada real a E10 parametrizada sin commit y por importe recibido,
  ausencia de segundo retiro/edición de corte.

Los tests de SQL del adapter inspeccionan las consultas que solicita el código.
**No ejecutan SQL ni prueban semántica/locks PostgreSQL.** Identidades y modelo
son sintéticos exclusivamente offline; no son fixtures de producción ni seed.

## Comandos para MAIN

```sh
# Solo preflight estático de nombres/anchors, no corre casos:
node reports/e9/run-backend-offline.mjs --validate-only

# MAIN: nativo, cada caso verde / defecto / verde restaurado en la misma copia:
node reports/e9/run-backend-offline.mjs

# Solo noEmit; sin dists:
pnpm exec tsc --noEmit -p artifacts/api-server/tsconfig.json --tsBuildInfoFile /tmp/e9-api.tsbuildinfo
pnpm exec tsc --noEmit -p lib/api-client-react/tsconfig.json --tsBuildInfoFile /tmp/e9-client.tsbuildinfo
pnpm exec tsc --noEmit -p lib/api-zod/tsconfig.json --tsBuildInfoFile /tmp/e9-zod.tsbuildinfo
```

Runner hace copias físicas, rechaza imports de fuente mutable viva, elimina
variables DB y reutiliza **sin cambios** `reports/tanda-b-20260922/e12/offline-guard.cjs`
en cada proceso Node. Installs, red, drivers DB, workers y child-process de tests
bloqueados. Rojo requiere fallo `ERR_ASSERTION` del caso exacto, no fallo de setup;
restauración revalida hash y vuelve a verde. Logs/manifiesto bajo
`reports/e9/logs/backend-<fecha>/`, únicamente cuando MAIN lo ejecute.

Pathspec backend separado en `backend-pathspec.txt`; no incluye UI ni E3.