# Mariana Textil

Sistema interno de inventarios, ventas y salidas entre ubicaciones para las tiendas y
bodegas de Mariana Textil. No es un sistema contable ni fiscal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API en `/api`
- `pnpm --filter @workspace/mariana-textil run dev` — aplicación web
- `pnpm run typecheck` — verificación completa de TypeScript
- `pnpm --filter @workspace/api-spec run codegen` — regenera cliente y Zod desde OpenAPI
- `pnpm run db:verify` — muestra la identidad segura de la base canónica y valida el esquema mínimo
- `pnpm --filter @workspace/db run push` — aplica el esquema Drizzle en desarrollo
- `NODE_ENV=development pnpm --filter @workspace/db run seed` — precarga ubicaciones y el ADMIN inicial en desarrollo
- `ADMIN_SEED_PASSWORD` — contraseña inicial del ADMIN; obligatoria fuera de desarrollo
- La API, Drizzle, migraciones, pruebas y seed usan exclusivamente el `DATABASE_URL` administrado por Replit.
- El proyecto externo visible en el MCP de Neon no es la base de la aplicación. Solo puede usarse para ramas/base desechables de pruebas; nunca como conexión de la app ni para datos reales.

## Stack

- pnpm workspaces, Node.js, TypeScript
- React + Vite + Tailwind CSS
- Express 5
- PostgreSQL + Drizzle ORM
- Contrato OpenAPI con cliente React Query y validadores Zod generados
- Sesiones propias mediante cookies httpOnly
- Zona horaria funcional: `America/Mexico_City`

## Where things live

- `lib/api-spec/openapi.yaml` — contrato de la API
- `lib/db/src/schema/` — esquema Drizzle (incluye permisos, clientes e historial inmutable de precios)
- `lib/db/src/seed.mjs` — datos iniciales con matriz de permisos por rol
- `artifacts/api-server/src/routes/` — endpoints
- `artifacts/api-server/src/middlewares/auth.ts` — sesión e inactividad
- `artifacts/api-server/src/lib/permisos.ts` — servicio central de permisos (resolvePermiso, requierePermiso, buildPermissionMatrix)
- `artifacts/api-server/src/routes/permisos.ts` — API de administración de permisos
- `artifacts/api-server/src/routes/clientes.ts` — catálogo operativo de clientes
- `docs/endpoint-permissions.md` — matriz completa de endpoints con módulo/acción
- `artifacts/mariana-textil/src/` — interfaz web (permisos.ts como caché del servidor)

## Architecture decisions

- El kardex es la fuente de verdad del inventario: toda alteración inserta movimientos con cantidades firmadas.
- Las tablas operativas no usan DELETE; las correcciones son movimientos inversos que referencian el original.
- Toda operación que modifica datos registra usuario, entidad y valores antes/después en `auditoria`.
- Cantidades usan `DECIMAL(10,3)` y dinero `DECIMAL(12,2)`; nunca float.
- Toda operación de inventario usa una transacción SQL con bloqueo de fila.
- Las operaciones reciben un UUID del cliente para garantizar idempotencia.
- El filtrado por ubicación siempre se aplica en el servidor, no solo en la interfaz.
- **Permisos:** ADMIN tiene acceso total a los 24 módulos sin consultar tablas. Para CAJA, INVENTARIOS y BODEGA la resolución es: override de usuario (non-null) > permiso de rol > denegar.
- **Separación financiera:** clientes y proveedores tienen módulos separados para operativo vs. financiero. Los campos financieros no se envían al cliente cuando falta el permiso.
- **Invariantes ADMIN:** ADMIN no participa en la matriz ni acepta overrides; siempre tiene acceso total. Un usuario no puede modificar sus propios permisos.
- **Gobierno de precios:** `/precios` exige rol ADMIN directamente en el servidor. El costo actual es ponderado por cantidad disponible y unidad; sin costos válidos permanece pendiente (`null`), nunca cero.
- **Historial comercial:** todo cambio de precio bloquea el producto, captura costo/margen del momento y escribe historial más auditoría en la misma transacción. Nunca recalcula tickets existentes.

## Permission modules (24 total)

`dashboard`, `pos`, `entradas`, `salidas`, `movimientos`, `inventario`, `productos`, `ajustes`, `clientes`, `clientes_credito`, `clientes_precios`, `clientes_finanzas`, `proveedores`, `proveedores_finanzas`, `contenedores`, `ubicaciones`, `usuarios`, `permisos`, `resumen_caja`, `cortes`, `cobros_pagos`, `reportes`, `conciliacion`, `auditoria`

## Product

- Login sin registro público ni recuperación de contraseña
- Sesiones de 12 horas con vencimiento por 30 minutos de inactividad
- Bloqueo temporal después de cinco intentos fallidos
- Dashboard con conteos iniciales e inventario por ubicación
- Administración sin borrado de ubicaciones y usuarios
- Sistema de permisos configurable: matriz por rol + excepciones por usuario
- Matriz efectiva de permisos incluida en login y /auth/me
- Catálogo operativo de clientes (sin datos financieros en el listado)
- Módulos de clientes y proveedores divididos: operativo vs. financiero
- Módulo ADMIN de Precios con filtros, semáforo, margen, vista previa obligatoria, gráfica e historial por producto

## Gotchas

- Ejecuta `codegen` después de cada cambio en OpenAPI.
- Ejecuta `push` y luego `NODE_ENV=development pnpm --filter @workspace/db run seed` al preparar la base de desarrollo.
- Ejecuta `pnpm run db:verify` antes y después de cualquier cambio de esquema; debe identificar la misma base que el proceso de la API.
- Toda E2E que necesite crear usuarios, sesiones o datos debe usar una rama Neon desechable con una base vacía, esquema y seed actuales. `TEST_DATABASE_URL` debe existir y ser distinta de `DATABASE_URL`.
- Está prohibido crear ADMIN temporales o limpiar usuarios/sesiones mediante `executeSql({ environment: "development" })`. La limpieza E2E consiste en eliminar únicamente la rama Neon desechable.
- Los precios existentes solo se modifican por `/precios`; `PATCH /productos/:id` rechaza cualquier intento de evadir el historial. El precio inicial al crear producto sí está permitido.
- Cambia la contraseña del usuario `admin` inmediatamente después del primer acceso.