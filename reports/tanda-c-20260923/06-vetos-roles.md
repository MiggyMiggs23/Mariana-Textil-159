# T6 — Vetos de acción por rol: lectura actual y recomendación

## Alcance y criterio

Fuente de partida: las 69 referencias N3 de `reports/inventario-vetos-accion-por-rol.html`. Se contrastaron con las ubicaciones de código citadas por ese inventario. Cada `Rxxx` aparece **una sola vez** en los grupos y una sola vez en el apéndice. Las referencias `NEW-01` a `NEW-04` se describen aparte y **no** elevan el total.

Un veto de acción no es lo mismo que:

- alcance por sitio/origen/destino (N1);
- ocultamiento o redacción de datos sensibles (N2);
- ausencia de un permiso de módulo;
- una condición informativa sin rechazo de acción.

Ninguna alternativa se considera aprobada. En cada grupo se separa:

- **Compatible con E1:** conserva el veto, las excepciones y la autoridad actuales; puede mejorar operación o UX sin ampliar quién ejecuta la acción.
- **Cambio expreso de política:** sustituiría un literal de rol por un permiso de acción. Requiere decisión del propietario, definición de roles iniciales, autoridad equivalente en backend y revisión de auditoría. No se puede inferir a partir de un permiso de módulo.
- **No admisible:** invariantes de recuperación/ADMIN, datos sensibles o segundo factor que no deben convertirse en permisos ordinarios.

Una matriz por acción significa permisos concretos como “activar proveedor” o “cerrar auditoría”, no un permiso amplio de módulo. La UI sería secundaria: sólo reflejaría la decisión aplicada en la autoridad.

## Resumen en español simple

### 1. Acceso reservado y listas cerradas — 19

**IDs:** R001, R002, R003, R004, R005, R006, R007, R012, R013, R015, R016, R017, R019, R020, R045, R049, R073, R094, R096.

- **Hoy:** algunas rutas exigen ADMIN o una lista exacta de roles aunque el usuario tenga permiso del módulo. El literal mezcla acciones de riesgo muy distinto: purga, documentos, costos, auditorías, catálogos de transporte y consultas fiscales.
- **Alternativa A — mantener veto (compatible con E1):** conservar cada allowlist y el 403. **Negocio:** menos delegación y más dependencia de ADMIN, pero la responsabilidad es clara. **Seguridad:** menor superficie de escalamiento y ninguna autorización accidental por un permiso demasiado amplio.
- **Alternativa B — permiso por acción (cambio expreso de política):** crear permisos separados para acciones delegables, por ejemplo gestionar camionetas/choferes/pisos o consultar una vista concreta. No usar “administración” como permiso único. **Negocio:** permite delegar tareas rutinarias y cubrir ausencias. **Seguridad:** aumenta combinaciones y exige denegación por defecto, auditoría y revisión de conflictos; una consulta fiscal o de documentos no debe heredarse de otra acción.
- **Recomendación razonada:** mantener como vetos duros purga, documentos de cliente, aplicación de auditoría, costos pendientes y aprobaciones financieras. Llevar a decisión separada sólo catálogos operativos de transporte/pisos y consultas no sensibles. Las allowlists fiscales sólo cambiarían con política expresa; no se amplían por tener permiso de reportes. Los mensajes de UI ayudan, pero no sustituyen esta decisión.

### 2. Acciones destructivas o financieras con autorización adicional — 9

**IDs:** R022, R035, R043, R066, R072, R113, R115, R116, R120.

- **Hoy:** la acción requiere ADMIN, una credencial ADMIN activa o un flujo distinto de solicitud. Se agrupan cancelaciones, purga, baja/borrado, reimpresión, activación de proveedor y aplicación de pagos.
- **Alternativa A — mantener veto/segundo factor (compatible con E1):** conservar autorización por evento. **Negocio:** añade fricción y disponibilidad de un autorizador, pero separa captura y aprobación. **Seguridad:** limita fraude, borrado y reversos; deja evidencia de quién pidió y quién autorizó.
- **Alternativa B — permiso por acción (cambio expreso de política):** permitir que un rol tenga una acción muy concreta sin capturar credencial cada vez; nunca convertir “editar” en permiso para cancelar, purgar o borrar. **Negocio:** agiliza operación frecuente. **Seguridad:** transforma una autorización puntual en capacidad persistente, por lo que exige bitácora, revocación inmediata, límites de estado/sitio y, para importes, segregación de funciones.
- **Recomendación razonada:** conservar segundo factor para purga, cancelaciones, bajas, borrados y reimpresión excepcional. Mantener el flujo solicitud/aprobación para pagos dirigidos. “Activar/desactivar proveedor” podría evaluarse como permiso independiente sólo mediante cambio expreso de política y sin acceso implícito a información financiera. La mejora de formularios es secundaria.

