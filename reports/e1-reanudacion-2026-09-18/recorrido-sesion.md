# Recorrido de sesión E1 — 2026-09-18

## Resultado

**Recorrido completado con sesión ADMIN existente y logout normal.** La sesión
se obtuvo mediante el login normal de la API con credenciales existentes del
runtime y se cargó desde un archivo temporal protegido fuera del workspace.
No se imprimieron cookies/tokens ni se guardaron en el proyecto; el archivo
temporal se eliminó después del logout. No se probó el ingreso de credenciales
mediante los campos de la pantalla de login. No se usó una segunda cuenta
ni se creó, restableció o impersonó CAJA.

## Estado y navegación observados

- `GET /api/auth/me`: HTTP 200; rol real `ADMIN`.
- Inicio montado en `/caja/tiempo-real`; encabezado `Administrador / ADMIN /
  Global`.
- `/cobros`: estado global `Selecciona un sitio`. No se seleccionó sitio ni se
  comprobó si había tickets elegibles dentro de un sitio; no se abrió un cobro.
- `/clientes`: directorio de siete clientes activos; se evitó el cliente de
  sistema `Venta a Público`.
- `/clientes/7`: cliente existente no-sistema. Estado de cuenta
  consultado sin mutación; movimientos
  históricos #52, #53 y #51 conservan `Sin sitio determinado` y
  `Naturaleza histórica no determinada`.
- En `Estado de cuenta` se abrió `Registrar Abono Global` sin preview ni
  submit. Estado inicial: sitio vacío, naturaleza vacía, método
  `Transferencia`, cuenta vacía, importe vacío y preview deshabilitado.
- Se eligió localmente `Mariana` + `Ingreso físico` solo para inspección. En
  método de pago, `Efectivo (captura física deshabilitada)` estuvo disabled y
  `Transferencia` disponible/seleccionada.
- Se cerró y reabrió el diálogo: los defaults se resetearon a
  `Transferencia` y cuenta vacía. Luego se eligió localmente la categoría
  existente `Cuentas No Fiscales`; no se ingresó importe, no se hizo preview ni
  submit.
- El diálogo se cerró con Escape y se confirmó el logout normal; terminó en
  `/login`.
- CAJA-role: **pendiente/no verificado** (no se proporcionaron credenciales
  CAJA; no se creó ni impersonó).
- No se hace ninguna afirmación de comportamiento financiero final.

## Controles de seguridad y red

- Se instaló el enrutamiento antes de navegar.
- POST permitido únicamente para `/api/auth/login` y
  `/api/auth/logout`; POST/PUT/PATCH/DELETE restantes se habrían bloqueado.
- Intentos bloqueados: ninguno (`blocked []`).
- Alertas E1C01/E1P01/E1A01 en respuestas/console: ninguna observada.
- Solo hubo sesión/logout normal de autenticación; no hubo mutaciones de
  negocio, notificaciones, caja, POS ni formularios confirmados.
- Se observó un 401 de recurso al volver a login tras logout, consistente con
  la sesión cerrada; no produjo código E1 ni se trató de eludirlo.
- El navegador no alteró workflows ni entorno ni realizó escrituras de negocio.
  Login/logout sí produjeron los efectos normales de autenticación: sesión,
  último acceso y auditoría. La comparación posterior del padre confirmó
  diferencias sólo en auditoría y usuarios, sin cambios financieros.

## Capturas

- `reports/e1-reanudacion-2026-09-18/capturas/login-bloqueado.png`
- `reports/e1-reanudacion-2026-09-18/capturas/admin-inicio.png`
- `reports/e1-reanudacion-2026-09-18/capturas/pago-inicial-transferencia.png`
- `reports/e1-reanudacion-2026-09-18/capturas/cobros-mariana-sitio-filtrado.png`

## Límites

- CAJA no se verificó por falta de credenciales CAJA genuinas.
- En el complemento sí se seleccionó Mariana. No se abrió ticket normal de Cobro:
  Caja operativa mostró Apertura de Caja y no se abrió turno; en Cartera no se
  cargó un documento por QR/folio. No se acreditó ausencia de notas existentes.
  No se usaron fixtures ni se creó carrito/borrador POS.
- La captura de la forma de pago muestra el modal sin credenciales, tokens ni
  cookies.

## Complemento enfocado: Cobros con sitio Mariana

Este complemento corresponde a una **segunda sesión ADMIN autorizada** cargada
desde el storage-state temporal proporcionado por el parent. No se imprimieron
credenciales, cookies ni tokens; se hizo logout normal al terminar.

- En `/cobros`, la vista global inicial mostró `Vista Global`; se abrió el
  selector normal de sitio y se seleccionó la opción existente `Mariana`.
  La UI no mostró el prefijo `TIENDA`; la opción real fue exactamente
  `Mariana`.
- `Caja operativa` filtrada por Mariana cargó `Apertura de Caja`, con
  `Fondo Inicial (Efectivo)` vacío y botón `Abrir Turno`. No se abrió turno,
  no se introdujo efectivo y no se abrió ningún cobro.
- Respuestas API observadas durante la carga filtrada: `200
  /api/auth/me` y `200 /api/sesiones-caja/actual`.
- `Cartera / Estado de cuenta` filtrada no cargó tickets ni cobros; mostró
  únicamente entrada de QR/folio y `Escanea una nota de crédito para cargar el
  estado de cuenta.` No se cargó un documento ni se abrió diálogo de Cobro.
- Conclusión limitada: se verificó la pantalla de apertura/consulta, no un cobro
  ni la existencia o ausencia de documentos elegibles en la base. No se usaron
  fixtures, POS, carrito ni sesión de caja.
- Monitores de esta segunda sesión: `blocked []`, sin E1C01/E1P01/E1A01.
- Logout normal confirmado; terminó en `/login`.