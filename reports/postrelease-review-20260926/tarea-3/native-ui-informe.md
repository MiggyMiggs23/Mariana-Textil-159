# Tarea3 — observación nativa, sin mutaciones positivas

## Continuación focalizada: fixtures elegibles, captura final

Misma API V9/UI af0541, headers verificados en cada login, copia18338. **Sólo se permitió POST login y participación/heartbeat de auditoría1**; ningún scan, cobro, cancelación, cierre o confirmación se ejecutó. No se modificaron permisos ni estados de negocio para inventar elegibilidad.

- Evidencia final ADMIN: [resultado](native-targeted-1790419570429/result.json), [scanner habilitado](native-targeted-1790419570429/ADMIN-audit-scan.png), [ticket1 Cobrar habilitado](native-targeted-1790419570429/ADMIN-ticket1-collect.png), [salida1 MA-000001 Cancelar habilitado](native-targeted-1790419570429/ADMIN-salida1-cancel.png). Ticket y salida exactos visibles; auditoría1 abierta, participación activa, piso real “Planta Alta” (estación escritorio/acceso).
- SUPERVISOR/BODEGA/SISTEMAS: [resultado](native-targeted-1790419485965/result.json), scan visible/habilitado tras renovar participación nativamente; Cobrar ausente por frontera externa. Capturas por rol/operación en esa carpeta.
- CAJA/TERMINAL: observaciones válidas respectivas en [resultado](native-targeted-1790419397346/result.json). Auditoría sin acceso; TERMINAL Cobrar sin acceso; CAJA salida1 Cancelar ausente **porque salidas/ver bloquea todo el módulo**, no porque se haya probado el guard editar sobre una fila visible.
- **Confirmar y aplicar sigue bloqueado por elegibilidad:** auditoría1 está ABIERTA; ADMIN tampoco tiene ese botón. No se cerró conteo ni se alteró estado para fabricarlo. Su ausencia para los otros roles no constituye cierre de permiso autorizar.
- Terminal final ADMIN: `TARGETED_OBSERVATIONS_COMPLETE`, cuatro observaciones,0 mutaciones impedidas,0 HTTP500. Los únicos POST permitidos tras login fueron participación/renovación. Recursos financieros intactos para que el dueño ejecute después sus positivos API.

Precedencia: la captura final ADMIN sustituye su captura intermedia de Cobrar en `native-targeted-1790419485965`, que todavía tenía hidratación en curso y fixtureVisible=false. Los intentos anteriores conservados incluyen errores **del arnés** (comparación de método de login y selector de Unirme ambiguo), no defectos de aplicación ni cierres de permisos. Sólo las celdas sin error descritas arriba son evidencia válida. No se repitió matriz completa, generación de venta, equipos ni Recalcular.

UI publicada **af0541fd749f49ffe917aaae51ba6adc8c1f99f1dd5ad1de419a57a2a0c578b5**, API **3aa7706416313c4bf5bbb0cfce03ee7f2151d0c36d6008579346b022d9c5a9ea**, copia18338, reloj normal. Headers verificados en cada login. Credenciales exclusivamente del archivo privado indicado en browser-request.json.

**No se tocaron permisos, perfiles, gates ni fixtures.** Interacciones nativas: login, navegación, selección de sitio, pestañas, consulta de auditoría, selección local de salida/precio/tienda emisora. Bloqueo preventivo de cualquier método distinto deGET/HEAD excepto login. **Cero intentos de mutación de negocio**, incluidas participación, escaneo, apertura de caja, cobro, reversión, generación, edición y recálculo.

## Evidencia válida y precedencia

1. [Matriz base30 observaciones](native-ui-1790418031511/result.json): seis actores y cinco pantallas solicitadas, más conciliaciónSISTEMAS.
2. [Auditoría abierta explícitamente / estadoPOS corregido](native-ui-1790418373171/result.json): sustituye las observaciones de auditoría y generación incluidas aquí.
3. [POS exacta salida2 solamente](native-ui-1790418525549/result.json): sustituye ADMIN/TERMINAL salidas_venta:crear. Se desmarcó salida1 y mantuvo salida2, sin pulsar generar. Sitio emisorMariana1.

El primer recorrido `native-ui-1790417765908` capturó estados transitorios de carga y **NO es evidencia de controles ocultos**. Se corrigió la espera de hidratación. También se cerró el selectorRadix antes de consultar accesibilidad y se seleccionó expresamente auditoría1 mediante su historial; no se confundió un popup abierto o una auditoría sin seleccionar con ausencia de permisos.

