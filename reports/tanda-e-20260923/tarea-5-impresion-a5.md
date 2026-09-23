# Tarea 5 — protocolo físico del recibo E3 en A5, dos copias

## Estado y alcance

**PROTOCOLO LISTO PARA EJECUTAR POR EL PROPIETARIO; PRUEBA FÍSICA AÚN NO REALIZADA NI APROBADA.**

Este documento no acredita que una impresora física haya pasado. Define una prueba manual reproducible en la computadora del propietario, porque Caja no tiene impresora. No se cambió código, base, permisos, workflow ni `replit.md`.

Fuentes inspeccionadas:

- `replit.md:582`: el recibo nace al cobrar, no al imprimir; son dos copias A5 horizontal; no hay impresora en Caja ni impresión automática; ADMIN lo abre desde abono, estado de cuenta o corte.
- `artifacts/mariana-textil/src/pages/caja/recibo-e3.tsx:15-16,54-108`: medición real, dos juegos de copias, A5 horizontal de 210 × 148 mm, área interior de 200 × 138 mm y margen interno de 5 mm.
- `artifacts/mariana-textil/src/pages/caja/recibo-e3.tsx:112-144`: acceso ADMIN, auditoría previa a abrir el diálogo y mensaje explícito de que cancelar el diálogo no vuelve a cobrar.
- `artifacts/mariana-textil/src/App.tsx:573-580`: ruta `/recibos-e3/:folio`, protegida para ADMIN.
- `artifacts/mariana-textil/src/pages/cliente-movimiento-detail.tsx:140-148`, `cliente-detail.tsx:248-251` y `corte-detail-shared.tsx:103-115`: accesos desde abono, estado de cuenta y corte.
- Memorias leídas: `.agents/memory/print-verification.md`, `.agents/memory/print-font-autofit.md` y `.agents/memory/automated-pdf-cursor.md`.

## 1. Equipo exacto

Preparar antes de iniciar:

1. **Computadora del propietario** con acceso a Mariana Textil y una sesión propia **ADMIN** activa. No compartir ni trasladar la sesión de Caja.
2. **Navegador de escritorio Chromium actualizado**: ejecutar primero en Google Chrome o Microsoft Edge y registrar nombre y versión exacta. Si se desea acreditar otro navegador, repetir toda la matriz y reportarlo por separado; no trasladar el PASS.
3. **Una impresora física con soporte declarado para A5 (148 × 210 mm)** y su controlador instalado en esa computadora. Registrar marca, modelo, tipo de conexión y versión del controlador.
4. Bandeja/guías ajustadas a **A5**, con al menos **cuatro hojas A5 blancas** para comparar una impresión original solicitada y una reimpresión. No usar media carta ni papel recortado como sustituto.
5. Impresión **a una cara**. El documento ya contiene “Copia Cliente” y “Copia Tienda”; en el diálogo se solicita **1 copia**, no 2. Pedir 2 al controlador produciría dos juegos completos.
6. Regla milimetrada, pluma para probar las firmas y cámara o escáner para conservar evidencia visual sin publicar datos personales.
7. El folio E3 real elegido y acceso a su abono/estado de cuenta/corte. No crear cobros para esta prueba.

## 2. Configuración previa del controlador

En las propiedades de la impresora:

- Papel: **A5, 148 × 210 mm**.
- Orientación: **horizontal / landscape**.
- Alimentación: bandeja que realmente contiene A5.
- Dúplex: **desactivado**.
- Ajuste del controlador (“fit”, “shrink”, “expand”, “borderless enlargement”): **desactivado**.
- Tamaño de salida distinto del tamaño del documento: **desactivado**.

Si A5 no aparece en el controlador, si el equipo obliga a Carta/media carta o si expande “sin bordes”, detener y marcar **FAIL de configuración/equipo**. No compensar cambiando CSS ni reduciendo escala a ojo.

## 3. Flujo soportado desde otra computadora

