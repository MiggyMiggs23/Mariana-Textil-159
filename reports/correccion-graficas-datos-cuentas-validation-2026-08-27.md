# Corrección de gráficas, datos y cuentas — validación

Fecha: 27 de agosto de 2026
Zona horaria funcional: America/Mexico_City

## Alcance verificado

1. Todas las gráficas de negocio usan la familia visual `--report-*`.
2. Los mapas Mes × SKU, Mes × color, Mes × tela y Mes × sitio son matrices reales: meses en columnas, dimensiones en filas y cantidad en las celdas. Calculan intensidad con el mínimo y máximo finitos, muestran cada valor y distinguen `N/D` de cero.
3. Las pruebas que mutan datos solo pueden abrir una base aislada después de validar URL e identidad real.
4. Los destinos de dinero conservan sus códigos internos, pero se muestran en este orden:
   - Efectivo
   - Cuentas No Fiscales
   - Cuentas Fiscales
   - Ventas a Crédito
5. UI, cortes, tooltips, leyendas, PDF y XLSX consumen las mismas etiquetas compartidas.

## Inventario y limpieza de development

Se inventariaron todos los candidatos conocidos antes de borrar:

- 2 ubicaciones `UbSAT…`: conservadas por tener usuarios, entradas, rollos, movimientos, existencias y otras referencias.
- 23 usuarios `Test SA…`: conservados por tener 499 auditorías, 110 entradas y 36 movimientos en conjunto.
- 20 productos `SATSA…`: conservados por tener 20 rollos, 45 movimientos y 20 existencias en conjunto.
- 0 clientes, proveedores o rollos identificados directamente por los patrones conocidos.
- Producto `PROBE-1787798321696`, ID 955: único residuo inequívoco y sin referencias.

Con autorización explícita se eliminó únicamente `PROBE-1787798321696` dentro de una transacción, después de comprobar `current_database() = heliumdb`, SKU exacto y cero referencias. La consulta posterior confirmó cero filas. No se borró ningún registro histórico o relacionado.

Las ubicaciones de prueba inactivas se excluyen de las tres consultas del comparativo de tiendas —resumen, periodo anterior y serie diaria— sin borrar su historial.

## Aislamiento de pruebas

- Los scripts mutantes exigen explícitamente `NODE_ENV=test`, `REQUIRE_ISOLATED_TEST_DATABASE=1` y `TEST_DATABASE_URL`.
- Se rechaza una URL igual a `DATABASE_URL`.
- Antes de crear el pool se consulta `current_database()` tanto en pruebas como en development y se rechaza una identidad igual.
- Las suites puramente unitarias que importan helpers de base sin consultarla reciben una conexión local inutilizable. Una consulta accidental falla y nunca llega a development.
- Las verificaciones con datos y las sesiones E2E se ejecutaron únicamente en bases vacías dentro de ramas Neon desechables. La repetición final usó `task48_heatmap_verify_pass_20260827`.

## Verificación automatizada

### Sin base

- Typecheck de librerías: aprobado.
- Typecheck frontend: aprobado.
- Contratos frontend: 38/38 aprobados.
- Contratos de analítica ADMIN: 15/15 aprobados.
- Unidades de reportes: 42/42 aprobadas, incluida la matriz con valores distintos, cero explícito y combinación ausente.
- Utilidad compartida de formato: 5/5 aprobadas.
- Rechazo sin `TEST_DATABASE_URL`: aprobado.
- Rechazo cuando `TEST_DATABASE_URL = DATABASE_URL`: aprobado.

### Rama Neon desechable

- Analítica ADMIN integration: 1/1 aprobada.
- Reportes integration: 4/4 aprobadas.
- POS integration: aprobada completa.
- Seguridad API: 44/45; conserva un fallo previo fuera de alcance en `S-26`, donde una celda Excel esperada como texto llega como objeto.

### Navegador real

La E2E autenticada usó exclusivamente la base aislada:

- `Reportes → Ventas`: la gráfica diaria contiene SVG, ejes, leyenda y serie visible.
- `Reportes → Mapas de Calor`: cuatro matrices con meses reales de septiembre de 2025 a agosto de 2026, filas reales de SKU/color/tela/sitio, valores finitos o `N/D`, leyenda menor/mayor e intensidades distintas para valores distintos.
- Vista móvil 390 × 844: la tabla del mapa conserva desplazamiento horizontal sin romper el ancho de página.
- `Caja → Cuentas`: tarjetas, tabla y leyenda usan las cuatro etiquetas y el orden requerido; no se muestran códigos internos.
- Sin errores de runtime ni solicitudes fallidas después de autenticar.

La primera pasada E2E detectó que `ResponsiveContainer` entregaba ancho y alto a un componente intermedio que no los reenviaba a Recharts. Se corrigió y la repetición confirmó el SVG visible. La misma verificación encontró códigos internos en una leyenda; se añadió la etiqueta compartida y la repetición quedó limpia.

La revisión de cierre detectó que la primera versión proporcional todavía consumía filas largas (`mes`, dimensión, métricas) como si fueran una matriz. Se añadió un pivote compartido que agrega duplicados, conserva cero y deja combinaciones ausentes como `null`; la integración y una nueva E2E confirmaron columnas mensuales y filas de dimensión reales, sin etiquetas “Fila N”.

## Limitaciones conocidas fuera de alcance

- El typecheck de API conserva un error previo en `pos.ts:278`: `CreditLedgerMovement[]` no satisface `TicketCreditMovement[]` porque `importe` admite `string | number`.
- La suite amplia de seguridad conserva el fallo previo `S-26` de formato Excel descrito arriba.

Ninguno de estos dos problemas fue introducido por esta corrección.