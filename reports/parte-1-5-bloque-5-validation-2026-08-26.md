# Validación Parte 1.5 — Bloque 5

Fecha: 2026-08-26

## Alcance de escaneo

La prueba estática/contractual de `CampoEscaneo` verifica una sola entrega por
`deliver` para Enter de teclado/pistola y resultado de cámara, limpieza y
recuperación de foco. Cubre `BarcodeDetector` nativo, el respaldo
`@zxing/browser`, preferencia de cámara trasera, QR y formatos lineales,
mensaje explícito al negar permiso, ocultamiento del botón cuando no hay cámara
y liberación de controles/streams al cerrar, detectar o desmontar.

Lista completa migrada: `salida-nueva`, `pos`, `ajustes`, `etiquetas`, captura
de rollos de `entradas` y recepción de Salidas.

## Estados y aislamiento

Conteo anterior a la migración: `REGISTRADA=0`, `SOLICITADA=0`, `ACEPTADA=0`,
`RECHAZADA=0`, `PREPARADA=0`, `ENVIADA=0`, `RECIBIDA=0`, `CERRADA=0`,
`CANCELADA=0`.

Mapeo aplicado y ya documentado: `REGISTRADA|SOLICITADA|ACEPTADA|PREPARADA →
ARMANDO`; `ENVIADA → EN_TRANSITO`; `RECIBIDA|CERRADA → RECIBIDA`;
`RECHAZADA|CANCELADA → CANCELADA`.

Las pruebas que requieren esquema, seed, usuarios o sesiones se ejecutaron
contra bases Neon aisladas y desechables. Nunca usaron usuarios/sesiones de
development.

## Resultados exactos

- Typecheck completo: **passed**.
- Esquema Salidas: **1/1**.
- Servicio Salidas: **5/5**.
- Contrato API Salidas: **4/4**.
- Alertas ADMIN: **1/1**.
- Unidades de reportes: **40/40**.
- Integración de reportes: **4/4**.
- Seis vistas de inventario: **1/1**, con **36 respuestas HTTP** y
  **10 productos**.
- Tránsito de reportes enfocado: **5/5**.
- Revisión de arquitectura: **PASS**; sin bloqueador de corrección o seguridad.

Las correcciones incluidas en la verificación son la expectativa correcta de
dos movimientos de kardex por rollo transferido y la serialización de
vencimientos `Date` de reportes a `YYYY-MM-DD`.

El build raíz falló únicamente porque `mockup-sandbox` requiere el `PORT`
provisto por workflow fuera de un workflow. Los servicios gestionados por
workflow son la ruta soportada para build/run.

## Aceptación física pendiente

La fuente, contratos y el ciclo de vida seguro en navegador se verifican
automáticamente. No es posible ejercitar físicamente en este entorno el permiso
y la detección de cámara de un teléfono ni diez escaneos consecutivos de una
pistola real. Esto es una comprobación de aceptación obligatoria en dispositivo
y no se reporta como aprobada.