1. En Caja se cobra el abono normalmente. El recibo y su folio ya quedan generados en ese acto; imprimir no es el cobro.
2. En la computadora del propietario, iniciar sesión como **ADMIN**.
3. Abrir el recibo por uno de los accesos soportados:
   - detalle del abono: **Ver Recibo**;
   - estado de cuenta del cliente: enlace **Recibo [folio]**;
   - detalle del corte: sección **Recibos de Abono (E3) de esta sesión**.
4. Confirmar que la URL termina en `/recibos-e3/<folio>` y que pantalla, abono y papel corresponden al mismo folio.
5. Pulsar **Solicitar impresión / reimpresión** una sola vez. La solicitud se audita antes de `window.print`; abrir o cancelar el diálogo **no** vuelve a cobrar y tampoco demuestra que salió papel.

Roles:

- **CAJA** recibe/cobra, pero no necesita impresora ni es el rol soportado para esta página.
- **ADMIN** consulta e imprime posteriormente desde otra computadora.
- No se acredita impresión para SUPERVISOR, SISTEMAS, CONTADOR, BODEGA o TERMINAL: la ruta y el componente exigen ADMIN.

## 4. Opciones exactas del diálogo del navegador

Antes de confirmar cada tanda:

| Opción | Valor requerido |
|---|---|
| Destino | Impresora física registrada |
| Papel | **A5** |
| Diseño | **Horizontal** |
| Páginas | **Todas** |
| Copias del diálogo | **1** |
| Impresión | **Una cara** |
| Márgenes | **Ninguno** |
| Escala | **100 % / Tamaño real** |
| Encabezados y pies del navegador | **Desactivados** |
| Gráficos de fondo | **Activados** |

No usar “Ajustar a página”, “Reducir páginas grandes”, escala personalizada ni selección de páginas. La regla de página pide A5 horizontal con margen de navegador cero; el documento aporta sus propios 5 mm internos.

En la vista previa deben aparecer primero todas las páginas de **Copia Cliente** y después todas las de **Copia Tienda**. Si el recibo cabe en una página por copia, el total esperado es 2 páginas. Si se pagina por muchas asignaciones, el total esperado es `2 × páginas indicadas en cada copia`; no se debe ocultar ninguna con rangos.

## 5. Tanda A: impresión inicial conservada como original

1. Elegir un recibo que todavía no se haya usado en esta comparación, o identificar sin ambigüedad cuál juego físico previo será el “original”.
2. Anotar folio, movimiento, navegador, impresora, configuración y hora local.
3. Abrir por el flujo real y pulsar el botón real; no activar clases CSS manualmente.
4. Revisar la vista previa completa y anotar su número de páginas.
5. Imprimir con la tabla de opciones anterior.
6. Separar y rotular fuera del área impresa los juegos **A-Cliente** y **A-Tienda**.

## 6. Tanda B: reimpresión comparable

1. Sin cobrar otra vez ni cambiar datos, volver al mismo folio por uno de los accesos soportados.
2. Pulsar otra vez **Solicitar impresión / reimpresión**. Anotar la nueva hora.
3. Usar exactamente la misma impresora, bandeja, navegador y opciones.
4. Imprimir todas las páginas y rotular **B-Cliente** y **B-Tienda**.
5. No interpretar el registro de solicitud como confirmación de salida física: la observación y la evidencia del propietario son las que acreditan el papel.

## 7. Comparaciones obligatorias

### 7.1 Dentro de cada tanda: Cliente frente a Tienda

Comparar página por página:

- mismo folio, importe, cliente, teléfono/RFC cuando existan;
- mismo sitio, actor, recepción, registro, medio, cuenta y motivo;
- mismas filas de Nota, saldo anterior, aplicado y saldo posterior, en el mismo orden;
- mismos remanente, saldo a favor, deuda posterior y movimiento;
- mismo número de páginas y misma paginación;
- mismas líneas de firmas, completas y utilizables;
- única diferencia esperada: rótulo **Copia Cliente** frente a **Copia Tienda**.

### 7.2 Original A frente a reimpresión B

Comparar A-Cliente con B-Cliente y A-Tienda con B-Tienda:

- todos los datos inmutables y la división de páginas deben coincidir;
- no debe cambiar reparto, deuda, saldos, folio ni movimiento;
- la diferencia esperada es el instante de emisión impreso en el pie `REIMPRESIÓN / copia de evidencia emitida`;
- no deben aparecer renglones truncados, páginas en blanco, contenido de otra pantalla ni una tercera copia.

