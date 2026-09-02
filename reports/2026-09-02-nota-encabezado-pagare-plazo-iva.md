# Evidencia de impresión — nota, encabezado, pagaré, plazo e IVA

Fecha: 2026-09-02  
Componente objetivo: `artifacts/mariana-textil/src/pages/ticket-detail.tsx`, ruta real
`/tickets/:id`.

## Resultado

No se generaron PDFs. No se fabricaron sustitutos HTML/PDF ni se utilizó información de
base de datos. La aplicación ya estaba disponible en `http://127.0.0.1:20329`; se preparó
una ejecución con Playwright y fixtures interceptados, pero Chromium no pudo arrancar en
este entorno.

El error reproducible al lanzar el ejecutable descargado fue:

```text
error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file
```

`ldd` también informó como no encontradas, entre otras, `libgobject-2.0.so.0`,
`libnspr4.so`, `libnss3.so`, `libdbus-1.so.3`, `libgio-2.0.so.0`, `libatk-1.0.so.0`,
`libX11.so.6`, `libgbm.so.1`, `libxcb.so.1` y `libasound.so.2`. Se intentó la instalación
documentada de dependencias de Playwright; Replit la bloqueó porque `apt`, `brew` y `yum`
no están disponibles en el contenedor y remitió al panel de dependencias del sistema.
Por tanto, la limitación es del runtime, no de la interceptación ni de la ruta.

Los cuatro archivos solicitados no existen bajo `reports/`:

- `2026-09-02-nota-cash-no-optionals.pdf`
- `2026-09-02-nota-cash-all-optionals.pdf`
- `2026-09-02-nota-credit-no-optionals.pdf`
- `2026-09-02-nota-credit-invoiced-all-optionals.pdf`

En consecuencia no hay resultados de `pdfinfo`, `pdftotext`, rasterización ni mediciones
DOM que puedan declararse como ejecutados.

## Matriz de fixtures preparada (sin enviar solicitudes mutantes)

Todos los casos usan `GET /api/auth/me`, `GET /api/tickets/:id` y
`GET /api/tickets/:id/documento-impresion?copia=INTERNA|CLIENTE` interceptados en el
contexto de navegador. La identidad interceptada es ADMIN autorizada para la ruta. No se
llama al botón de impresión ni se permite `POST`, `PUT`, `PATCH` o `DELETE`.

| Archivo previsto | ticketId | Pago / crédito | Facturado | Opcionales |
|---|---:|---|---|---|
| cash-no-optionals | 9001 | Efectivo, `esCredito=false` | no | sólo nombre de cliente |
| cash-all-optionals | 9002 | Efectivo, `esCredito=false` | no | destinatario, teléfono, correo, dirección de entrega y dirección fiscal |
| credit-no-optionals | 9003 | Crédito, `diasPlazo=30`, vencimiento `2026-10-02` | no | sólo nombre de cliente; se conserva la información obligatoria de crédito |
| credit-invoiced-all-optionals | 9004 | Crédito, `diasPlazo=30`, vencimiento `2026-10-02` | sí | todos los opcionales anteriores |

La proyección de cada caso era `documentoTipo=NOTA`, `notaSinPrecios=false`, estado
`VENDIDO`, dos líneas reales de presentación (un rollo NORMAL y una línea METREADO), y
dos copias: `INTERNA` y `CLIENTE`. Para el caso facturado: subtotal `$1,000.00`, tasa
`0.16`, IVA `$160.00` y total `$1,160.00`; los restantes: subtotal/total `$1,000.00` e
IVA `$0.00`.

El plan de captura era esperar ambas proyecciones, `document.fonts.ready`, todas las
imágenes y dos `requestAnimationFrame`, añadir exactamente `body.print-credito` y llamar
a `page.pdf({ printBackground: true, preferCSSPageSize: true })`. El componente genera
las dos páginas normales de nota por caso, una por copia.

## Hallazgos estáticos conocidos

### Autoridad de impresión, IVA y fecha de pago

La causa original del renglón de IVA en cero era exclusivamente de presentación: el
servidor persiste `iva = 0` en ventas no facturadas, pero la vista imprimía el renglón sin
consultar la bandera de facturación. La proyección autorizada de impresión ahora incluye
`facturado`, `esCredito`, `diasPlazo` y `fechaVencimiento`; la Nota consume esos datos sin
mezclarlos con la respuesta general del ticket.

La fila de IVA depende de `printData.facturado`; su importe procede de `printData.iva` y
su etiqueta de `printData.tasaIva`. Las copias sin precios continúan sin recibir subtotal,
IVA, total ni precios de línea.

Por diseño, los tres fixtures no facturados no mostrarían la fila de IVA; el caso 9004
sí la mostraría. La fecha de pago se formatea como fecha calendario local —sin interpretar
`YYYY-MM-DD` como medianoche UTC— para que `2026-10-02` se imprima `02/10/2026` en México.
Este caso quedó cubierto por una prueba ejecutable.

### Encabezado de tabla

El encabezado de artículos está dentro de la misma tabla que el cuerpo:
`.flex-1 table > thead`, con `w-full`; sus columnas y las filas usan el mismo algoritmo
de tabla. El `<thead>` tiene `sticky top-0`; no hay un encabezado separado con una rejilla
independiente. Por inspección de la estructura, no existe una causa estática de
desalineación horizontal entre encabezado y cuerpo. La confirmación geométrica (rectángulos
de tabla y `thead`) queda pendiente del navegador operativo.

### Pagaré, plazo, firma y altura

`Fecha de pago` se muestra sólo cuando la proyección indica crédito y existe vencimiento,
y `Plazo` sólo cuando la misma proyección incluye `diasPlazo`. El bloque legal “RECIBO DE MERCANCÍA Y
PAGARÉ”, incluido el texto LGTOC, también depende de `esCredito`; la firma se dibuja en
ambos tipos de nota. Cada copia es una `.credito-page-print` de `216mm × 140mm`,
`overflow-hidden`, con `@page credito-page` del mismo tamaño.

Las mediciones solicitadas de encabezado, legal, firma, totales y overflow no se
presentan como valores porque la página nunca llegó a layout de Chromium. La validación
posterior debe medir esos rectángulos en ambos ejemplares y contrastar:

- `scrollWidth/scrollHeight` y extremos de descendientes frente a `216mm × 140mm`;
- límites de encabezado, tabla, texto legal, línea/firma y totales;
- igualdad de `x` y `width` entre tabla y `thead`;
- páginas, tamaño y texto mediante `pdfinfo` y `pdftotext`, y rasterización con
  `pdftoppm` si el navegador puede arrancar.

## Limitaciones

Una exportación Chromium, aun cuando pueda ejecutarse, es evidencia de composición CSS y
PDF, no una prueba de impresión física: no mide tolerancias de impresora, escalado del
driver, márgenes no imprimibles, papel ni tinta. En esta ejecución, además, faltan las
bibliotecas del sistema para ejecutar Chromium, por lo que no hay evidencia visual ni
PDF verificable.

## Verificaciones automatizadas completadas

- Frontend: 97/97 pruebas de contrato aprobadas.
- Servidor, creación y términos de cliente: 6/6 aprobadas.
- Typecheck global aprobado.
- Build global aprobado.
- `git diff --check` aprobado.