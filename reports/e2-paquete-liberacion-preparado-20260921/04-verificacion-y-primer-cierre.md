# 4. Aceptación posterior y primer cierre nuevo

**Lista futura, no ejecutada.** Un primer cierre cambia estado, auditoría y
secuencias: no es una lectura ni una prueba que se pueda borrar después.
No está autorizado por la solicitud documental actual.

## A. Después del arranque, antes de aceptar actividad

- Conservar log de intento y manifiesto; verificar hash real del bundle,
  PID/instante de arranque, modo efectivo y salud/escucha.
- Confirmar que no corrieron inicializadores, backfills, reparaciones de esquema
  ni monitor escritores. Separar diferencias de login/sesión de las del DDL.
- Repetir lecturas de identidad y catálogo contra B1. E1C01, E1P01 y E1A01
  CLOSED; A+C conforme; flags backend y controles frontend cerrados.
- Confirmar por lectura que no aparecieron fuentes/pruebas A+C históricas
  inventadas, movimientos financieros nuevos ni cambios ajenos.
- Revisar la compatibilidad de consultas POS/administrativas y del frontend.
  Un HTTP 200 no demuestra que el corte usa el lector correcto.
- No enviar abonos, devoluciones, cobros retenidos o atribuciones “para probar
  que rechaza”. Esa prueba con escritura no está incluida en este release.
  La evidencia negativa previa proviene de la base sintética; cualquier
  validación adicional de guardas con DML exige autorización separada.

La aceptación de arranque puede quedar PASS y la del primer cierre PENDIENTE.
No declarar “snapshot operativo verificado” a partir de un corte histórico.

## B. Acuerdo operativo previo al primer cierre

El propietario debe designar **actor autorizado, sitio y una sesión real abierta**
y aprobar el conteo real de efectivo y la ventana de cierre. Registrar esos
identificadores en el acta restringida de ejecución, no inventarlos aquí.

No abrir una caja ficticia ni crear tickets, abonos, salidas o devoluciones para
producir cifras. Si no hay una sesión real elegible o no se dispone de conteo
aceptado, dejar este paso pendiente; no reemplazarlo por una fixture operativa.

Capturar por lectura el estado previo: sesión ABIERTA, fondo, fuentes documentales
y esperado; conservar evidencia de quién contó y autorizó el cierre. Una
diferencia distinta de cero no autoriza ajustar el conteo a la cifra esperada:
registrarla y someterla a aceptación operativa del propietario.

## C. Operación autorizable

Ejecutar **un único cierre normal** por la interfaz/ruta existente con el actor
y conteo aprobados. No UPDATE directo de sesión ni INSERT manual de auditoría.
La fuente candidata bloquea la sesión con FOR UPDATE, exige ABIERTA, calcula
antes del cambio y guarda cierre/snapshot/auditoría en la misma transacción.

Ante timeout o respuesta incierta, primero consultar si se confirmó; no repetir
por suposición ni mandar doble cierre. Si falló, registrar el fallo y detener
la aceptación; no reparar datos ni debilitar validadores.

## D. Evidencia exacta que debe existir

La sesión queda CERRADA y hay **exactamente una auditoría de cierre con snapshot**
para:

- `accion = 'CERRAR_CAJA'`
- `entidad = 'sesiones_caja'`
- `entidadId = String(sesion.id)` en la fuente
- `datosDespues.cashSnapshot` en el mapeo TypeScript de auditoría.

El objeto esperado es:

```text
cashSnapshot = {
  version: "E2",
  sesionId: <sesión realmente cerrada>,
  efectivoDesglose: {
    version: "E2",
    fondoInicial, cobrosTickets, abonosFisicos, cobrosRetenidos,
    salidasFisicas, efectivoEsperado,
    documentos: [...]
  },
  efectivoContado: <string monetario del conteo aprobado>,
  diferencia: <string monetario>
}
```

Comprobar montos en centavos, no tolerancias de flotantes:

```text
esperado = fondoInicial + cobrosTickets + abonosFisicos
           + cobrosRetenidos - salidasFisicas
diferencia = efectivoContado - esperado
```

El desglose congela documentos y su identidad/referencia; los nombres de usuario/
proveedor que correspondan también se guardan. No contar un REVERSO como otra
salida física: el lector usa la salida de caja correspondiente. No contar
transferencias como efectivo. No exigir un abono físico nuevo para esta prueba:
captura y devolución continúan apagadas.

Cotejar sesión, sitio, actor, instante, fondo, fuentes, contado, esperado y
diferencia entre persistencia, respuesta de cierre y cortes POS/administrativo.
Verificar documento/impresión del corte si la superficie vigente lo ofrece;
no inventar un recibo de abono ni afirmar que todo corte tiene un folio nuevo.

## E. Lecturas posteriores

- Recargar el corte cerrado: debe conservar exactamente el snapshot, no
  consultar movimientos actuales para recalcularlo.
- Comprobar de nuevo mediante otra lectura normal, sin modificar datos fuente
  para demostrar inmutabilidad en la base operativa.
- Los cierres históricos sin snapshot siguen LEGACY; no se les añade uno.
- Snapshot malformado o duplicado debe dar error explícito según el contrato,
  no fallback silencioso. Aquí se revisa evidencia previa/código; no corromper
  auditoría real para ensayar esos negativos.
- Verificar que no se produjeron capturas/devoluciones ni evidencia retrospectiva
  A+C y que las guardas/flags siguen cerrados.

Conservar acta antes/después, referencias de auditoría, respuestas/corte,
conteo aprobado y diferencias. No incluir secretos ni exportar datos a servicios
externos sin autorización de custodia.

## STOP y rollback después del cierre

Si hay inconsistencia, suspender la aceptación y preservar toda la evidencia.
No borrar auditoría/snapshot, reabrir caja, compensar importes ni habilitar
devoluciones. El rollback de instalación A+C no deshace un cierre.

Después de este hito, cualquier recuperación de bundle/DDL/datos requiere una
decisión nueva que preserve el snapshot y las operaciones legítimas. No volver
automáticamente al bundle pre-E2 ni restaurar B0 sobre actividad posterior.