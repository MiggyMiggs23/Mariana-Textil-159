# Abonos, estados y saldo a favor: resultado de la verificación

Fecha: 2026-09-15, America/Mexico_City.

**Resultado general: entrega no aprobada integralmente.** Hay avances
implementados, comprobaciones parciales aprobadas, fallos y recorridos bloqueados.
Los fallos encontrados en la verificación no se corrigieron automáticamente.

## Cambios y alcance

- El contador circular ya existía en el componente montado de salida para
  venta a cliente. Se comprobó su comportamiento sin reimplementarlo.
- La ficha del cliente conserva el saldo a favor visible incluso en cero,
  separado del saldo deudor.
- Notificaciones recibe el saldo pendiente actual de la misma proyección
  canónica que determina el estado de la nota.
- La autorización recalcula el crédito disponible al seleccionar saldo a
  favor y limita la selección al saldo disponible y al importe de la nota.
  No se selecciona automáticamente. El servidor conserva sus comprobaciones.
- Se cambió un subtítulo restante a «Abonos a notas recibidos hoy». La revisión
  encontró que aún queda el título «Cobros de periodos anteriores»: el cambio
  de rótulo no está completo.
- Se añadió una prueba de la consulta real de Cobrado, en solo lectura.

## Bloque 2: diagnóstico todavía abierto

La consulta a través del pool configurado del entorno encontró cero ABONO.
La consulta de estado de publicación confirmó que este proyecto no tiene
publicación activa. No se identificó el movimiento original: falta conocer la
instancia y el folio en que se hizo la prueba.

La revisión de código confirmó dos comportamientos diferentes:

1. El Cobrado del tablero principal usa `getSalesSummary`, basado en tickets y
   pagos de caja, sin incorporar los ABONO del libro de crédito.
2. Cuentas Destino sí incorpora ABONO por la fecha del ingreso, pero exige
   `cuenta_destino IS NOT NULL`.

Estado de cuenta y cartera leen el libro sin ese filtro de cuenta destino.
Eso no constituye una reproducción del abono original ni demuestra su causa.

Propuesta pendiente de aprobación y de contrastar con el caso: exigir una
cuenta válida para todos los ingresos nuevos y hacer visibles los históricos
sin cuenta bajo una categoría explícita, sin inventar ni reescribir su destino.

Se habían preparado cambios del Bloque 2 antes de comunicar el diagnóstico.
Se retiraron íntegramente de los cuatro archivos afectados antes del reinicio.
No se ejecutó el inicializador nuevo ni se creó su tabla; se verificó su
ausencia mediante solo lectura. No quedó una corrección financiera activada.

## Los diez puntos solicitados

| Punto | Ejecución y resultado |
|---|---|
| 1. Typecheck completo y codegen sin diferencias | **FALLÓ.** `pnpm run typecheck`: 2 errores. Codegen terminó con salida 0, pero la primera comparación cambió 6 archivos; una segunda ejecución fue estable. |
| 2. Suites de crédito, caja, analytics y POS | **PARCIAL/FALLÓ.** Manifiestos seguros: 181 pruebas, 176 aprobadas y 5 fallidas. Integraciones que requieren escrituras, usuarios o base aislada quedaron bloqueadas, no aprobadas. |
| 3. Capturar varios rollos y comprobar contador | **APROBADO SOLO EN UI SIMULADA.** En el componente real: 0 → 1 → 3; una serie repetida dejó 3; retirar una dejó 2. No se guardó una salida ni se usó un escáner físico. |
| 4. Autorizar y abonar el mismo día, revisar las cuatro superficies | **NO EJECUTADO EN VIVO.** No se creó una nota ni un abono. El abono original no existe en la base consultada. |
| 5. Cuatro estados, con vencida parcial en rojo | **PARCIAL.** La UI real renderizó los cuatro textos con respuestas simuladas. La comprobación de colores sobre los elementos elegidos no estableció los cuatro colores; no se aprueba esa parte. |
| 6. Saldo pendiente junto a las tres notas impagas | **APROBADO SOLO EN UI SIMULADA.** Se comprobaron $100, $40 y $40 para pendiente, parcial y con retraso; pagada no mostró un saldo impago. No acredita todas las vistas/reportes. |
| 7. Pago excesivo genera saldo a favor visible | **NO EJECUTADO EN VIVO.** La ficha mostró deuda y favor separados con datos simulados; no se envió un pago excesivo. El caso de ficha con favor cero no se recorrió en navegador. |
| 8. Aplicar favor sin aumentar Cobrado del periodo | **APROBADO EN CONSULTA REAL GLOBAL/POR PERIODO, NO INTEGRAL.** Prueba SQL de solo lectura aprobada; sin autorización real y sin cobertura del filtro por sitio. |
| 9. Saldo a favor no editable directamente | **COBERTURA DE CONTRATOS/REVISIÓN, NO E2E.** No se ejecutó un intento real de edición ni una prueba de escritura contra las restricciones de la base. |
| 10. Pantallas nuevas en teléfono | **PARCIAL/FALLÓ.** El formulario de salida no desbordó horizontalmente. En crédito se observaron una barra horizontal y pestañas recortadas; no se aprueba la presentación móvil completa. |