Cada carpeta válida contiene PNG y texto por celda, auth/me fresco completo de cada actor y solicitudesHTTP de consulta. Los resultados incluyen rol, usuario, sitio asignado, alcance, permiso efectivo, selector operativo, fixture y enlace al API seleccionado de cases.json/inventory.json. Las contraseñas no se guardaron en resultados.

## Resultados

| Operación exacta | Control positivo nativo | Resto / frontera |
|---|---|---|
|salidas:editar, POST `/inventario/salidas-extraordinarias/8/revertir`|ADMIN ve la serie10000002 de la salida extraordinaria8 enMariana, pero **no existe botónRevertir en la pantalla solicitada**.|No cerrar combinadas basándose en ausencia de un control que tampoco aparece paraADMIN. Los otros roles no aportan una contraparte positiva.|
|auditoria_inventario:editar, POST `/inventario/auditorias/1/escaneos`|ADMIN/SUPERVISOR/BODEGA/SISTEMAS: auditoría1 visible, campo scan **visible/deshabilitado**, “Unirme a la auditoría” **visible/habilitado**.|No están participando; **no se pulsó Unirme porque esPOST**. Esto es estado de negocio, no negativa de editar. TERMINAL/CAJA: frontera externa“Sin acceso”por ver. Necesita participación positiva autorizada para completar contraste scan.|
|salidas_venta:crear, POST `/salidas/venta-cliente/generar-venta`|**ADMIN y TERMINAL: “Recibir y generar venta” visible/habilitado**, salida2/cliente8, sólo salida2 marcada, tiendaMariana1; permiso efectivo crear=true.|SUPERVISOR/CAJA/SISTEMAS: fronteraPOS/ver; BODEGA entraPOS pero no dispone de la tarjeta de pendientes. No confundir conPOS genérico.|
|cobros_pagos:crear, POST `/tickets/1/cobrar`|ADMIN enMariana muestra **Apertura de Caja**, no ticket/Cobrar; caja no abierta.|No se pulsó Abrir Turno. Falta fixture de caja abierta para positividad nativa. TERMINAL tampoco puede consultar caja:403 exacto **ver** cobros_pagos; no es rechazo seleccionado crear. SUPERVISOR/BODEGA/SISTEMAS tienen frontera de acceso.|
|equipos:editar, PATCH `/equipos/1`|**ADMIN/SISTEMAS: equipoPR26-PERM presente y Editar visible/habilitado**; permiso efectivo editar=true.|TERMINAL/CAJA/SUPERVISOR/BODEGA: fronteraexterna“Sin acceso”por ver equipos. No se abrió diálogo ni se guardó.|
|SISTEMAS:conciliacion:editar, Recalcular|Página accesible, permiso editar=false; pero **Sin discrepancias**,1 combinación producto/sitio verificada, sin filas ni botónRecalcular.|**No corroborado nativamente** el bug enabled: falta discrepancia elegible. No se introdujo una artificial ni se cuenta como PASS.|

### Diferencia importante con la petición de controlTERMINAL efectivo permitido

En las credenciales entregadas, auth/me **TERMINAL235** devuelve:

- cobros_pagos: **ver=false, crear=false**;
- equipos: **ver=false, editar=false**;
- salidas_venta: **ver=true, crear=true**.

Coincide con el `auth-me.json` del dueño de permisos, no es pérdida de sesión ni selección de usuario incorrecto. **No hay controlTERMINAL efectivo permitido para Cobrar/Editar con este perfil**; no se falseó ni se cambió para conseguirlo. Hace falta que el dueño entregue la persona/perfil positivo autorizado si existe otro. TERMINAL sí constituye contraparte positiva real de generar venta de salida.

## Entrega al dueño de permisos

- Evidencia de elegibilidad positiva lista para generar desde salida2 (ADMIN/TERMINAL) y editar equipo1 (ADMIN/SISTEMAS), **sin consumir recursos**.
- Para auditoría requiere autorizar/preparar participación; para cobros abrir caja; para recálculo una discrepancia auténtica elegible; paraTERMINAL positivo de Cobrar/Editar el perfil correcto.
- Revertir no tiene contraparte en la pantalla indicada aun conADMIN y fila existente: revisar mapeoUI/API, sin atribuir a permisos el control inexistente.
- No se actualizaron contadores de cierre, inventory.json, resultadosAPI ni ledger del dueño. La aceptación combinada exige que éste cruce cada guard seleccionado, frontera y control positivo; no todas estas observaciones constituyen cierres.