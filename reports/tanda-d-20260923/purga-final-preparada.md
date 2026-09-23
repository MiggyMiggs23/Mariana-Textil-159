# Purga final de pruebas — plan preparado, NO ejecutable

Fecha documental: 2026-09-23. Estado: **PREPARADO PARA DECISIÓN DEL PROPIETARIO / NO-GO de ejecución**.

## 1. Alcance y autoridad

La tarea 4 de `autorizacion.txt` autoriza dejar lista la purga **sin ejecutarla**. Esta entrega contiene únicamente documentos; no crea operador, SQL ejecutable, credenciales, tokens de habilitación ni comandos de aplicación. No se ejecutaron consultas, ensayos, respaldos, aplicaciones, reinicios ni commits. No se verificó el catálogo vivo.

Regla de término: cuando **el propietario decida comenzar a operar con datos reales**, termina la liberación simple temporal y se restablece íntegramente el procedimiento completo: inventario y revisión, respaldo fresco íntegro, restauración comprobada, copia remota privada verificada, ensayo autorizado, preflight fresco, autorización de ejecución, transacción controlada, comprobación independiente y reanudación autorizada. La regla simple no exime de estos pasos para la purga final ni autoriza purgar ahora.

Referencia base: `reports/tanda-c-20260923/10-procedimiento-purga.md`. Este plan actualiza su inventario: **E3 y Tanda B ya constan instaladas técnicamente** en `reports/liberacion-simple-20260923/continuacion-resultado.md`, secciones Resultado y Cronología. El informe inicial `resultado.md` quedó superado en ese punto. Una puerta OFF no elimina las tablas ni sus protecciones. Las aperturas de Tanda D deberán incorporarse al snapshot final; no se infiere el estado servido actual de este documento.

## 2. Matriz propuesta para la autorización

Clases: **A?** candidata de pruebas, pendiente de autorización individual y mecanismo compatible; **C** preservar íntegra; **B?** derivada/contador con objetivo pendiente. Ninguna A? habilita borrado hoy. Una tabla desconocida, mixta real/prueba o sin clasificación bloquea toda ejecución. No se usa un criterio por fecha, ID bajo, flag OFF o nombre de tabla para declarar datos de prueba.

