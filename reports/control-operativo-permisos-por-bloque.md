# Control operativo: planteamiento de autorización por bloque

Estado: propuesta solamente. No implementada. El bloqueo ADMIN actual sigue vigente y es provisional, según replit.md.

## Objetivo

Permitir que cada usuario consulte en Control únicamente información que ya puede consultar en las fuentes originales. No ampliar el acceso financiero, territorial ni a documentos. Aplicar la misma selección en pantalla, PDF y XLSX.

Los permisos efectivos pueden personalizarse por usuario, rol y ubicación: las listas de roles por defecto siguientes no sustituyen la evaluación real.

## Siete bloques

| Bloque | Política de origen a reutilizar | Roles por defecto, además de ADMIN | Trabajo necesario |
|---|---|---|---|
| Diferencias de caja | La consulta `/admin/diferencias` exige ADMIN; no equivale a permisos de Caja. | Ninguno. | Mantener el bloque reservado a ADMIN. Autorizar antes de llamar al lector. Conservar totales, umbrales y agrupaciones del origen. |
| Tickets cancelados | `reportes.ver`, como la fuente de Reportes/Ventas. | SUPERVISOR, SISTEMAS, CONTADOR. | Autorizar el lector antes de consultar; preservar filtros, conteo único y restricciones económicas. |
| Salidas canceladas | `salidas.ver`, más la autorización territorial de las salidas. | TERMINAL, SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. | Aplicar la política al SQL agregado y a sus enlaces; tener permiso de un documento no autoriza una consulta global. |
| Salidas pendientes de más de 24 horas | La alerta exacta `/admin/alertas` exige ADMIN. La lectura ordinaria de una salida usa `salidas.ver`, pero no es la misma autorización del indicador. | Ninguno para la alerta exacta. | Conservar ADMIN y el umbral estricto de más de 24 horas. Abrir este indicador a otros roles sería una ampliación que requiere aprobación aparte; no es necesaria para reutilizar sin ampliar los permisos actuales. |
| Abonos incongruentes | Cuentas destino permite por rol ADMIN, CONTADOR y SISTEMAS. No se sustituye por `cobros_pagos.ver`. | CONTADOR, SISTEMAS. | Autorizar antes de consultar cada sitio; mantener el criterio de incongruencia, paginación completa, importes y evidencia. |
| Ajustes de inventario | `movimientos.ver` para lectura; crear y autorizar ajustes son capacidades distintas. | SUPERVISOR, BODEGA, SISTEMAS, CONTADOR. | Autorizar el resumen y sus sitios; conservar tipos de movimientos. Revisar el destino del enlace, pues el menú Ajustes usa un permiso distinto y no debe producir accesos fallidos para quien solo tiene lectura del movimiento. |
| Rollos con tres o más reimpresiones | `etiquetas.ver` permite el resumen de rollos con conteo y última fecha. El historial de reimpresiones y su exportación continúan reservados a ADMIN. | SUPERVISOR, BODEGA, SISTEMAS. | Mostrar solo el resumen autorizado, con el umbral y rango actuales. La serie enlaza al rollo sujeto a su autorización. No añadir historial individual, actores, motivos ni columna «Ver documento». |

## Acceso a Control sin abrir las demás pestañas

Actualmente Reportes exige `reportes.ver` y Control añade ADMIN. BODEGA y TERMINAL no tienen `reportes.ver` por defecto, aunque tienen permisos de algunas fuentes.

Para cumplir el objetivo completo, la propuesta incluye una entrada limitada a Control cuando exista al menos un bloque autorizado. No se debe conceder `reportes.ver` globalmente para resolverlo: eso abriría otras consultas.