### Prueba financiera de solo lectura

Comando:

```sh
pnpm --filter @workspace/api-server exec tsx src/scripts/verify-favor-cobrado-readonly.ts
```

Ejecuta `getDestinationAccounts`, la consulta real, con relaciones sintéticas
definidas mediante CTEs `VALUES`, en una transacción
`REPEATABLE READ READ ONLY`. No copia la fórmula financiera para simular un
resultado aprobado. Salida 0, 24 consultas del modelo de lectura y cero
escrituras del arnés.

| Etapa sintética | Abonos aplicados | Saldo a favor | Cobrado global / periodo de recepción |
|---|---:|---:|---:|
| Recibir $150; aplicar $100 | $100 | $50 | $150 |
| Aplicar después los $50 a otra nota, sin otro ABONO | $150 | $0 | $150 |

También comprobó que los periodos de la nota nueva y de la aplicación no
reciben otro Cobrado. Esto prueba el modelo de lectura, no el endpoint de
autorización, sus transacciones, permisos ni restricciones de escritura.

**Hallazgo pendiente de alta importancia:** por sitio, el favor no aplicado
solo aparece en la consulta global; al aplicarlo se atribuye al sitio de la
nota. Por ello puede aumentar Cobrado de ese sitio sin un ingreso nuevo.
La revisión lo identificó en el código; esta ejecución SQL no probó el filtro
por sitio. No se corrigió ni se dio por cumplida la regla completa.

### Prueba de selección de saldo a favor

En el diálogo real, con datos simulados: nota de $100, favor disponible de $50
y crédito resultante de -$30. Casilla inicialmente desmarcada y autorización
deshabilitada. Elegir $30 produjo crédito disponible de $0 y habilitó el
botón; $51, $101 y -$1 fueron rechazados. Se cerró con Cancelar: no se envió
la autorización.

## Fallos técnicos

El detalle, los comandos, los manifiestos y las integraciones bloqueadas están
en `verificacion-items-1-2.md`.

- `pos.ts:426`: `toISOString` sobre `never`.
- `clientes.ts:1329`: propiedad duplicada.
- Cinco fallos de contratos: función histórica `moneyState`, campo
  `estadoNota` requerido, orden de clases del contador, literal de estado
  pendiente y conteo de componentes compartidos de salidas.
- La revisión móvil encontró una barra horizontal visible aunque las
  dimensiones medidas del documento coincidían. No se interpretó esa
  medición como un aprobado visual.
- Las mediciones de color se hicieron sobre elementos exteriores y no
  permitieron confirmar el color de las insignias. Es cobertura insuficiente,
  no una causa visual demostrada.

## Seguridad y estado de la aplicación

No se crearon usuarios, ADMIN o sesiones persistidas de prueba. No se enviaron
pagos, autorizaciones ni escrituras de negocio para verificar estos cambios.
Los recorridos de navegador usaron respuestas en memoria y bloquearon
mutaciones; no son sesiones reales por rol.

No se ejecutaron migraciones nuevas ni `executeSql` en development. Los arneses
SQL fueron de solo lectura. Al final se reiniciaron los dos servicios con sus
comandos existentes; el API ejecutó sus inicializadores habituales, sin añadir
el inicializador retirado. No se afirma que el arranque normal no ejecute DDL.

Los dos servicios arrancaron. El API conserva el aviso de propiedad duplicada
ya reportado. La captura final de teléfono mostró el acceso de Mariana Textil;
no se inició sesión ni se publicó el proyecto.