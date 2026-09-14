# Clientes y Proveedores: saldo a favor y utilidad

Fecha: 2026-09-14.

## Estado final tras la autorización

Correcciones implementadas y activadas el 2026-09-14. La API y la interfaz arrancaron correctamente. No se cambiaron credenciales ni se crearon usuarios o movimientos de prueba.

### Comportamiento entregado

- Fichas de Clientes y Proveedores: deuda roja no negativa; saldo a favor verde en sección independiente, visible solo cuando es positivo.
- Utilidad por proveedor inicialmente oculta, con permiso financiero y bloqueo incondicional de SUPERVISOR en el servidor, incluso si tiene un permiso personalizado.
- Atribución al proveedor de la entrada. Desglose paginado con series, cantidades, ventas, costo, utilidad y enlaces a nota/ticket y entrada.
- Las nuevas ventas parciales por metro requieren fuentes físicas explícitas. La suma de cantidades debe coincidir exactamente con la venta; editar cantidades invalida la asignación anterior. Las ventas parciales de bolsas conservan FIFO.
- Consumo de inventario y evidencia financiera se guardan atómicamente, bajo bloqueos. Ingreso y costo se distribuyen conservando centavos; el costo ausente, cero o inválido no se inventa.
- La cancelación del documento restaura inventario y añade una reversa trazable. No se permite revertir por separado un movimiento de venta perteneciente al documento.
- Históricos NORMAL con evidencia física inequívoca conservan su atribución mediante lectura, sin backfill. Se rechazan movimientos ya revertidos. Los rollos identificables sin costo se cuentan como excluidos.
- Las líneas históricas sin evidencia se muestran como un conteo **global del sitio y periodo**, no como si pertenecieran a un proveedor determinado.

### Migración aplicada

`lib/db/migrations/20260914_supplier_trace.sql`: tabla aditiva `ticket_linea_consumos`, índices, validación de identidades y reversas, y trigger append-only `ENABLE ALWAYS`. Aplicación transaccional; la tabla comenzó con cero registros. No se rellenaron ventas históricas ni se ejecutó una purga.

### Verificación final

| Comprobación | Resultado |
|---|---|
| Contratos de utilidad del servidor | 12/12 aprobados |
| Contratos de trazabilidad y validación de fuentes | 5/5 aprobados |
| Contratos específicos de interfaz, permisos, saldo y fuentes | 16/16 aprobados |
| SQL real con CTEs VALUES en transacción READ ONLY | Aprobado: proveedores cruzados, centavos, costos faltantes/cero, reversas, históricos y filtros |
| Build de API y reinicio de ambos servicios | Aprobado; persiste advertencia previa de clave duplicada en Clientes |
| Migración e inspección de tabla/trigger | Aprobado: tabla inicialmente vacía, ocho índices y trigger en modo ALWAYS |
| Lectura real posterior sobre tres proveedores | Aprobada; dos resultados vacíos y uno con nueve líneas, ventas 15,750.00, costo 12,950.00 y utilidad 2,800.00 |
| Servicio de login | Responde a validación de solicitud vacía; no se intentó autenticar |
| Typecheck global | Persisten errores anteriores fuera de este alcance |

### Alcance de la prueba de navegador

Con respuestas de API simuladas se verificaron la separación del saldo del proveedor, privacidad inicial de utilidad, revelado, desglose, enlaces, bloqueo de SUPERVISOR, fuentes obligatorias en POS, reinicio de fuentes al editar cantidad, eliminación y payload exacto con dos rollos de 0.50 metros cada uno. El POST fue interceptado y bloqueado deliberadamente; no se acredita una venta real persistida.

La prueba detectó un problema de ancho del renglón de POS en teléfono. Se corrigió con una cuadrícula responsiva y se comprobó el contrato de estilos. La confirmación visual limitada posterior quedó bloqueada por el estado SUPERVISOR conservado en el navegador; **no se da por aprobada una nueva comprobación visual de ese renglón**. La pantalla de acceso sí fue capturada correctamente a 390×844 tras el reinicio.

No se hicieron operaciones financieras reales de prueba ni se probaron triggers insertando datos en la base del usuario.

### Fuera de alcance

La herramienta histórica `scripts/src/purge-operational-phase2.mts` conserva su manifiesto autorizado anterior y se detiene ante la nueva tabla/trigger. No se amplió silenciosamente su alcance de borrado. Su adaptación requiere un trabajo separado y no se ejecutó.

