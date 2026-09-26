# Correcciones de nivel y aprovechamiento de carta

Estado: **migración aplicada y ambas correcciones activas en el workspace**. Configuración confirmada por el propietario.

## Impresión
PDFs diagnósticos del componente real: 22 a 38 filas de cuatro series, máximo 88 a 152 folios por hoja exclusiva de series. Grupos con filas parciales pueden reducir esa capacidad. Misma letra y diseño; carta 215.9 × 279.4 mm, margen interior conservado 5.25 mm. No certifica margen mínimo de impresora física. Quince escenarios PDF y ocho contratos pasaron. Evidencia en print/.

## Pisos
Implementación numérica y formulario activos, sin nombres especiales en la selección. Pruebas enfocadas aprobadas; builds congelados reproducibles y typechecks completos de API/UI aprobados. La migración revisada se probó primero en PostgreSQL desechable y después se aplicó en la conexión efectiva del proceso. No reejecutar la migración.

Lectura de la conexión actualmente configurada: heliumdb, con trece pisos en cinco sitios. Mariana, Cruces, Coco y Don Nacho tienen mínimo Planta Baja; Tomás, Primer Piso. Lucas Alamán y Bodega Cruces aparecen inactivos sin pisos.

La lectura independiente de Neon no corresponde al workspace confirmado y no se modificó. Solo se añadió nivel y se asignaron sus trece valores en la base efectiva del workspace. Evidencia: executed-migration-proof.json. Se preservaron todos los valores anteriores de pisos y sitios, incluidos timestamps; solo pisos tuvo escrituras en la transacción de migración.

Ambos workflows RUNNING con guardas válidas. API /api/healthz HTTP 200. HTML servido y candidato coinciden: 67d8edc309bf05cd718d2f55c7f1a0966bb0927bf086d0111feef4f48b4852a9. API: e3a10e34c6c65ddde494fb9a780e267c8364694c0bd3d67809d9ad10f3914a10. Arranque con inspection boot, sin mantenimiento. El preview anónimo mostró comprobación de sesión y 401, no un recorrido autenticado. No se republicó producción externa.