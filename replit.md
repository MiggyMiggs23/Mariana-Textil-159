# Mariana Textil

Sistema interno de inventarios, ventas y transferencias para las tiendas y
bodegas de Mariana Textil. No es un sistema contable ni fiscal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API en `/api`
- `pnpm --filter @workspace/mariana-textil run dev` — aplicación web
- `pnpm run typecheck` — verificación completa de TypeScript
- `pnpm --filter @workspace/api-spec run codegen` — regenera cliente y Zod desde OpenAPI
- `pnpm --filter @workspace/db run push` — aplica el esquema Drizzle en desarrollo
- `pnpm --filter @workspace/db run seed` — precarga ubicaciones y el ADMIN inicial
- Requiere `DATABASE_URL` con una conexión PostgreSQL

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
- `lib/db/src/schema/` — esquema Drizzle
- `lib/db/src/seed.mjs` — datos iniciales
- `artifacts/api-server/src/routes/` — endpoints
- `artifacts/api-server/src/middlewares/auth.ts` — sesión e inactividad
- `artifacts/mariana-textil/src/lib/permisos.ts` — única fuente de verdad para módulos visibles por rol
- `artifacts/mariana-textil/src/` — interfaz web

## Architecture decisions

- El kardex será la fuente de verdad del inventario: toda alteración futura inserta movimientos con cantidades firmadas.
- Las tablas operativas no usan DELETE; las correcciones son movimientos inversos que referencian el original.
- Toda operación que modifica datos debe registrar usuario, entidad y valores antes/después en `auditoria`.
- Cantidades usan `DECIMAL(10,3)` y dinero `DECIMAL(12,2)`; nunca float.
- Toda operación futura de inventario debe usar una transacción SQL con bloqueo de fila.
- Las operaciones futuras reciben un UUID del cliente para garantizar idempotencia.
- El filtrado por ubicación siempre se aplica en consultas del servidor, no solo en la interfaz.

## Product

- Login sin registro público ni recuperación de contraseña
- Sesiones de 12 horas con vencimiento por 30 minutos de inactividad
- Bloqueo temporal después de cinco intentos fallidos
- Dashboard con conteos iniciales e inventario en cero por ubicación
- Administración sin borrado de ubicaciones y usuarios
- Navegación completa filtrada por rol; módulos futuros aparecen como “Próximamente”

## Gotchas

- Ejecuta `codegen` después de cada cambio en OpenAPI.
- Ejecuta `push` y luego `seed` al preparar una base de datos nueva.
- Cambia la contraseña del usuario `admin` inmediatamente después del primer acceso.