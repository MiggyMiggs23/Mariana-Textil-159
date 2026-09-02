# Verificación general — Totales, histórico, pagos y tubulares

Fecha: 2026-09-01  
Zona horaria: America/Mexico_City

## Alcance verificado

1. Totales por unidad en Vista Global.
2. Histórico financiero permanente de clientes y proveedores.
3. Formas de pago EFECTIVO, TRANSFERENCIA y FACTURADO.
4. Impresión opcional de tubulares por color.

## Pruebas automatizadas

- Frontend completo: **89 aprobadas, 0 fallidas**.
- Inventario principal: **25 aprobadas, 0 fallidas**.
- Barrera de candados y Vista Global de inventario: aprobadas.
- Autorización POS por sitio: **5 aprobadas, 0 fallidas**.
- Clientes:
  - aging: **16 aprobadas, 0 fallidas**;
  - creación: **5 aprobadas, 0 fallidas**;
  - ledger: **1 aprobada, 0 fallidas**;
  - ajustes/API/documentos: **9 aprobadas, 0 fallidas**.
- Proveedores principal: **11 aprobadas, 0 fallidas** en base limpia.
- Aplicaciones de pago a proveedor: **2 aprobadas, 0 fallidas** después de ejecutar los inicializadores normales de la API.
- Typecheck completo del monorepo: aprobado.
- Build completo de API y frontend: aprobado.

Las suites mutantes se ejecutaron únicamente en bases vacías dentro de una rama Neon desechable. No se crearon usuarios, sesiones, tickets ni movimientos en development.

## Verificación móvil real

Viewport: 390 × 844 px, con lecturas interceptadas y sin mutaciones.

- Vista Global mostró `TOTALES · filtro actual`.
- Totales verificados sin mezclar unidades:
  - Rollos: 9
  - Mts.: 12.50
  - Kg.: 7.25
  - Bolsas: 4.00
- El pie permaneció visible y legible dentro de la tabla horizontal móvil.
- En POS, `Imprimir tubulares` estuvo visible y desmarcado por defecto.
- No se envió ninguna venta.

## Verificación de impresión

Se renderizó el componente real de ticket con seis rollos NORMAL en tres colores y una línea METREADO:

- Página 1: ticket normal.
- Página 2: tubular Azul.
- Página 3: tubular Rojo.
- Página 4: tubular Verde.
- Ancho físico: 80 mm.
- Folio, color, series, cantidades a dos decimales y totales correctos.
- La línea METREADO no creó una tira.
- Sin desbordamiento horizontal.

[Descargar evidencia PDF de cuatro páginas](./evidence/ticket-con-tubulares-80mm.pdf)

![Evidencia de ticket con tres tubulares](./evidence/ticket-con-tubulares.png)

## Resultado

Los cuatro bloques compilan y las verificaciones requeridas aprobaron. Metros, kilos y bolsas permanecen separados en cálculos, interfaz e impresión.