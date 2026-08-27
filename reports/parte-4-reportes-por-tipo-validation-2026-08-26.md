# Parte 4 — Validación de reportes por tipo de venta

Fecha local: 2026-08-26  
Entorno de datos: rama Neon desechable con base `parte4_reports_integral_test_e2e_20260827`  
Development: no se crearon, modificaron ni eliminaron usuarios, sesiones o datos.

## Alcance validado

- Ventas y Utilidad separan ROLLOS y METRAJE en servidor, interfaz y exportación.
- ROLLOS usa costo exacto congelado; METRAJE usa el costo de referencia congelado y conserva su procedencia.
- Un costo ausente deja costo, utilidad y margen pendientes.
- Los pagos de tickets mixtos se prorratean por subtotal de componente y no se duplican entre modalidades.
- Inventario y Compras declaran explícitamente cuándo la modalidad no aplica.
- Rotación, Mapas de Calor, Color y Clientes respetan el filtro de modalidad.
- Diferencias de Caja grafica el porcentaje real de cortes exactos.
- SUPERVISOR y TERMINAL no reciben ni muestran información económica restringida.
- No se implementó funcionalidad de Parte 5.

## Pruebas automatizadas

- Reportes unitarios: **62/62**.
- Integración completa de Reportes: **4/4**.
- Contrato de analytics ADMIN: **14/14**.
- Integración de analytics ADMIN: **1/1**.
- Migración repetible de líneas de ticket: **1/1**.
- POS/caja: **23/23**.
- Typecheck completo del workspace: aprobado.
- `git diff --check`: aprobado.

La regresión de pagos mixtos usa un ticket con componentes 60/40. La prueba exige que los importes filtrados sean 818 para ROLLOS y 156 para METRAJE, cuya suma coincide exactamente con el total combinado de 974.

## E2E de navegador

El API se reinició temporalmente con la URL de la base Neon desechable y se restauró al workflow normal al terminar.

- ADMIN, Ventas: total 520; ROLLOS 320; METRAJE 200.
- ADMIN, filtro ROLLOS: URL y resultados limitados a 320.
- ADMIN, filtro METRAJE: URL y resultados limitados a 200.
- ADMIN, Utilidad ROLLOS: costo 128, utilidad 192, margen 60%.
- ADMIN, Utilidad METRAJE: costo 60, utilidad 140, margen 70%.
- La venta facturada calcula margen sobre subtotal 320, no sobre total con IVA 336.
- Exportación filtrada: archivo descargado con `modalidad=METRAJE` y sin filas ROLLOS.
- Diferencias de Caja: dos cortes, uno exacto y uno no exacto; exactitud visible de 50%.
- SUPERVISOR: solo pestañas operativas y sin etiquetas económicas restringidas.
- TERMINAL: acceso directo a reportes ADMIN bloqueado.

## Revisión arquitectónica

La primera revisión detectó que Clientes atribuía el pago completo de un ticket mixto a cada modalidad. Se corrigió reutilizando la distribución proporcional por subtotal, se añadió modalidad explícita a Métodos de pago y se sustituyeron rótulos XLSX que afirmaban desglose sin tenerlo.

La revisión posterior emitió **PASS**: sin doble conteo, sin regresiones relevantes, sin vulnerabilidades serias observadas y sin adelanto funcional de Parte 5.