### 3. Invariantes de ADMIN y recuperación — 9

**IDs:** R023, R024, R026, R027, R030, R031, R032, R034, R127.

- **Hoy:** se protege la cuenta/rol ADMIN, el último ADMIN recuperable, los overrides ADMIN, el auto-cambio de rol y la capacidad de SISTEMAS de concederse permisos.
- **Alternativa A — mantener invariante (compatible con E1):** conservar controles duros, incluidos los casos donde el actor también es ADMIN. **Negocio:** algunas recuperaciones requieren otro administrador o procedimiento controlado. **Seguridad:** evita toma de control, autoelevación y pérdida de la última vía de recuperación.
- **Alternativa B — convertir a matriz:** **no admisible.** Una casilla editable por la misma matriz no puede proteger con fiabilidad la integridad de esa matriz ni al último ADMIN.
- **Recomendación razonada:** no abrir ninguna de estas referencias. Sólo es admisible mejorar el procedimiento de recuperación y la explicación al operador, sin exponer credenciales ni crear bypass.

### 4. Vetos operativos por rol — 12

**IDs:** R008, R009, R011, R047, R050, R051, R060, R062, R065, R078, R079, R129.

- **Hoy:** SUPERVISOR no puede ciertas bajas/reactivaciones o términos financieros; BODEGA/SUPERVISOR no fijan costo; CAJA no muta salidas; color, reversión y ciertas resoluciones son ADMIN.
- **Alternativa A — mantener veto (compatible con E1):** conservar separación literal por rol. **Negocio:** obliga a escalar excepciones, pero mantiene funciones simples en piso/caja. **Seguridad:** impide que captura de entrada autorice costo, que cobro habilite movimientos de salida o que edición general alcance datos financieros.
- **Alternativa B — permiso por acción (cambio expreso de política):** separar baja, reactivación, términos de crédito, fijación de costo, reversión, mutación de salida, edición de color y resolución fiscal. **Negocio:** permite delegación fina. **Seguridad:** cada permiso necesita precondiciones propias; otorgar “entradas” a BODEGA **no** puede implicar autorización financiera, y otorgar “salidas” a CAJA no puede implicar mutación sin decisión explícita.
- **Recomendación razonada:** mantener duros el veto CAJA sobre mutaciones, la venta directa fuera de POS, la reversión extraordinaria y la exclusión financiera de BODEGA/SUPERVISOR. Mantener color y resolución fiscal reservados mientras sean datos/decisiones administrativas. Baja o reactivación de cliente podría presentarse como decisión independiente con doble control, pero es cambio de política, no corrección de permisos. La alineación de botones es sólo consecuencia.

### 5. Guardas generales de interfaz y navegación — 8

**IDs:** R093, R095, R097, R102, R106, R108, R109, R130.

- **Hoy:** rutas, pestañas, filtros o controles no se muestran a roles excluidos. Algunas reflejan un veto backend; otras son la única restricción visible de esa superficie.
- **Alternativa A — mantener guardas (compatible con E1):** conservar allowlists UI y su autoridad backend. **Negocio:** navegación más simple, pero ADMIN concentra consultas y tareas. **Seguridad:** reduce exposición accidental; el ocultamiento solo no protege llamadas directas.
- **Alternativa B — permiso por acción (cambio expreso de política):** hacer que ruta, consulta y acción dependan del mismo permiso granular y de los mismos límites de sitio/datos. **Negocio:** habilita reportes, historial o filtros a responsables concretos. **Seguridad:** si sólo se cambia la UI se abre una apariencia sin autoridad; si sólo se cambia API se pueden exponer datos sin navegación ni explicación. Deben cambiar juntas.
- **Recomendación razonada:** conservar `adminOnly` para alertas, costos y controles extraordinarios. Evaluar por separado pestañas de reporte o historial únicamente si su respuesta mantiene redacción N2 y scope N1. No usar un permiso general de REPORTES para todas las pestañas. Los mensajes/ocultamiento son secundarios al guard de servidor.