| Familia y tablas explícitas | Clase / tratamiento propuesto | Bloqueo o comprobación necesaria |
|---|---|---|
| `productos`, `precio_historial` | C | Conservar catálogo, costos y precios; la evidencia histórica de remate permanece en auditoría. Las marcas activas por rollo se clasifican por separado; no confundir con el borrado individual autorizado de producto sin movimientos. |
| `tarea4_rollo_remate` | A? dependiente de rollos de prueba | Tabla creada al liberar Tanda D. Borrar únicamente las marcas cuyos rollos queden expresamente autorizados para purga, antes de esos rollos; conservar marcas de rollos conservados. No borrar usuarios referenciados ni eventos de alta/retiro en `auditoria`. La matriz `marcar_remate` y sus personalizaciones son configuración C. |
| `clientes`, `cliente_documentos`, `proveedores` | C | Conservar propietarios y documentos; no borrar histórico financiero por la puerta de purga de catálogos. |
| `usuarios`, `permisos_rol`, `permisos_usuario`, `permisos_ubicacion` | C | Valores completos, autores y timestamps, incluidos permisos E3/Tanda B/Tanda D; no recrear ADMIN, seed ni normalizar matriz. |
| `ubicaciones`, `pisos`, `camionetas`, `choferes`, `equipos`, `equipos_checklist`, `stock_minimo_sitios`, `stock_minimos` | C | Mismas claves y valores, configuración e inactivos incluidos. |
| `auditoria` | C permanente | Nunca borrar, editar, truncar, desactivar ni debilitar sus protecciones. Preservar reserva de SKU y evidencia de acciones históricas. |
| `aplicaciones_credito`, `aplicaciones_pago_proveedor`, `movimientos_credito`, `pagos_proveedor`, `ticket_pagos` | A? financiera protegida | Excepción futura explícita de pruebas; hoy append-only bloquea. Incluye decisión expresa sobre los históricos #51–53 sin cambiarles sitio. |
| `tickets`, `ticket_lineas`, `autorizaciones_nota`, `ticket_linea_consumos` | A? | Trazabilidad física, reversos y evidencia de crédito requieren cierre completo de dependencias. |
| `entradas`, `rollos`, `movimientos`, `salidas`, `salida_lineas`, `salida_rollos` | A? | Kardex, retornos y dependencias financieras; no borrar padres conservando hijos incompatibles. |
| `viajes`, `viaje_salidas`, `viaje_tickets`, `contenedores`, `contenedor_lineas` | A? | Relaciones entre logística y documentos; aplicar grafo vigente. |
| `sesiones_caja`, `sesiones_caja_dias`, `salidas_dinero_caja`, `cuadre_fiscal_registros` | A? | Caja tiene nuevas dependencias E3/E4/E12/E5/E11; cuadre figura históricamente fuera de Drizzle, verificar presencia. |
| `sesiones`, `solicitudes_pago_dirigido`, `notificaciones_credito`, `notificaciones_sistema`, `stock_minimo_episodios` | A? | Revocación de sesiones expresamente aprobada; solicitudes/notificaciones pueden pertenecer a evidencia nueva, no presumir caché descartable. |
| `auditorias_inventario`, `auditoria_inventario_snapshot`, `auditoria_inventario_escaneos`, `auditoria_inventario_participantes` | A? | No son la bitácora `auditoria`; revisar resoluciones dependientes. |
| `reimpresiones_etiqueta`, `revisiones_etiqueta`, `auditoria_sobrante_contextos`, `auditoria_sobrante_decisiones`, `auditoria_faltante_reactivaciones` | A? protegida | Historial y cadenas append-only; conservar hasta excepción y mecanismo aprobados. |
| `operaciones_credito_e1`, `cobros_credito_pendientes_e1`, `atribuciones_credito_e1` | A? protegida | Claims, retenciones e identidades completas no son temporales; analizar vínculos físicos y lógicos y cadenas de rectificación. |
| `finalizaciones_abono_e2`, `evidencia_no_aplicada_e2` | A? protegida | Evidencia durable, restricciones diferidas y procedencia de operación. |
| `fondo_mariana` | C por defecto | Singleton/configuración; identificar campos de saldo derivados. Si requieren ajuste, hoja B por columna firmada; nunca vaciar el singleton por conveniencia. |
| `fondo_movimientos`, `fondo_arqueos` | A? financiera protegida | Conciliar dinero y referencias E9/E12 antes; OFF no implica ausencia de saldo ni permiso de borrar. |
| `vistas_abono_e3`, `recibos_abono_e3` | A? protegida | E3 instalada: vistas persistidas/documentos, no vistas SQL descartables; recibos dependen de crédito, cliente y caja. |
| `recibo_folio_e3` | B? conservar por defecto | Mantener claves/sitios y valor actual; reset solo con objetivo exacto nuevo y prevención de colisión con recibos conservados. |
| `caja_salidas_e4`, `caja_salidas_e4_operaciones` | A? protegida | E4 instalada; operaciones dependen de detalle y éste de `salidas_dinero_caja`. |
| `proveedor_operaciones_e12`, `proveedor_solicitudes_e12`, `caja_retornos_proveedor_e12`, `proveedor_efectivo_e12`, `caja_desbloqueos_e12` | A? protegida | E12 instalada; solicitudes, caja, pagos, dinero y claims deben clasificarse juntos. |
| `e9_entregas`, `e9_operaciones` | A? protegida | E9 instalada; existen guardas contra UPDATE/DELETE y TRUNCATE, más evidencia diferida hacia Fondo. |
| `e5_recepciones`, `e5_cobros`, `e5_aplicaciones`, `e5_vinculos_credito`, `e5_salidas_bancarias`, `e5_devoluciones`, `e5_documentos`, `e5_operaciones`, `e5_impresiones`, `e5_nacimientos` | A? protegida | E5 instalada; conciliar cobro/aplicación/devolución y documentos, incluidos vínculos no-FK. |
| `e5_ddl_originales` | C | Definiciones de recuperación/configuración; no tratarlas como ventas de prueba. |
| `e11_perfiles` | C por defecto | Configuración de perfiles; si alguna fila fuera estrictamente operativa, nueva clasificación por fila antes de autorizar, nunca borrado total automático. |
| `e11_perfil_eventos`, `e11_operaciones`, `e11_resoluciones`, `e11_conciliaciones`, `e11_conciliacion_ventas`, `e11_decisiones`, `e11_avisos`, `e11_notificacion_origen`, `e11_cambios_usuario` | A? protegida | E11 instalada: preservar por ahora; revisar coherencia de perfiles/usuarios conservados y evidencia dependiente, no borrar sus antecedentes a ciegas. |
| `e11_e5_preparaciones`, `e11_e5_definiciones` | C por defecto | Preparación/definiciones cruzadas; resolver referencias a operaciones A? antes de fijar alcance. |
| E7 | C de código/configuración | Lector sin tabla nueva identificada en las fuentes revisadas; no certifica ausencia en catálogo vivo. |
| `existencias` | B? reconstrucción | Función canónica con el mismo `tx`, mismos pares válidos, coherente con kardex/rollos; no asignar ceros manualmente. |
| `ticket_folio`, `entrada_folio`, `salida_folio`, `viaje_folio`, `auditoria_inventario_folio`, `series_consecutivo` | B? conservar por defecto | Hoja de objetivos por clave/campo antes de aprobar cualquier reset. |
| Cualquier otro objeto, partición, tabla auxiliar, cola, vista materializada o dato externo descubierto | PENDIENTE = bloqueo | Reconciliar contra catálogo y productores; no incorporarlo a A por omisión. |

