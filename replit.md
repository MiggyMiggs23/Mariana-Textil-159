# Mariana Textil

Sistema interno de inventarios, ventas y transferencias para las tiendas y
bodegas de Mariana Textil. No es un sistema contable ni fiscal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API en `/api`
- `pnpm --filter @workspace/mariana-textil run dev` — aplicación web
- `pnpm run typecheck` — verificación completa de TypeScript
- `pnpm --filter @workspace/api-spec run codegen` — regenera cliente y Zod desde OpenAPI
- `pnpm run db:verify` — muestra la identidad segura de la base canónica y valida el esquema mínimo
- `pnpm --filter @workspace/db run push` — aplica el esquema Drizzle en desarrollo
- `pnpm --filter @workspace/db run seed` — precarga ubicaciones y el ADMIN inicial
- La API, Drizzle, migraciones, pruebas y seed usan exclusivamente el `DATABASE_URL` administrado por Replit.
- El proyecto externo visible en el MCP de Neon no es la base de esta aplicación y no debe usarse para consultar ni modificar sus datos.

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
- `lib/db/src/schema/` — esquema Drizzle (incluye `permisos.ts`, `clientes.ts`)
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
- **Permisos:** el servidor valida permisos en cada endpoint. La resolución es: override de usuario (non-null) > permiso de rol > denegar. Sin fila = denegar siempre.
- **Separación financiera:** clientes y proveedores tienen módulos separados para operativo vs. financiero. Los campos financieros no se envían al cliente cuando falta el permiso.
- **Invariantes ADMIN:** ADMIN nunca puede perder acceso a `usuarios` y `permisos`. Un usuario no puede modificar sus propios permisos.

## Permission modules (25 total)

`dashboard`, `pos`, `entradas`, `salidas`, `transferencias`, `movimientos`, `inventario`, `productos`, `ajustes`, `clientes`, `clientes_credito`, `clientes_precios`, `clientes_finanzas`, `proveedores`, `proveedores_finanzas`, `contenedores`, `ubicaciones`, `usuarios`, `permisos`, `resumen_caja`, `cortes`, `cobros_pagos`, `reportes`, `conciliacion`, `auditoria`

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

## Gotchas

- Ejecuta `codegen` después de cada cambio en OpenAPI.
- Ejecuta `push` y luego `seed` al preparar una base de datos nueva.
- Ejecuta `pnpm run db:verify` antes y después de cualquier cambio de esquema; debe identificar la misma base que el proceso de la API.
- Cambia la contraseña del usuario `admin` inmediatamente después del primer acceso.