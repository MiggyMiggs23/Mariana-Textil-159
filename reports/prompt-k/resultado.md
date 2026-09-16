# Prompt K — auditoría de alcance, consumidores y referencias

## Resultado ejecutivo

- **No se modificó código de producción.** Este entregable es solamente una
  auditoría reproducible; no se cambió `CLIENTES`, `USUARIOS`, la ruta
  financiera, el cliente generado ni la aplicación visual.
- **No se hizo una captura visual ni se afirma una validación visual.** No se
  inició ni se reinició ningún workflow.
- La falla de alcance está confirmada en el código actual: `GET
  /api/clientes/resumen` calcula un resumen global y no lee
  `req.auth.user.ubicacionId`, `alcanceConsulta` ni un `ubicacionId` de la
  consulta.
- En esta tarea **no se construyó ningún DELETE**. El estado existente debe
  distinguirse con precisión: ubicaciones no pertenece al catálogo purgable;
  usuarios sí tiene una ruta DELETE genérica preexistente. Esa ruta no fue
  tocada.

## Evidencia del endpoint actual

### Servidor

`artifacts/api-server/src/routes/clientes.ts`:

- `L75` monta `requireSession` para `/clientes`.
- `artifacts/api-server/src/routes/index.ts:L46` monta `clientesRouter` en el
  router principal de la API.
- `L277-L280` registra `GET /clientes/resumen` y solamente aplica
  `requierePermiso("clientes_finanzas", "ver")`.
- `L282` ejecuta `SELECT id FROM clientes WHERE activo`, sin condición de
  ubicación, alcance o sitio.
- `L283` pasa **todos** esos clientes a
  `loadCustomerCreditProjections`.
- `L284-L292` calcula y retorna:
  `totalClientes`, `clientesConSaldo`, `totalCartera` y `totalVencido`.
- El handler recibe `_req` y no consume ningún parámetro de alcance.

La ruta, por lo tanto, valida sesión y permiso, pero el permiso no equivale a
un filtro de datos por sitio. El contrato actual no ofrece una dimensión
`ubicacionId` ni otra dimensión de alcance.

El modelo de lectura en
`artifacts/api-server/src/lib/credit-aging-read-model.ts:L27-L68,L232-L281`
consulta el ledger completo por `cliente_id`, usando:

- `movimientos_credito` (incluyendo sus movimientos dirigidos);
- `solicitudes_pago_dirigido`, filtradas por tipo/estado;
- `tickets`;
- `aplicaciones_credito` y la metadata de los movimientos; y
- la proyección de FIFO en TypeScript.

El resumen no incorpora `tickets.ubicacion_id` para formar un conjunto de
clientes visible por sitio antes de proyectar el ledger.

### Contrato y documentación

- `lib/api-spec/openapi.yaml:L2810-L2825` declara
  `GET /clientes/resumen`, `operationId: getClientesResumen`, y el permiso
  `clientes_finanzas`.
- `lib/api-spec/openapi.yaml:L9355-L9362` define únicamente los cuatro campos
  globales del resumen.
- `lib/api-zod/src/generated/api.ts:L4763-L4769` replica esos cuatro campos.
- `docs/endpoint-permissions.md:L177` documenta el permiso, pero no introduce
  un filtro de alcance.

## Inventario completo de consumidores

### Consumidor de producción

El único consumidor React directo encontrado es
`artifacts/mariana-textil/src/pages/clientes.tsx`:

- `L6` importa `getGetClientesResumenQueryKey`.
- `L12` importa `useGetClientesResumen`.
- `L50-L56` calcula `canFinances` y habilita la consulta solamente cuando el
  usuario tiene `CLIENTES_FINANZAS/ver` y no es `SUPERVISOR`.
- `L175-L180` presenta la respuesta en la pestaña **Cartera**:
  `totalCartera`, `totalVencido`, `clientesConSaldo` y `totalClientes`.

No se encontró un consumidor directo desde `Dashboard`, ni una importación del
hook del resumen en una página de dashboard. El texto `dashboard` en el
inventario corresponde a otros endpoints/páginas, no a este resumen.

### Superficie generada del cliente

`lib/api-client-react/src/generated/api.ts:L9104-L9172` contiene la superficie
generada completa:

1. `getGetClientesResumenUrl()` → `/api/clientes/resumen`;
2. `getClientesResumen()` → fetch `GET`;
3. `getGetClientesResumenQueryKey()` → `["/api/clientes/resumen"]`;
4. `getGetClientesResumenQueryOptions()`; y
5. `useGetClientesResumen()`.

La búsqueda del repositorio no encontró otro uso de `getClientesResumen`,
`getGetClientesResumenUrl`, `getGetClientesResumenQueryKey` o
`useGetClientesResumen` fuera del archivo de clientes y del código generado.

