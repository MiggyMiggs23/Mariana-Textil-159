# Clientes y Proveedores: saldo a favor y utilidad

Fecha: 2026-09-14.

## Estado

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

## Pendiente de autorización

Corregir los bloqueos dentro de este trabajo, definir y registrar trazabilidad para futuras ventas parciales sin inventar datos históricos, y ejecutar pruebas del cálculo real con múltiples proveedores, cantidades fraccionarias, costos faltantes y permisos.