La preservación C exige igualdad de filas **y todos sus valores**, no sólo conteos. Si C referencia A por FK o identidad lógica que deba seguir resolviéndose, se conserva también el cierre de padres o se detiene para nueva decisión; no se corta la relación silenciosamente. Un alcance parcial exige predicados deterministas y hashes del conjunto autorizado; este plan no supone que toda fila sea prueba por estar en development.

## 3. Auditoría, ownership y mecanismo futuro de excepción

- `auditoria` permanece append-only sin excepción. La referencia histórica a un movimiento puede quedar no resoluble si el movimiento de prueba se elimina expresamente: no reescribir payload para “repararla”, ni reutilizar IDs. `reports/prompt-f/reference-owner-contract.md` exige coincidencia de propietario, tipo, importe y timestamp exacto, además del ID; cuando no se resuelve, la ruta/propietario deben ser nulos. No inventar owners ni reatribuir los #51–53.
- Conservar propietarios de objetos PostgreSQL, roles, ACL, privilegios por defecto y políticas; un dump sin ownership/ACL no demuestra recuperación íntegra. No otorgar privilegios de superusuario a la app ni cambiar owner para facilitar purga.
- **Bloqueo técnico vigente:** no hay un operador final aprobado compatible con todo el append-only instalado. La autorización de negocio de purgar pruebas no modifica por sí sola las guardas PostgreSQL.
- Mecanismo de autorización futura en dos puertas: (1) propietario firma alcance por tabla/fila, excepción financiera concreta, identidad de entorno, ventana, objetivos B, retención de evidencia y estrategia de recuperación; (2) revisión técnica independiente aprueba una propuesta estrecha, versionada y ensayada para cada guarda afectada. Si no existe una vía que satisfaga la política vigente, se conserva esa evidencia y se vuelve al propietario; no se ejecuta una purga parcial fingiendo cierre.
- Ningún script puede usar TRUNCATE porque “no dispara DELETE”, `session_replication_role`, DISABLE TRIGGER, DROP/recreate de tablas/funciones/constraints, CASCADE, cambio de owner o bypass de rol para eludir append-only. La excepción histórica de cinco triggers de septiembre 13 **no es** un permiso vigente. Cualquier cambio futuro de política requeriría autorización separada y específica; no se prepara ni habilita aquí.
- La evidencia de la operación futura debe ser durable y privada antes de comenzar y después de confirmar. Si se autoriza insertar un evento nuevo en `auditoria`, declarar por separado ese único delta append-only; la fotografía histórica C queda idéntica. No prometer simultáneamente igualdad total de auditoría e inserción no contabilizada.

## 4. Inventario y orden: cómo obtener el catálogo actual sin asumirlo

**Ahora sólo lectura de archivos.** En una fase futura autorizada, capturar desde la base efectiva de la API (no desde otra rama ni por una URL del shell asumida):

1. Identidad segura de entorno/servidor/base/esquemas y revisión exacta del artefacto servido; no publicar conexiones.
2. Inventario completo de relaciones, particiones/herencia, columnas/defaults/enums, PK/UK/FK, constraints inmediatas/diferidas, índices, vistas y dependencias, funciones, triggers con definición y estado (`O` y `A` se distinguen), políticas RLS, owners, ACL y secuencias con `last_value`, `is_called`, incrementos y ownership.
3. Comparación nominal de catálogo efectivo contra Drizzle, migraciones y DDL manual **instalado** E2/E3/E4/E12/E9/E5/E11. Incluir inicializadores y dependencias lógicas de JSON/idempotencia, documentos, origen de notificación y auditoría. La lista histórica de 58/60 tablas no es un oráculo.
4. Cobertura exhaustiva: cada relación exactamente en A aprobada, B con campos/objetivos, C o pendiente. Cualquier nueva/ausente o pendiente detiene; firmar el manifiesto por nombres y huella semántica, no por cantidad.
5. Construir el grafo de hijos hacia padres. Añadir aristas lógicas y de triggers, y detectar ciclos. Producir un orden topológico **del catálogo capturado**, anexado a la autorización; no publicar hoy un orden total como probado. Una FK diferible no autoriza borrar su padre conservando el hijo al commit.