### Invalidaciones indirectas

No existe una invalidación con el query key exacto del resumen. Sí hay
invalidaciones amplias que podrían refrescarlo si está montado porque
coinciden con el prefijo `/api/clientes/`:

| Archivo | Líneas | Contexto |
| --- | ---: | --- |
| `artifacts/mariana-textil/src/components/cliente-nota-credito.tsx` | 393 | Nota de crédito; también incluye `/api/tickets/` |
| `artifacts/mariana-textil/src/pages/cliente-detail.tsx` | 360 | Ajuste de cliente |
| `artifacts/mariana-textil/src/pages/cliente-detail.tsx` | 606 | Mutación del detalle; también incluye `/api/tickets/` |
| `artifacts/mariana-textil/src/pages/cobros.tsx` | 446 | Mutación de cobro; también incluye `/api/tickets/` |
| `artifacts/mariana-textil/src/pages/cobros.tsx` | 1649 | Operación de cobro |
| `artifacts/mariana-textil/src/pages/cobros.tsx` | 1676 | Operación de ticket; también incluye `/api/tickets/` |

Estas invalidaciones no corrigen el alcance del servidor; solamente pueden
provocar una nueva lectura del mismo resultado global.

### Referencias no-runtime

`artifacts/api-server/src/clientes-ajustes-api.test.ts:L237-L243` ejerce
`/clientes/resumen` como parte de una prueba de API, y
`artifacts/api-server/src/security-api.test.ts:L1622` lo incluye en el
inventario de rutas de seguridad. Son referencias de prueba, no consumidores
de la UI.

## Diagnóstico de alcance: hallazgo abierto, sin regla financiera propuesta

El defecto no está en el formateo de los cuatro campos: está en que la ruta
calcula sobre un ledger global. **No es suficiente seleccionar primero
`cliente_id` por sitio y luego proyectar el ledger completo.** Un cliente que
opera en más de una ubicación puede tener cargos, abonos, aplicaciones o
crédito dirigido de varias ubicaciones; proyectar todo su `cliente_id` todavía
puede filtrar datos financieros de otros sitios.

Por eso este informe no propone una implementación financiera. La entrega
futura debe, con autorización explícita del propietario:

- usar `resolveReadScope` (o el helper de alcance aprobado) para distinguir
  `PROPIA` de `TODAS`;
- definir primero la atribución de cada evento financiero (ventas/cargos,
  abonos, aplicaciones y solicitudes dirigidas), incluyendo los casos
  multiubicación;
- resolver esa atribución **antes** de agregar o proyectar importes; y
- conservar los cuatro campos del contrato únicamente después de demostrar
  que cada importe pertenece al alcance autorizado.

No se aplicó ninguna corrección: la solicitud de esta iteración era documentar
el hallazgo y no cambiar `CLIENTES` ni `USUARIOS`. El esquema tampoco tiene un
FK directo `clientes.ubicacion_id`, así que no se debe asumir una regla de
pertenencia de cliente a sitio.

## Auditoría de eliminación segura (solo lectura)

### Corte e identidad de la medición

La consulta fue de solo lectura sobre el entorno `development`, sin endpoints
de autenticación y sin recuperar nombres, correos, contraseñas, hashes ni
valores de filas:

| Campo | Valor |
| --- | --- |
| `observed_at` | `2026-09-16 15:18:28.914985+00` |
| database | `heliumdb` |
| schema | `public` |
| database role | `postgres` |
| PostgreSQL | `16.10` |

La medición inspeccionó el catálogo de FKs y contó filas/IDs distintos. Además
recorrió recursivamente las únicas columnas JSON de `public` (`auditoria.datos_antes`
y `auditoria.datos_despues`) sin imprimir sus valores.

### Todas las FKs que apuntan a `ubicaciones.id`

Se encontraron **30 columnas FK**, todas con `ON DELETE NO ACTION`:

```text
auditoria.sitio_id
auditoria_inventario_escaneos.ubicacion_cierre_id
auditoria_inventario_folio.ubicacion_id
auditoria_inventario_snapshot.ubicacion_snapshot_id
auditorias_inventario.ubicacion_id
contenedores.sitio_destino_id
cuadre_fiscal_registros.ubicacion_id
entrada_folio.ubicacion_id
entradas.ubicacion_id
equipos.ubicacion_id
existencias.ubicacion_id
movimientos.ubicacion_id
notificaciones_credito.tienda_id
permisos_ubicacion.ubicacion_id
pisos.ubicacion_id
reimpresiones_etiqueta.sitio_id
rollos.ubicacion_id
salida_folio.ubicacion_id
salidas.destino_id
salidas.origen_id
sesiones_caja.ubicacion_id
sesiones_caja_dias.ubicacion_id
solicitudes_pago_dirigido.ubicacion_id
stock_minimo_episodios.ubicacion_id
stock_minimo_sitios.ubicacion_id
stock_minimos.ubicacion_id
tickets.ubicacion_id
usuarios.ubicacion_id
viaje_folio.ubicacion_id
viajes.origen_id
```