### 6. Acciones administrativas de interfaz — 11

**IDs:** R117, R118, R119, R121, R122, R123, R124, R125, R126, R128, R112.

- **Hoy:** la UI reserva acciones administrativas, reimpresión, cierres, ajustes y cancelación. La referencia de cancelación del detalle ya no vive inline en `salida-detail.tsx`; fue movida a helper y diálogo compartidos.
- **Alternativa A — mantener reservas UI y API (compatible con E1):** conservar rol, segundo factor e invariantes actuales. **Negocio:** más escalamiento a ADMIN; menor riesgo de que una acción irreversible se vuelva rutinaria. **Seguridad:** la API sigue siendo autoridad y la UI compartida evita caminos inconsistentes.
- **Alternativa B — permiso por acción coordinado (cambio expreso de política):** definir permisos distintos para activar proveedor, administrar producto, cerrar auditoría, ajustar, administrar contenedor o gestionar transporte. No agruparlos como “acciones administrativas”. **Negocio:** delegación precisa por área. **Seguridad:** exige endpoint autorizado por la misma acción, bitácora y límites de sitio/estado; cambiar sólo el botón no concede ni protege nada.
- **Recomendación razonada:** no convertir a matriz selección/override de ADMIN, cancelación con credencial, reimpresión excepcional ni reversión de rollo. Cierre de auditoría y ajustes deben seguir ADMIN salvo política formal con segregación. Gestión de transporte/contenedores y activación de catálogos son candidatos a decisiones independientes, nunca a una apertura conjunta. Conservar la referencia movida en el helper actual; UX consistente es secundaria.

### 7. Filtros y visibilidad administrativa — 1

**ID:** R055.

- **Hoy:** sólo ADMIN puede incluir ubicaciones inactivas en kardex, filtros y exportación.
- **Alternativa A — mantener veto (compatible con E1):** ADMIN conserva la vista histórica completa. **Negocio:** investigaciones dependen de ADMIN. **Seguridad:** evita confundir ubicaciones retiradas con inventario operable y reduce exposición histórica fuera del scope normal.
- **Alternativa B — permiso de lectura histórica (cambio expreso de política):** permitir únicamente consultar/exportar inactivas, sin reactivar ni mutar, manteniendo scope y redacción. **Negocio:** auditoría y soporte pueden investigar sin intervención de ADMIN. **Seguridad:** amplía visibilidad histórica; requiere auditoría de exportación y garantía de que el permiso no habilite operaciones.
- **Recomendación razonada:** mantener el veto por defecto. Si existe necesidad operativa demostrada, decidir un permiso de sólo lectura separado; no derivarlo de “movimientos.ver” ni de permisos de ubicación, y no mezclarlo con datos sensibles.

**Control de cobertura:** 19 + 9 + 9 + 12 + 8 + 11 + 1 = **69 IDs únicos**.

## Reglas que no deben abrirse

1. **Datos sensibles:** N2 no se convierte en permiso de acción. Costos, márgenes y datos fiscales conservan su redacción/ocultamiento.
2. **Excepciones E1 y ADMIN:** una excepción explícita no se generaliza a otro rol por semejanza.
3. **Invariantes ADMIN:** R023/R026/R027/R030/R031/R032/R034/R127 no se vuelven casillas ordinarias de matriz.
4. **Credenciales:** R022/R035/R066/R072/R112/R113/R115/R116/R120/R123 conservan autorización separada cuando aplica.
5. **CAJA y salidas:** R060/R062/R065/R066 siguen bloqueando la mutación correspondiente; estar en sitio propio no elimina el veto.
6. **Backend primero:** una acción oculta en UI no reemplaza el rechazo server-side.

## R112 y referencias nuevas