Orden de trabajo propuesto, condicionado a ese grafo y a resolver append-only:

| Etapa | Dependencia / precedencia a comprobar |
|---|---|
| 0 | Pausar todos los escritores autorizadamente; fotografía y locks deterministas; confirmar autorización y ausencia de drift. No borrar nada todavía. |
| 1 | Evidencia/operaciones hijas de E11/E5/E12/E9/E4/E3/E2/E1, resoluciones, consumos y aplicaciones, **únicamente si aprobadas y técnicamente permitidas**. Cycles o padres C incompatibles bloquean esta etapa. |
| 2 | Detalles y enlaces: consumos antes de líneas/rollos; aplicaciones antes de movimientos/pagos; recibos E3 antes de crédito/caja; E4 operaciones antes de detalle y detalle antes de salida de dinero; enlaces viaje antes de viajes/documentos; participantes/escaneos/snapshot antes de auditoría inventario. |
| 3 | Cabeceras operativas y kardex según FK real: tickets/salidas/entradas/rollos, crédito/proveedores, logística y caja. No heredar posiciones de A33 para estas tablas. |
| 4 | Sesiones y auxiliares autorizados una vez resueltas sus referencias. Ajustes B exactamente autorizados y reconstrucción canónica de existencias en el mismo `tx`. |
| 5 | Validación integral, incluyendo constraints diferidas, preservación C, catálogo/guardas/secuencias y coherencia financiera. Un fallo revierte toda la transacción; no se continúa por tabla. |
| 6 | Commit y lectura independiente en conexión nueva antes de reabrir escritores. Almacenamiento externo permanece conservado. |

Esta tabla da precedencias y bloqueos verificables, **no instrucciones para ejecutar DELETE** ni sustituto del grafo final.

## 5. Contadores y secuencias

Política propuesta segura: conservar todos los IDs y secuencias, incluida `contenedores_folio_seq`; sin `RESTART IDENTITY`, `setval` ni consumos `nextval` de “prueba”. Conservar también los contadores B salvo decisión nueva por campo y clave. `recibo_folio_e3` entra explícitamente en esta hoja; no omitirlo por ser nuevo.

Antecedentes no trasladables: septiembre 13 reinició contenedores y series a 1,000,000; Prompt H conservó identidad pero aún tenía objetivo de siete dígitos. La fuente vigente de series usa **10,000,000 / ocho dígitos**. Si el propietario solicita folios desde inicio, debe fijar cada valor y su siguiente número esperado, conservar claves de sitio y demostrar que no colisiona con documentos/auditoría conservados. No cambiar defaults ni resetear IDs por conveniencia. `nextval`/`setval` no se deshacen con rollback; `ALTER SEQUENCE RESTART` tiene semántica transaccional distinta, pero tampoco queda autorizado aquí.

## 6. Object storage y respaldo

El dump PostgreSQL **no contiene los bytes de object storage**. `cliente_documentos.ruta_archivo` enlaza objetos privados (`routes/cliente-documentos.ts`, `lib/private-object-storage.ts`); preservar tanto filas como objetos. Inventariar además cualquier adjunto/evidencia externa de E1/E2/E3/E5/Fondo, exports y referencias lógicas que revele el código instalado: no asumir cobertura sólo por esta ruta.

Propuesta: **cero borrado de object storage en la purga DB**. Respaldar privadamente objetos referenciados y metadatos/versiones/ACL; verificar tamaño y hash del contenido descargado y recuperación de referencias. No confiar únicamente en ETag ni publicar nombres privados, URLs firmadas o identificadores de personas. Respaldos históricos y sus copias remotas permanecen conservados; no se sobrescriben.

Si luego se desean eliminar objetos huérfanos de pruebas, exigir otro manifiesto exacto y autorización después de probar ausencia de referencias desde C, auditoría, evidencia y respaldos retenidos. Usar retención/cuarentena recuperable; nunca vaciar bucket ni borrar por prefijo global. Object storage no comparte el rollback PostgreSQL.

Respaldo futuro: ventana sin API/pollers/inicializadores/escritores; dump nuevo con datos, esquema, owners/ACL, funciones/triggers y estados de secuencias; manifiesto privado con herramientas y revisión, SHA-256 y tamaño; copia remota owner-only y descarga con mismo hash. Restauración aislada desde ese respaldo, igualdad de datos completos y catálogo semántico, privilegios, secuencias y objetos externos. No reutilizar hashes de septiembre 13/Prompt H como prueba actual.