### Todas las FKs que apuntan a `usuarios.id`

Se encontraron **54 columnas FK**, todas con `ON DELETE NO ACTION`:

```text
auditoria.usuario_id
auditoria_inventario_escaneos.usuario_id
auditoria_inventario_participantes.usuario_id
auditorias_inventario.cancelada_por_id
auditorias_inventario.cerrada_por_id
auditorias_inventario.confirmada_por_id
auditorias_inventario.creada_por_id
autorizaciones_nota.usuario_id
cliente_documentos.subido_por
contenedores.usuario_id
cuadre_fiscal_registros.actor_id
cuadre_fiscal_registros.resuelto_por_id
entradas.usuario_id
equipos.actualizado_por
equipos.creado_por
equipos_checklist.checked_por
movimientos.revisado_por
movimientos.usuario_id
movimientos_credito.autorizado_por
movimientos_credito.usuario_id
notificaciones_credito.cajero_id
notificaciones_sistema.destinatario_usuario_id
pagos_proveedor.usuario_id
permisos_rol.updated_por
permisos_ubicacion.updated_por
permisos_usuario.updated_por
permisos_usuario.usuario_id
precio_historial.usuario_id
reimpresiones_etiqueta.autorizado_por
reimpresiones_etiqueta.usuario_id
revisiones_etiqueta.usuario_id
salidas.autorizado_por_id
salidas.usuario_acepta_id
salidas.usuario_cancela_id
salidas.usuario_cierra_id
salidas.usuario_entrega_id
salidas.usuario_envia_id
salidas.usuario_prepara_id
salidas.usuario_recibe_id
salidas.usuario_solicita_id
salidas_dinero_caja.creado_por_id
sesiones.usuario_id
sesiones_caja.cerrada_por_id
sesiones_caja.usuario_id
solicitudes_pago_dirigido.autorizador_id
solicitudes_pago_dirigido.solicitante_id
stock_minimo_sitios.updated_by
stock_minimos.updated_by
ticket_pagos.usuario_id
tickets.autorizado_por
tickets.cancelado_por
tickets.usuario_caja_id
tickets.usuario_terminal_id
viajes.creado_por_id
```

### Referencias lógicas y JSON consideradas

Además de las FKs se consideraron:

- `auditoria.entidad = 'ubicaciones'|'usuarios'` con `auditoria.entidad_id`;
- `notificaciones_sistema.entidad = 'ubicaciones'|'usuarios'` con
  `notificaciones_sistema.entidad_id`;
- claves JSON de ubicación observadas/declaradas:
  `ubicacionId`, `sitioId`, `origenId`, `destinoId` (y sus alias snake case
  si una instalación los conserva);
- claves JSON de usuario observadas/declaradas:
  `usuarioId`, `autorizadoPor`, `ejecutadoPor` y el `id` anidado en
  `confirmadorAdmin`.

Los `null` JSON no se trataron como referencias. Un valor no numérico en una
clave que representa un ID se considera no resoluble y bloquea la conclusión
de elegibilidad.

### Conteo actual sin valores de filas

| Entidad | Total | Inactivos | Columnas FK | Filas FK | IDs actuales con alguna FK | IDs actuales en JSON | Referencias JSON (fila/clave) | IDs actuales en auditoría | Notificaciones |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `ubicaciones` | 11 | 3 | 30 | 414 | 11 | 7 | 232 | 1 | 0 |
| `usuarios` | 31 | 23 | 54 | 4,223 | 31 | 1 | 246 | 8 numéricos | 0 |

### Ubicaciones reales versus alcance de la UI administrativa

La tabla anterior cubre toda la tabla `ubicaciones`, incluyendo tipos de
sistema/virtuales. La ruta que alimenta la pantalla administrativa no expone
todos esos tipos: `artifacts/api-server/src/routes/locations.ts:L55-L64`
aplica `tipo IN ('TIENDA', 'BODEGA')`; la pantalla
`artifacts/mariana-textil/src/pages/ubicaciones.tsx:L134-L145` solo solicita
inactivos cuando el usuario es `ADMIN`. La misma pantalla se describe como
administración de tiendas y bodegas en `L254-L260`.
Para `ADMIN`, `includeInactive=true` da 9 filas de UI (6 activas y 3
inactivas); para un usuario no ADMIN la misma consulta devuelve solo las 6
activas de esos dos tipos.

El desglose actual (solo conteos, sin nombres ni valores de filas) es:

| Tipo | Total | Activas | Inactivas | Inactivas + cero refs | ¿En UI admin? | Total UI | Inactivas UI | Inactivas UI + cero refs |
| --- | ---: | ---: | ---: | ---: | :---: | ---: | ---: | ---: |
| `TIENDA` | 5 | 3 | 2 | 0 | Sí | 5 | 2 | 0 |
| `BODEGA` | 4 | 3 | 1 | 0 | Sí | 4 | 1 | 0 |
| `TRANSITO` | 1 | 1 | 0 | 0 | No | 0 | 0 | 0 |
| `EXTERNO` | 1 | 1 | 0 | 0 | No | 0 | 0 | 0 |
| **Todos los tipos** | **11** | **8** | **3** | **0** | — | **9** | **3** | **0** |

La comparación de elegibilidad por universo es, por tanto:

| Universo | Total | Inactivas | Cero referencias conocido | Elegibles inactivas + cero refs |
| --- | ---: | ---: | ---: | ---: |
| Toda `ubicaciones` (incluye tipos de sistema) | 11 | 3 | 0 | `0 / 3` |
| UI administrativa (`TIENDA` + `BODEGA`) | 9 | 3 | 0 | `0 / 3` |

No se debe presentar `0 / 3` de la UI como si fueran las 3 ubicaciones
virtuales restantes: esas 2 ubicaciones (`TRANSITO` y `EXTERNO`) quedan fuera
del listado administrativo, pero sí se incluyen en la auditoría de referencias.

Para `usuarios`, además de los 28 eventos de auditoría con IDs numéricos,
existen 62 eventos `LOGIN_FALLIDO*` cuyo `entidad_id` es texto de identidad:

- 39 se pueden asociar internamente a 4 IDs de usuarios actuales;
- 23 no se pueden resolver a ningún usuario actual.

No se imprimieron esos identificadores. Esos 23 eventos son la caveat
conservadora: no se puede declarar una razón completa de cero referencias para
usuarios mientras sigan existiendo identificadores lógicos no resolubles.

### Ratios de elegibilidad

La definición solicitada fue `inactiva AND cero referencias de cualquier tipo`.

- **Ubicaciones:** `0 / 3` inactivas elegibles (`0 / 11` del total). La
  cobertura de referencias resolubles es completa en este corte; las 11
  ubicaciones actuales tienen al menos una referencia.
- **Usuarios (referencias conocidas):** `0 / 23` inactivos tienen cero
  referencias conocidas. Esto sí está probado por las FKs: los **31 / 31**
  usuarios actuales, incluidos los 23 inactivos, tienen al menos una FK
  conocida. Por lo tanto, los 23 identificadores de login no pueden convertir
  a ningún usuario actual en elegible.
- **Usuarios (completitud):** el estado de cobertura global sigue siendo
  **BLOQUEADO** por los 23 `entidad_id` lógicos de login no resolubles. No se
  debe reportar ese bloqueo como un ratio final `0 / 23`; el resultado correcto
  es `0 / 23` **conocido/probado** y `BLOQUEADO` para la completitud.

Conclusión operativa: no hay candidato actual que pueda considerarse
eliminable con seguridad. No se ejecutó ninguna eliminación.

## Estado de DELETE y límites del cambio

- `artifacts/api-server/src/lib/purga-catalogos.ts:L5-L12` enumera
  `usuarios`, `camionetas`, `choferes`, `clientes`, `proveedores` y
  `productos`; **no incluye `ubicaciones`**.
- `artifacts/api-server/src/app.ts:L55` monta las rutas bajo `/api`;
  `artifacts/api-server/src/routes/purga.ts:L20` protege `/purga` con
  `requireSession` y `requireRole("ADMIN")`; `L40` registra exactamente
  `router.delete("/purga/:entidad/:id", ...)`. Con el montaje `/api`, la ruta
  existente para usuarios es **`DELETE /api/purga/usuarios/:id`**. Su caller
  debe ser una sesión autenticada con rol `ADMIN` y confirmar el borrado en el
  body (`L41-L71`).
- `lib/api-zod/src/generated/api.ts:L11156-L11173` restringe el parámetro
  `entidad` del preflight a la misma enum, que incluye `usuarios` y excluye
  `ubicaciones`.
- `purga-catalogos.ts:L154-L275` cuenta FKs, bitácora y notificaciones para
  entidades purgables. No agrega las referencias JSON auditadas en este
  informe.
- La ruta específica `artifacts/api-server/src/routes/users.ts` solo declara
  GET/POST/PATCH para `/users`; eso no elimina la ruta genérica de purga
  anterior. La diagnosis inicial “no DELETE construido” significa “no se
  añadió DELETE en esta tarea”, no “usuarios carece de DELETE”: el DELETE
  administrativo anterior no fue modificado. No existe un DELETE de ubicación
  en el catálogo purgable.