- ADMIN: los siete bloques.
- SUPERVISOR: tickets cancelados, salidas canceladas, ajustes y resumen de reimpresiones.
- SISTEMAS: los anteriores y abonos incongruentes.
- CONTADOR: tickets cancelados, salidas canceladas, ajustes y abonos incongruentes.
- BODEGA: salidas canceladas, ajustes y resumen de reimpresiones mediante la entrada limitada propuesta.
- TERMINAL: salidas canceladas mediante esa entrada limitada.
- CAJA: ningún bloque con los permisos por defecto actuales; no habilitar una entrada vacía.

Esta enumeración describe el resultado propuesto con defaults, no las personalizaciones vigentes de usuarios reales. La evaluación efectiva debe hacerse en servidor.

## Implementación prevista, no realizada

1. Resolver acceso a Control y una política por bloque, sin depender solamente de ocultamiento visual.
2. Evaluar autorización antes de invocar cada lector: ocultar datos después de consultarlos no basta.
3. Mantener para cada fuente su autorización territorial. El selector del encabezado y Comparar nunca deben ampliar el alcance del usuario. Un bloque puede tener un alcance menor que otro.
4. Separar explícitamente bloque no autorizado de bloque autorizado sin resultados. El primero no aporta filas, metadatos, contadores ni totales; no representarlo con ceros ficticios.
5. Conservar las cifras y reglas históricas. Derivar los resultados de la selección autorizada sin sumar métricas no aditivas ni reconstruir los totales propios de Caja con otra fórmula.
6. Compartir la selección entre pantalla, PDF y XLSX. Filtrar también catálogos, avisos, nombres de sitios y enlaces; no solo las tablas.
7. Revisar los enlaces por su permiso real de destino. Ver un resumen no otorga acceso a todo documento relacionado.
8. Verificar permisos personalizados, ámbitos de sitio, solicitudes directas a exports y ausencia de consultas a lectores no autorizados. Conservar el bloqueo provisional hasta terminar esas comprobaciones.

## Estimación

| Parte | Horas técnicas |
|---|---:|
| Matriz efectiva y acceso limitado a Control | 4–6 |
| Autorización de siete bloques, alcance y restricciones | 8–14 |
| Pantalla, Comparar, PDF/XLSX y enlaces | 6–10 |
| Pruebas técnicas de regresión y ausencia de filtraciones | 6–10 |
| **Total** | **24–40** |

Aproximadamente 3–5 jornadas técnicas. Sin migración prevista, reutilizando permisos existentes. Abrir Diferencias o la alerta de más de 24 horas a nuevos roles sería una decisión adicional, fuera de esta estimación.

Las pruebas técnicas de una futura implementación no sustituyen los recorridos reales de documentos ni las sesiones por rol que el usuario reservó para sí. Esta entrega solo plantea los permisos.

## Evidencia de código consultada

- `artifacts/api-server/src/routes/reportes.ts`: entrada Reportes, gate provisional y alcance de consultas.
- `artifacts/api-server/src/routes/admin-analytics.ts`: guardias de Diferencias y Cuentas destino.
- `artifacts/api-server/src/routes/admin-alertas.ts`: guardia de la alerta de salidas.
- `artifacts/api-server/src/lib/admin-alertas.ts`: umbral de 24 horas.
- `artifacts/api-server/src/lib/reportes-control-operativo.ts`: seis lectores y estructura de los bloques.
- `artifacts/api-server/src/lib/reportes-composed-export.ts`: composición con Diferencias.
- `artifacts/api-server/src/routes/salidas.ts`: lectura y exportación con `salidas.ver`.
- `artifacts/api-server/src/routes/inventario.ts`: lectura de movimientos y permisos de operación separados.
- `artifacts/api-server/src/routes/etiquetas.ts`: resumen autorizado y separación del historial ADMIN.
- `lib/db/src/lib/seed-permissions.mjs`: defaults por rol.
- `artifacts/api-server/src/lib/permisos.ts`: resolución efectiva de permisos.
- `artifacts/mariana-textil/src/components/layout/app-navigation.ts`: menú sujeto a permisos.