Restore de recuperación contiene identidades privadas: no exponerlo como app, iniciar sesiones restauradas, copiar usuarios para fixtures ni publicar dump. Ensayo posterior sólo autorizado, aislado y con política de actores aprobada. Conservar una restauración prístina y re-restaurar después del ensayo; un rollback no prueba que las secuencias no avanzaron.

## 7. Verificación y criterios de aceptación futuros

| Frontera | Evidencia requerida / aceptación |
|---|---|
| Respaldo → restore | Todas las filas y campos con serialización determinista versionada, precisión íntegra; conteos y hashes iguales, catálogo/ACL/owners y secuencias iguales; objetos privados recuperables. |
| Preflight fresco → bajo locks | Mismo entorno, revisión, catálogo firmado, autorización vigente, conjuntos A/B/C y huellas iguales al respaldo. Drift, timeout, writer inesperado o guarda distinta = abortar y renovar evidencia. |
| Dentro de transacción | Sólo A aprobada vacía (o subconjunto exacto eliminado); C intacta, B sólo campos/objetivos autorizados, constraints completas válidas, cero referencias huérfanas, crédito/caja/Fondo conciliados y existencias reconstruidas coherentes. Todas las guardas/owners/ACL intactas, incluidas ALWAYS; secuencias conservadas salvo excepción explícita. |
| Postcommit independiente | Repetir comprobaciones desde conexión nueva sin tráfico ni login; registrar estado durable inequívoco. Un error al escribir reporte o respuesta no demuestra rollback: COMMIT incierto = detener sin reintentar. |
| Reanudación autorizada | Fotografiar deltas separados frente a postcommit; inicializadores pueden cambiar permisos, notificaciones o episodios. No ocultarlos ni reparar por suposición. UI/login/health no prueban integridad de datos. |

Antes del commit un error revierte todo; no aceptar savepoints como prueba de rollback integral. Después del commit no hay “rollback” de esa transacción: recuperación sólo mediante restauración autorizada, preservando evidencia del fallo y resolviendo escrituras posteriores para no perder operaciones. Si postcommit falla, no reanudar.

## 8. Revisión de operadores existentes — no ejecutados

| Archivo | Objetivo/seguridad observable en fuente | Dictamen para final |
|---|---|---|
| `scripts/src/purge-operational-phase2.mts` | Snapshot fijo septiembre 13, A33/B7/C18, DELETE ordenado antiguo, excepciones de triggers, reconstrucción con tx y reset específico. | NO reutilizar: catálogo, guardas, autorización, respaldo y objetivos obsoletos. |
| `scripts/src/prompt-h-authorized-purge.mts` | Snapshot fijo Prompt H, 60 tablas, hash/autorización/revisión principal, comparación bajo locks; dry-run abre DB; apply usa TRUNCATE con identidad conservada. | NO reutilizar ni siquiera dry-run ahora. Guardas nuevas/ALWAYS/no-TRUNCATE y evidencia E1–E12 impiden trasladar el método. No ajustar sólo conteos/fechas para hacerlo pasar. |

No se modificaron estos scripts ni se creó uno nuevo: un ejecutable “desarmado” que contuviera un atajo append-only sería una falsa preparación. La adaptación futura debe ser revisada y ensayada una vez aprobados catálogo y mecanismo, sin importar startup/seed/autenticación.

## 9. Hoja de decisión pendiente del propietario y revisión técnica

Antes de cualquier ejecución futura completar y firmar, sin valores implícitos:

1. Decisión de inicio real, entorno exacto, vigencia, ventana y operadores/revisor.
2. Manifiesto exhaustivo A/B/C y prueba de que A contiene sólo pruebas; tratamiento de histórico financiero, #51–53, retenciones, perfiles y cadenas de evidencia.
3. Objetivos B por campo/clave; secuencias a conservar y cualquier excepción explícita compatible con documentos conservados.
4. Mecanismo permitido para cada protección append-only afectada, sin excepción para `auditoria`; si no existe, alcance detenido.
5. Retención y respaldo DB/object storage/ACL completos, autorización de restore y ensayo privado, restauración comprobada y copia remota verificada.
6. Operador adaptado revisado, orden FK exacto, ensayo y preflight frescos, comparación bajo candados y criterios de rollback/recuperación.
7. Autorización final para aplicar **esa revisión y ese manifiesto**; reanudación y eventual recuperación con responsables.

**Resultado actual:** preparación documental completa para decidir, ejecución bloqueada deliberadamente por estas puertas. No se afirma respaldo fresco, restore PASS, ensayo PASS, catálogo vivo verificado ni purga realizada.