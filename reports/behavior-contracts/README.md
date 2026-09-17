# Verificación de contratos de comportamiento

Fecha: 2026-09-17.

## Resultado

| Alcance | Antes | Después |
|---|---:|---:|
| Cinco archivos objetivo, 16 pruebas | 11 aprobadas / 5 fallidas | **16 aprobadas / 0 fallidas** |
| Suite amplia, mismos 99 archivos y 354 pruebas | 337 aprobadas / 17 fallidas | **342 aprobadas / 12 fallidas** |
| Pruebas omitidas en esos manifiestos | 0 | **0** |
| Typecheck completo | 0 errores | **0 errores** |

La suite amplia **no está completamente verde**. La comparación automática
en `suite-comparison.json` confirma que los 12 fallos restantes ya existían:
no hay fallos nuevos. No se modificaron esos contratos ni sus funcionalidades.

Los tres archivos de regresión PDF/browser excluidos del manifiesto seguro
desde la línea base siguen documentados en `suite-exclusions.txt`. No son
pruebas convertidas a `skip`: nunca se incluyeron en estos 99 archivos.

## Cambios realizados

1. **Enlaces:** se montan las seis páginas reales con datos controlados y se
   comprueba el destino exacto del identificador de producto, rollo, entrada,
   salida, viaje y contenedor. No se busca el nombre de una variable en JSX.
2. **Unidades:** se monta Productos y se comprueba que filtro y creación
   ofrecen METRO, KILO, BOLSA y PIEZA, por separado. También se comprueban
   totales por unidad y el filtrado BOLSA. Las constantes proceden del schema
   generado real; los dobles no fabrican el enum.
3. **Estado responsive:** se monta Salidas con anchos de 1440 y 390. Un
   observador envuelve el `SalidaEstadoBadge` real y comprueba todos sus datos,
   sin exigir una cantidad fija de invocaciones ni clases CSS determinadas.
   Las etiquetas de ciclo y las derivadas de venta a cliente deben proceder
   del componente observado, incluso en markup oculto.
4. **ENTREGADA:** se invoca la política real para una matriz de modalidades,
   roles, sitios y permisos, con controles positivos de estados cancelables.
   Además, el detalle real de una salida entregada para ADMIN conserva
   Imprimir y no muestra Cancelar.
5. **Dashboard:** se restauró la explicación bajo Inventario por Sitio. Es
   el único cambio en una pantalla de producción.

### Límite explícito de las pruebas de renderizado

Se utiliza React SSR sobre módulos reales, con datos y adaptadores locales
de infraestructura. No se crearon usuarios ni sesiones, no se conectaron las
pruebas a la API y no se escribió en la base.

SSR no calcula visibilidad CSS ni geometría de un navegador. El contrato
responsive comprueba por ello todos los representantes renderizados, incluidos
los ocultos; admite varias ramas válidas si todas usan el componente real
con los mismos datos. No se presenta esta comprobación como una prueba
visual de dimensiones.

## Defectos deliberados: rojo y restauración verde

Cada defecto se introdujo solamente en una copia bajo `/tmp`. El proceso real
debió terminar con código **1**, `AssertionError [ERR_ASSERTION]` y el mensaje
semántico esperado. Después se repuso el archivo original **en esa misma
copia**, se volvió a ejecutar la prueba y se exigió código **0**.

| Defecto | Resultado defectuoso | Después de retirarlo |
|---|---|---|
| Enlace del producto usa SKU en lugar de ID | `/productos/SKU-701` frente a `/productos/701` | Verde |
| Filtro de unidades omite BOLSA | No ofrece las cuatro unidades | Verde |
| Teléfono recibe CANCELADA en vez del estado del registro | Etiqueta incorrecta en el badge real | Verde |
| Teléfono muestra Cancelada fuera del badge y conserva uno correcto oculto | Etiqueta alternativa fuera del componente real | Verde |
| Teléfono muestra Por autorizar fuera del badge y conserva uno correcto oculto | Etiqueta derivada alternativa fuera del componente real | Verde |
| Helper permite cancelar ENTREGADA | La matriz obtiene `true` donde debe obtener `false` | Verde |

Evidencia individual:

- `links-units-red-*.txt` y `links-units-restored-*.txt`.
- `status-cancel-red-*.txt` y `status-cancel-restored-*.txt`.
- `status-cancel-negative.json`: códigos rojo/restaurado y mensajes reales.
- `links-units-green.txt` y `status-cancel-green.json`.

Los archivos vigilados por los servicios nunca fueron sustituidos por las
versiones defectuosas. Los runners no necesitan credenciales y ejecutan los
hijos con un entorno reducido.

## Comandos reproducibles

Desde la raíz:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  node scripts/src/behavior-links-units-negative.mjs

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test \
  node scripts/src/behavior-status-cancel-negative.mjs

env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm run typecheck
```

Los cinco archivos:

```sh
cd artifacts/mariana-textil
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm exec tsx --test \
  src/components/reportes/report-explanations.contract.test.ts \
  src/pages/detail-link-tables.contract.test.ts \
  src/pages/productos.contract.test.ts \
  src/pages/salidas-status.contract.test.ts \
  src/pages/salidas-venta-errors.contract.test.ts
```

Suite amplia, desde el mismo directorio frontend:

```sh
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test pnpm exec tsx --test \
  $(cat ../../reports/behavior-contracts/suite.manifest)
```

La salida esperada de la suite amplia sigue siendo código **1** por sus
12 fallos previos. Las salidas completas están conservadas en `suite-before.txt`
y `suite-after.txt`; el conjunto objetivo en `focused-final.txt`, y el
typecheck completo en `typecheck-final.txt`.

## Límites del alcance respetados

- No se modificó la regla de cancelación. La condición ENTREGADA que permanece
  en el detalle corresponde a impresión, no a una copia accidental de la
  política de cancelación. Se conservó la excepción específica de CAJA en historial.
- No se cambió el filtro de Inventario. Filtrar por activo alinea el catálogo
  operativo; conservar inactivos con existencias permite controlar stock residual.
  La decisión continúa pendiente del usuario.
- No se tocó el Prompt P ni se cerró su Grupo 1.
- No se crearon usuarios o sesiones ni se ejecutaron escrituras de base de datos.
- No se reinició la API. Se reinició únicamente el frontend y se comprobó su
  pantalla de acceso sin iniciar sesión. La captura no se usa como evidencia
  del Dashboard autenticado.