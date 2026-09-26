# Ejecución nativa: regresiones aprobadas y bloqueos concretos

## Identidad del entorno

Confirmados en respuesta HTTP del proxy: API `f3870a6e76bee58a0237e345dec303e11cf9e42af6acd99fa6314de416fc0e97`, UI `c80639769e32336b6fcb64d990c14c7b6324bee4bcb61a9793355bbda17ae446`, reloj `2026-10-02T18:00:00.000Z`. Contextos Chromium con zona America/Mexico_City y script de reloj instalado antes de abrir páginas. Ningún cambio de código de aplicación, gate, fecha histórica ni escritura SQL.

## A/F: 26 comprobaciones aprobadas

`corrected-profile-boundaries/result.json` registra:

- Identidad y sesión simultáneas: seis peticiones concurrentes por perfil, todas 200. Identidades A238 y F237 originales.
- Ambos perfiles: Fondo, proveedor226/pagos, ticket1 y cliente2583 rechazados por API403 y pantallas de Fondo/proveedores/reportes/productos denegadas.
- A: pantallas Finanzas/Preparaciones y proyección financiera permitidas. F: fiscal/conciliaciones permitidas y proyección fiscal **no vacía**, incluye factura1. Sin campos de costo/margen/Fondo/credenciales en las proyecciones consultadas.
- Denegación cruzada A→fiscal y F→finanzas403.
- Pagos del cliente2583 ahora200.

No se afirma que todos los errores de sesión estén resueltos: después de consultar Precios e historial, un nuevo login F fue200 pero su lectura automática posterior `/api/auth/me` devolvió500 a las **06:04:55.145Z**. Correlación enviada `priority-browser-F-READBACK-1790402689818-202`. La lectura siguiente de conciliaciones sí devolvió200.

## Fiscal: operación incierta real, no repetir

La factura1 sigue con fecha histórica **2026-09-26T05:13:43.647Z**, importe1160.00. Documento fiscal real abierto y fuente no vacía verificados.

Se preparó nativamente el snapshot DIA 2026-09-25→26. El POST `/api/e11/conciliaciones` a las **05:59:20.091Z** respondió **503 RESULTADO_INCIERTO**:

- requestId **b52512fe-ec67-40a2-a42c-d60d6342a476**
- UUID de intención **b2548914-0933-4a8f-a67d-b925b0a8df68**
- Correlación enviada `priority-browser-F-CLOSED-1790402359054-71`

No se repitió el POST con otro UUID. La interfaz bloqueó las intenciones posteriores: día aceptado, semana y mes permanecen pendientes. La lectura independiente posterior muestra DIA `PENDIENTE`, `ultimaConciliacionId:null`; esto **no autoriza automáticamente un nuevo UUID** frente al resultado incierto.

No hubo decisión NO_CUADRA ni aviso ADMIN, porque no se alcanzó el snapshot. El plan conserva el orden correcto: primero discrepancia documental declarada1159 frente a factura1160; después revisión vinculada de día aceptada, semana aceptada y mes aceptado. La UI prohíbe nueva versión después de ACEPTADA.

Fuentes: `closed-periods-confirmed/result.json` y sus PNG. El primer recorrido `closed-periods-native` agotó una espera demasiado corta de consulta; no envió ningún POST fiscal y no se cuenta como defecto del producto.

## Auditoría: inconsistencia de relojes impide escanear

Se crearon mediante UI dos nuevos auditores sintéticos239/240 porque el paquete recuperado sólo contenía credenciales ADMIN/F/A; no se recrearon ni modificaron A/F. Auditoría1 nativa del sitio835, snapshot seis rollos propios. Tres sesiones239/240/234 se unieron concurrentemente; todas las respuestas `/participar` fueron200 y los heartbeats continuaron200.

Sin embargo, con navegador fijado al 2 de octubre, la API entregó vencimientos del **26 de septiembre**. Ejemplo usuario239: `ultimoAt=2026-09-26T06:03:02.416Z`, `expiraAt=2026-09-26T06:04:32.416Z`. La UI mostró inmediatamente **«Tu participación venció. Escaneo bloqueado hasta renovarse»**, pese a los heartbeats200. El selector de piso no abrió y el input permaneció deshabilitado.

Esto es evidencia de una inconsistencia del entorno con reloj controlado, no prueba de un fallo de duplicado en tiempo normal. No hubo POST de escaneo; lectura independiente final **0 escaneados**. Auditoría queda abierta, sin aplicar. Los pasos de tres escaneos y duplicado están pendientes; no deben marcarse aprobados. Historial y PNG: `three-user-audit-confirmed`.

## Otros errores500 aún reproducibles

- `/api/precios`: 06:04:38.792Z, `INTERNAL_ERROR`, correlación `priority-browser-ADMIN-REGRESSION-1790402673056-157`.
- `/api/clientes/2583/comportamiento-pago`: 06:04:48.309Z y06:04:55.138Z, `INTERNAL_ERROR`, correlaciones `priority-browser-ADMIN-REGRESSION-1790402682384-173` y `priority-browser-ADMIN-REGRESSION-1790402688665-189`.

Los401 anteriores al envío de cada formulario de login son esperados y están separados del500 posterior al login.

## Continuación segura

Todos los navegadores se cerraron; escritor liberado para diagnóstico/corrección MAIN. Credenciales y journal quedan exclusivamente en `/tmp/priority-fiscal-20260926/browser/state.json`. No reabrir desde cero ni recrear fixture: conservar el UUID fiscal incierto, actores239/240 y auditoría1. MAIN necesita resolver el503 de snapshot y consistencia de reloj de heartbeat, además de los500 indicados. No se leyeron logs privados de runtime por este trabajador.