Los problemas anteriores del saldo a favor de Clientes/Cobrado y los errores globales de tipos no forman parte de estas correcciones.

## Historial: estado de la primera implementación

Implementación parcial; utilidad por proveedor **no aprobada**. Se detuvieron las correcciones tras los fallos de revisión, conforme a la instrucción del usuario.

## Decisiones e investigación

- El usuario eligió atribuir utilidad al **proveedor de la entrada**, incluso si difiere del proveedor del rollo. No se modificaron referencias históricas.
- La consulta de solo lectura encontró 76 rollos vinculados a entradas: 76 coincidencias y ninguna diferencia de proveedor.
- Proveedores ya conserva remanentes de pagos no aplicados a compras. No se creó un concepto nuevo de anticipo ni se modificó el algoritmo financiero.
- Rojo significa deuda y verde saldo a favor. La deuda presentada nunca es negativa. En las fichas, el saldo a favor tiene su propia sección y solo aparece cuando es positivo.

## Implementado

- Separación de deuda y saldo a favor en las fichas de Clientes y Proveedores.
- Utilidad de proveedor inicialmente oculta tras el ojito, con desglose paginado hasta rollos, cantidades y documentos.
- Contador explícito de rollos distintos vendidos excluidos por falta de costo.
- Criterio canónico de documentos procesados por Caja.
- Contrato API y cliente generado.

Estas piezas implementadas no acreditan por sí mismas la corrección financiera ni el control de acceso.

## Verificaciones

- Codegen y comprobación de bibliotecas: aprobados.
- Build del servidor: aprobado, con una advertencia anterior de clave duplicada en Clientes.
- Pruebas puras/contratos del servidor: 8 aprobadas.
- Primera selección de contratos de interfaz: 5 aprobadas.
- Contrato final de interfaz de utilidad: 2 aprobadas tras sincronizar el contador de rollos distintos.
- Consulta real de la función de utilidad en modo de solo lectura sobre un proveedor existente: ejecutada correctamente; resultado vacío, utilidad 0.00 y cero exclusiones. **No valida escenarios con ventas parciales ni múltiples proveedores.**
- Typecheck global de servidor e interfaz: continúa fallando por problemas anteriores en POS, Clientes y Alertas; no corregidos en esta tanda.
- Captura de la app tras reiniciar únicamente la interfaz: pantalla de acceso visible. No se hizo login ni una prueba autenticada de las fichas.
- No se crearon usuarios, sesiones, registros de prueba ni migraciones. No se cambiaron credenciales.

El primer intento de consulta desde consola falló por ejecutar módulos ESM como CommonJS; se corrigió únicamente la invocación y se ejecutó la lectura con Node en modo ESM, sin editar código de negocio.

## Bloqueos encontrados

1. **Consumo parcial mal atribuido:** la consulta filtra por proveedor antes de calcular los intervalos consumidos. En ventas con varios proveedores puede asignar cantidades al renglón/precio incorrecto. También admite movimientos de ventas normales como evidencia de ventas parciales.
2. **Trazabilidad faltante:** las ventas metreada(s) de tela pueden carecer de evidencia persistida de los rollos consumidos. No se puede reconstruir con certeza la utilidad por proveedor para esos casos. Deben excluirse explícitamente; completar la cobertura futura requiere registrar el consumo físico.
3. **Redondeo y costo histórico:** el reparto por fragmentos necesita conservación exacta de centavos y costo de venta histórico. Leer el costo actual del rollo puede cambiar una utilidad histórica.
4. **Permiso insuficiente en servidor:** el endpoint nuevo exige permiso financiero configurable, pero no bloquea incondicionalmente a SUPERVISOR. Un permiso personalizado puede permitirle consultar datos que la interfaz oculta.

El API nuevo no se activó mediante reinicio del servidor. El código permanece en el workspace pendiente de corrección: no debe considerarse listo para publicar ni seguro para activar. La interfaz puede mostrar un error al intentar consultar esa función contra la API anterior.

## Solicitud original de autorización, posteriormente aceptada

Corregir los bloqueos dentro de este trabajo, definir y registrar trazabilidad para futuras ventas parciales sin inventar datos históricos, y ejecutar pruebas del cálculo real con múltiples proveedores, cantidades fraccionarias, costos faltantes y permisos.