R112 está **movido, no eliminado**. La guardia inline histórica de `pages/salida-detail.tsx` ya no es la evidencia actual. Hoy la elegibilidad está en:

- `artifacts/mariana-textil/src/lib/salida-cancelacion.ts:19-68`;
- `artifacts/mariana-textil/src/components/salida-cancel-dialog.tsx:126-163,204-210`.

`NEW-01` identifica ese helper compartido; `NEW-02` la exclusión de CAJA del historial; `NEW-03` la revalidación del diálogo; `NEW-04` el no renderizado del botón en la tabla. Son ubicaciones actuales de refuerzo/refactorización y **no son cuatro vetos históricos adicionales**.

## Apéndice — matriz canónica de las 69 referencias

“Activo” significa que el control citado existe hoy en el código. “Movido” significa que la semántica continúa, pero cambió su ubicación.

| ID | Rol o condición afectada | Acción vetada | Evidencia actual | Estado actual |
|---|---|---|---|---|
| R001 | Fuera de la allowlist de la invocación | Ejecutar ruta protegida por `requireRole` | `artifacts/api-server/src/middlewares/auth.ts:119-126` | Activo: 403 si el rol no está incluido |
| R002 | Todo no ADMIN | Ejecutar operación `requiereAdmin` | `artifacts/api-server/src/lib/permisos.ts:297-312` | Activo: 403 literal |
| R003 | Todo no ADMIN | Consultar u operar alertas administrativas | `artifacts/api-server/src/routes/admin-alertas.ts:11` | Activo: `requireRole("ADMIN")` |
| R004 | Rol fuera de la lista de cada endpoint | Usar analytics, cortes, diferencias o exportaciones | `artifacts/api-server/src/routes/admin-analytics.ts:71-83` | Activo: allowlists por ruta |
| R005 | Rol fuera de la lista fiscal concreta | Confirmar, capturar o resolver operación fiscal | `artifacts/api-server/src/routes/admin-analytics.ts:331,360-362` | Activo: listas ADMIN/CONTADOR/SISTEMAS más estrechas |
| R006 | Todo no ADMIN | Ver, cargar o descargar documentos de cliente | `artifacts/api-server/src/routes/cliente-documentos.ts:40-44,64-69,155-156` | Activo: guard ADMIN |
| R007 | Todo no ADMIN | Consultar clientes incobrables | `artifacts/api-server/src/routes/clientes-admin.ts:22-25` | Activo: `requireRole("ADMIN")` |
| R008 | SUPERVISOR | Dar de baja cliente | `artifacts/api-server/src/routes/clientes-admin.ts:63-67` | Activo: rechazo literal |
| R009 | SUPERVISOR | Reactivar cliente | `artifacts/api-server/src/routes/clientes-admin.ts:217-221` | Activo: rechazo literal |
| R011 | SUPERVISOR | Capturar días o límite de crédito al crear cliente | `artifacts/api-server/src/routes/clientes.ts:298-317` | Activo: campos rechazados/neutralizados |
| R012 | SUPERVISOR, BODEGA, CAJA, TERMINAL, CONTADOR | Crear o editar camionetas | `artifacts/api-server/src/routes/camionetas.ts:36-47` | Activo: sólo ADMIN/SISTEMAS |
| R013 | SUPERVISOR, BODEGA, CAJA, TERMINAL, CONTADOR | Crear o editar choferes | `artifacts/api-server/src/routes/choferes.ts:38-53` | Activo: sólo ADMIN/SISTEMAS |
| R015 | Todo no ADMIN | Crear o editar pisos | `artifacts/api-server/src/routes/locations.ts:180-224` | Activo: 403 |
| R016 | CAJA y TERMINAL; BODEGA fuera de sitio | Entrar a auditorías fuera de allowlist/scope | `artifacts/api-server/src/routes/auditorias-inventario.ts:40-71,88-134` | Activo: rol más sitio |
| R017 | Todo no ADMIN | Confirmar o aplicar auditoría | `artifacts/api-server/src/routes/auditorias-inventario.ts:276-289` | Activo: ADMIN |
| R019 | Todo no ADMIN | Preflight o borrado de inactivos | `artifacts/api-server/src/routes/purga.ts:19-21` | Activo: ADMIN |
| R020 | Todo no ADMIN | Aprobar o rechazar pago dirigido | `artifacts/api-server/src/routes/pagos-dirigidos.ts:269,304` | Activo: ADMIN |
| R022 | No ADMIN; reimpresión de BODEGA/SUPERVISOR sin credencial | Historial/exportación/alertas o reimpresión sin autorización | `artifacts/api-server/src/routes/etiquetas.ts:48-56,202-217,238-245,313,342,372` | Activo: ADMIN/segundo factor |
| R023 | Cualquier actor sobre objetivo ADMIN | Modificar o vaciar permisos de ADMIN | `artifacts/api-server/src/routes/permisos.ts:74-109` | Activo: invariante |
| R024 | SISTEMAS | Autoconcederse permisos no poseídos | `artifacts/api-server/src/routes/permisos.ts:128-155` | Activo: invariante |
| R026 | Cualquier actor si rompe recuperación | Dejar el sistema sin ADMIN activo completo | `artifacts/api-server/src/routes/permisos.ts:187-249` | Activo: último ADMIN recuperable |
| R027 | Cualquier actor sobre usuario ADMIN | Consultar, cambiar o borrar override ADMIN | `artifacts/api-server/src/routes/permisos.ts:285-289,352-362,390-426,518-568` | Activo: objetivo bloqueado |
| R030 | Todo no ADMIN | Crear cuenta ADMIN | `artifacts/api-server/src/routes/users.ts:119-151` | Activo: actor ADMIN requerido |
| R031 | Todo no ADMIN | Modificar cuenta ADMIN o promover a ADMIN | `artifacts/api-server/src/routes/users.ts:227-257` | Activo: actor ADMIN requerido |
| R032 | Cualquier actor | Cambiar su propio rol | `artifacts/api-server/src/routes/users.ts:260-275` | Activo: invariante anti-auto-cambio |
| R034 | Cualquier actor si rompe recuperación | Desactivar/degradar/eliminar último ADMIN recuperable | `artifacts/api-server/src/routes/users.ts:324-375` | Activo: invariante |
| R035 | No ADMIN sin credencial válida | Purgar catálogos | `artifacts/api-server/src/lib/purga-catalogos.ts:397-441` | Activo: segundo factor ADMIN |
| R043 | Todo no ADMIN | Activar o desactivar proveedor | `artifacts/api-server/src/routes/proveedores.ts:385-390` | Activo: 403 |
| R045 | Todo no ADMIN | Listar, crear o editar salida extraordinaria | `artifacts/api-server/src/routes/inventario.ts:395-399,498-502,537-541` | Activo: `requiereAdmin` |
| R047 | BODEGA y SUPERVISOR | Enviar costo unitario positivo en entrada | `artifacts/api-server/src/routes/inventario.ts:667-684,773-786` | Activo: costo pendiente/null |
| R049 | Todo no ADMIN | Contar, listar o capturar costos pendientes | `artifacts/api-server/src/routes/inventario.ts:999-1031,1087-1096` | Activo: 403 |
| R050 | Todo no ADMIN en flujo directo | Vender rollo fuera del ticket POS | `artifacts/api-server/src/routes/inventario.ts:1240-1255` | Activo: exige flujo permitido |
| R051 | Todo no ADMIN | Revertir salida extraordinaria | `artifacts/api-server/src/routes/inventario.ts:1364-1400` | Activo: ADMIN |
| R055 | Todo no ADMIN | Incluir ubicaciones inactivas | `artifacts/api-server/src/routes/inventario.ts:1914-2004` | Activo: 403 |
| R060 | CAJA | Mutar salida propia | `artifacts/api-server/src/routes/salidas.ts:321-337` | Activo: `rejectCajaMutation` |
| R062 | CAJA | Armar borrador o crear salida a mostrador | `artifacts/api-server/src/routes/salidas.ts:505-521,535-557` | Activo: rechazo antes del scope |
| R065 | CAJA | Quitar rollos o enviar salida | `artifacts/api-server/src/routes/salidas.ts:783-817` | Activo: `rejectCajaMutation` |
| R066 | CAJA; demás no ADMIN sin credencial | Cancelar salida | `artifacts/api-server/src/routes/salidas.ts:866-893` | Activo: veto CAJA y segundo factor |
| R072 | Todo no ADMIN sin credencial | Cancelar ticket POS | `artifacts/api-server/src/routes/pos.ts:671-708` | Activo: credenciales ADMIN |
| R073 | Todo no ADMIN | Consultar historial de sesiones de caja | `artifacts/api-server/src/routes/pos.ts:893-910` | Activo: 403 |
| R078 | Todo no ADMIN | Capturar o editar `colorHex` | `artifacts/api-server/src/routes/productos.ts:342-370,764-785` | Activo: helper ADMIN |
| R079 | Todo no ADMIN | Superar helper de edición de color | `artifacts/api-server/src/lib/product-color.ts:1-5` | Activo: devuelve true sólo para ADMIN |
| R093 | Rol fuera de allowlist aunque tenga módulo | Renderizar ruta protegida | `artifacts/mariana-textil/src/App.tsx:100-126,148-188` | Activo: rol más permiso |
| R094 | SUPERVISOR, BODEGA, CAJA, TERMINAL | Entrar a cuentas destino | `artifacts/mariana-textil/src/App.tsx:518-537` | Activo: ADMIN/CONTADOR/SISTEMAS |
| R095 | Todo no ADMIN | Renderizar Alertas/Notificaciones adminOnly | `artifacts/mariana-textil/src/App.tsx:549-559` | Activo: pantalla Sin acceso |
| R096 | SUPERVISOR, BODEGA, CAJA, TERMINAL | Renderizar ruta de ticket reservada | `artifacts/mariana-textil/src/App.tsx:580-587` | Activo: ADMIN/CONTADOR/SISTEMAS |
| R097 | Rol fuera de `allowedRoles`/`hiddenForRoles` | Llegar por navegación a opciones reservadas | `artifacts/mariana-textil/src/components/layout/app-navigation.ts:35-43,83-87,111-136` | Activo: ocultamiento UI |
| R102 | Todo no ADMIN | Abrir pendientes de costo | `artifacts/mariana-textil/src/pages/entradas-pendientes-costo.tsx:316-322` | Activo: consulta deshabilitada y acceso denegado |
| R106 | Todo no ADMIN | Activar filtro de ubicaciones inactivas | `artifacts/mariana-textil/src/pages/movimientos.tsx:149-161,432` | Activo: control reservado |
| R108 | Todo no ADMIN según pestaña | Abrir reportes reservados | `artifacts/mariana-textil/src/pages/reportes.tsx:49-76` | Activo: pestañas filtradas |
| R109 | CAJA para mutación; no ADMIN para extraordinarias | Usar controles de salidas reservados | `artifacts/mariana-textil/src/pages/salidas.tsx:65-121,183-219,250-355` | Activo: ocultamiento UI |
| R112 | CAJA; no ADMIN no autorizado/fuera de origen | Cancelar desde detalle de salida | `artifacts/mariana-textil/src/lib/salida-cancelacion.ts:19-68; artifacts/mariana-textil/src/components/salida-cancel-dialog.tsx:126-163,204-210` | **Movido:** helper/diálogo reemplazan guardia inline |
| R113 | Todo no ADMIN sin credencial | Cancelar ticket desde detalle | `artifacts/mariana-textil/src/pages/ticket-detail.tsx:119-197,420-559,1000-1013` | Activo: autorización ADMIN |
| R115 | Todo no ADMIN para aplicación directa | Aplicar pago dirigido en vez de solicitar | `artifacts/mariana-textil/src/components/solicitud-pago-dirigido-dialog.tsx:310; artifacts/mariana-textil/src/pages/pagos-dirigidos.tsx:45,176` | Activo: acción alternativa |
| R116 | SUPERVISOR/API; no ADMIN/UI sin credencial | Dar de baja cliente | `artifacts/mariana-textil/src/pages/cliente-detail.tsx:103-110,326,434-435` | Activo: rol/credencial |
| R117 | Todo no ADMIN | Abrir incobrables/acciones ADMIN de cliente | `artifacts/mariana-textil/src/pages/clientes.tsx:51-53,111,143,160,230` | Activo: UI ADMIN |
| R118 | Todo no ADMIN | Activar o desactivar proveedor en UI | `artifacts/mariana-textil/src/pages/proveedores.tsx:85-86,234,300; artifacts/mariana-textil/src/pages/proveedor-detail.tsx:138-142` | Activo: UI ADMIN |
| R119 | Todo no ADMIN | Usar acciones administrativas de producto | `artifacts/mariana-textil/src/pages/productos.tsx:210-212,415,458` | Activo: controles reservados |
| R120 | Todo no ADMIN; sin credencial al borrar | Capturar color o borrar producto | `artifacts/mariana-textil/src/pages/producto-detail.tsx:173-202,370-466,537-611` | Activo: ADMIN/segundo factor |
| R121 | Todo no ADMIN | Revertir o ver historial administrativo de rollo | `artifacts/mariana-textil/src/pages/rollo-detail.tsx:32-35,210-220,252-266,299-350` | Activo: UI ADMIN |
| R122 | Todo no ADMIN | Crear, editar o cancelar contenedor | `artifacts/mariana-textil/src/pages/contenedores/index.tsx:40-41,144-331,575-598,719-828; artifacts/mariana-textil/src/pages/contenedores/detail.tsx:178-180,531-662` | Activo: UI ADMIN |
| R123 | No ADMIN para administración; BODEGA/SUPERVISOR sin credencial para reimpresión | Administrar/reimprimir etiquetas | `artifacts/mariana-textil/src/pages/etiquetas.tsx:58,97,172,239-316` | Activo: ADMIN/segundo factor |
| R124 | Todo no ADMIN | Ver botón o cerrar auditoría | `artifacts/mariana-textil/src/pages/auditorias-inventario.tsx:317,543` | Activo: UI ADMIN |
| R125 | Todo no ADMIN | Usar controles de ajustes | `artifacts/mariana-textil/src/pages/ajustes.tsx:43,126,231,425` | Activo: UI ADMIN |
| R126 | SUPERVISOR, BODEGA, CAJA, TERMINAL | Gestionar camionetas o choferes en UI | `artifacts/mariana-textil/src/pages/configuracion/camionetas.tsx:59,197,251; artifacts/mariana-textil/src/pages/configuracion/choferes.tsx:67,221,265` | Activo: lista UI |
| R127 | Objetivo ADMIN; opciones globales restringidas | Modificar/promover ADMIN o asignar opciones globales | `artifacts/mariana-textil/src/pages/usuarios.tsx:46,270-276,363-394` | Activo: invariante UI |
| R128 | Objetivo ADMIN | Seleccionar o cambiar overrides ADMIN | `artifacts/mariana-textil/src/pages/permisos.tsx:164-168,255` | Activo: ADMIN omitido/bloqueado |
| R129 | SUPERVISOR, BODEGA, CAJA, TERMINAL | Resolver diferencia fiscal o usar controles ADMIN | `artifacts/mariana-textil/src/pages/caja/cuenta-destino-detalle.tsx:407-414` | Activo: CONTADOR/ADMIN |
| R130 | Todo no ADMIN | Abrir historial de cortes | `artifacts/mariana-textil/src/pages/cobros.tsx:1780-1806` | Activo: UI ADMIN |

## Recomendación final

No aprobar una apertura en bloque. La decisión propuesta tiene tres carriles:

1. **Conservar sin opción de matriz:** invariantes ADMIN/recuperación, segundo factor para acciones destructivas, exclusión financiera de roles operativos, mutaciones de CAJA, purga, reversos y venta fuera de POS.
2. **Llevar a decisiones de política independientes:** catálogos de transporte/pisos/contenedores, activación de catálogos, ciertas consultas/reportes no sensibles y lectura histórica de ubicaciones inactivas. Cada una necesitaría permiso de acción propio, roles iniciales explícitos, backend denegado por defecto, scope/redacción intactos y auditoría.
3. **No confundir con decisión de autoridad:** mensajes, botones y navegación sólo reflejan el resultado; no son alternativa al control del servidor.

Así se preserva E1 sin cerrar la discusión sobre delegación legítima. Mantener R112 como la misma referencia histórica con evidencia actual en los helpers compartidos y mantener `NEW-*` fuera del conteo 69.