### 7.3 Geometría y legibilidad física

- Hoja física A5 horizontal: **210 × 148 mm**.
- El contenido debe conservar aproximadamente **5 mm de área interna** en cada borde; medir la tinta, no solo cajas teóricas de texto.
- Ninguna palabra, cifra, borde de tabla, firma o pie queda cortado.
- Las cuatro columnas son legibles; importes y folios no se superponen.
- Cada bloque de firmas permanece entero y admite escritura con pluma.
- El texto conserva contraste y tamaño legible a distancia normal.
- No hay hoja adicional. Una hoja con solo cursor o marca de una herramienta automatizada no se atribuye al layout sin inspeccionarla; esta prueba física no debe usar un cursor automatizado.

## 8. Criterio de resultado

**PASS** únicamente si todas las comparaciones de §7 pasan en las dos tandas y ambas copias.  
**FAIL** si falla cualquier copia o página, aunque la otra sea correcta. Registrar el defecto sin cambiar escala para esconderlo.

Ante FAIL:

1. conservar las hojas y fotografiar el defecto junto a una regla;
2. registrar página/copia, opción del diálogo y controlador;
3. repetir opcionalmente a **Microsoft Print to PDF** con A5, horizontal, sin márgenes y 100 % para diagnóstico, exportando todas las páginas;
4. si PDF y papel fallan igual, reportar composición; si solo falla papel, reportar controlador/alimentación;
5. no declarar causa ni arreglo sin evidencia.

## 9. Plantilla de evidencia PASS/FAIL

```text
PRUEBA FÍSICA RECIBO E3 A5 — RESULTADO: PASS | FAIL

Fecha y zona horaria:
Propietario que ejecuta:
Folio E3:
Movimiento:
Acceso usado: abono | estado de cuenta | corte
Rol de sesión: ADMIN

Computadora / sistema:
Navegador y versión:
Impresora marca/modelo:
Conexión:
Controlador y versión:
Bandeja:
Papel medido: ____ × ____ mm

DIÁLOGO
Papel A5: PASS | FAIL
Horizontal: PASS | FAIL
Márgenes Ninguno: PASS | FAIL
Escala 100 % / Tamaño real: PASS | FAIL
Todas las páginas: PASS | FAIL
Copias = 1: PASS | FAIL
Una cara: PASS | FAIL
Encabezados/pies navegador OFF: PASS | FAIL
Gráficos de fondo ON: PASS | FAIL

TANDA A (original de comparación)
Hora:
Páginas vista previa:
Páginas físicas:
A-Cliente completa/legible: PASS | FAIL
A-Tienda completa/legible: PASS | FAIL
Cliente vs Tienda, salvo rótulo: PASS | FAIL

TANDA B (reimpresión)
Hora:
Páginas vista previa:
Páginas físicas:
B-Cliente completa/legible: PASS | FAIL
B-Tienda completa/legible: PASS | FAIL
Cliente vs Tienda, salvo rótulo: PASS | FAIL

COMPARACIÓN A ↔ B
Folio/movimiento/importe idénticos: PASS | FAIL
Cliente/sitio/actor/fechas de recepción idénticos: PASS | FAIL
Asignaciones y saldos idénticos: PASS | FAIL
Paginación idéntica: PASS | FAIL
Solo cambia hora de emisión esperada: PASS | FAIL

FÍSICO
Hoja 210 × 148 mm: PASS | FAIL
Tinta dentro del área segura: PASS | FAIL
Sin cortes/solapamientos: PASS | FAIL
Firmas completas y escribibles: PASS | FAIL
Sin hoja extra: PASS | FAIL

Defecto exacto si FAIL:
Copia y página:
Medición desde borde:
¿También ocurre en PDF diagnóstico?: sí | no | no probado
Archivos/fotos de evidencia:
Observaciones:
Firma del propietario:
```

Hasta que el propietario llene esta plantilla con observación física, el estado permanece **PENDIENTE**, no PASS.