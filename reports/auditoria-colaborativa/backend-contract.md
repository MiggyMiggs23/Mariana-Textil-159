# Contrato backend colaborativo

- Ruta canónica existente: `/api/inventario/auditorias/:id`. Nueva operación `POST /api/inventario/auditorias/:id/participar` sin cuerpo, operationId `participarAuditoriaInventario`.
- Mismas guardas de sesión, permiso editar, rol operativo y sitio que escaneo. No requiere autorizar. Solo ABIERTA.
- Respuesta: `{ participantesActivos: number, maxParticipantes: 5, expiracionSegundos: 90, expiraAt: string ISO }`. UI renueva cada 20 s mientras participa; no hay salida destructiva. Usuarios distintos, no pestañas.
- Detalle añade `participantesActivos`, `maxParticipantes`, `expiracionSegundos`; participantes históricos conservan nombre/escaneos/fechas y añaden `activo: boolean`, `expiraAt: string ISO`. En auditoría no ABIERTA todos inactivos.
- Resultados añaden `usuarioId: number|null`, `usuarioNombre: string|null`; se conserva `escaneadoAt` ISO/null. Son del primer escaneo, nunca del último intento.
- Escaneo responde también los cuatro campos de participación y `usuarioId`, `usuarioNombre`, `escaneadoAt` originales (incluido duplicado). El duplicado no incrementa escaneos ni cambia piso/autor.
- Sexto activo: HTTP 409 `{code:"AUDIT_PARTICIPANT_LIMIT", error:"Ya hay 5 usuarios activos en esta auditoría. Espera a que se libere un lugar."}`. Miembro no expirado puede renovar a cupo lleno; expirado vuelve a competir.
- Admisión y escaneo toman cabecera FOR UPDATE antes de leer reloj DB/cupo; cierre/cancelación usan el mismo candado. Solo se reutilizan participantes. No DDL, borrados ni reloj cliente.

## Pisos: ampliación

- Catálogo dedicado: `GET /api/inventario/auditorias/:id/pisos`, operationId `listPisosAuditoriaInventario`; devuelve exactamente `{ id: number, nombre: string, ubicacionId: number, activo: boolean }[]`, solo activos, `nombre ASC`. Requiere sesión, permiso auditoria_inventario/ver, rol operativo y mismo guard de sitio del detalle. NO requiere permisos ubicaciones. No modifica `/locations/:id/pisos`. Array vacío es configuración faltante, no fallback.

- Cerrar exige **editar y autorizar** de auditoria_inventario, además de sesión/rol/sitio existentes. Ser participante o creador no sustituye autorizar. No existía restricción adicional creador/ADMIN para cerrar. Cancelar conserva editar/rol/sitio; confirmar conserva autorizar + ADMIN.

- Orden autoritativo: `GET /locations/:id/pisos` ordena por `nombre ASC` en PostgreSQL. Acceso = primer piso **activo** en ese orden, nunca inferido del nombre (“PB”, “planta baja”, etc.).
- Todo escaneo exige piso activo del mismo sitio. Ningún piso activo: HTTP 400 `FLOOR_CONFIGURATION_REQUIRED`. Piso ausente/inválido: `INVALID_FLOOR`. Computadora fuera del primero: HTTP 400 `DESKTOP_ACCESS_FLOOR_REQUIRED`.
- No existe vínculo autenticado sesión/navegador/equipo en AuthContext; equipos son activos patrimoniales de sitio. Ruta deriva escritorio del User-Agent (`Android|iPhone|iPad|iPod|Mobile|Tablet` = móvil; ausente/resto = escritorio). Es heurística ergonómica falsificable, NO autorización. No se acepta bandera de cliente/cuerpo ni viewport. Permisos/sitio permanecen obligatorios.
- Servidor permite móvil en cualquier piso válido; UI ofrece los otros pisos, conforme a la instrucción “mobile anyvalid” para API. Escritorio fija el primero. El dominio recibe `desktop` derivado exclusivamente por la ruta, por defecto true para llamadas internas.