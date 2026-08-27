# Validación Parte 1 — verdad de inventario (Bloque 5)

Fecha: 2026-08-26

## Alcance y matriz

El arnés `inventory-six-view.integration.test.ts` crea diez productos etiquetados, dos
sitios reales activos (PROPIA y OTRA), un sitio TRANSITO, sesiones reales ADMIN/TODAS
y BODEGA/PROPIA, y consulta por HTTP las seis superficies:

1. Inventario agrupado con `includeSinExistencia=true`.
2. Vista Global (`GET /api/dashboard`).
3. Dashboard (la misma ruta, cuya respuesta debe ser idéntica).
4. Catálogo de productos con `existencia=TODOS`.
5. Detalle HTTP de cada uno de los diez productos.
6. Reporte de inventario con filtros explícitos de producto y ubicación.

| Producto | Unidad | ADMIN cantidad/rollos | PROPIA cantidad/rollos | Caso |
|---|---:|---:|---:|---|
| P1 | METRO | 25 / 2 | 25 / 2 | dos disponibles propios |
| P2 | METRO | 20 / 2 | 12 / 1 | disponible propio y ajeno |
| P3 | METRO | 0 / 0 | 0 / 0 | MOSTRADOR con kardex +20/-20 |
| P4 | KILO | 10 / 3 | 10 / 3 | decimales propios |
| P5 | KILO | 0 / 0 | 0 / 0 | solo EN_TRANSITO |
| P6 | METRO | 0 / 0 | 0 / 0 | solo catálogo |
| P7 | KILO | 4 / 1 | 0 / 0 | existencia solo ajena |
| P8 | METRO | 15 / 2 | 15 / 2 | disponibles más MOSTRADOR balanceado |
| P9 | KILO | 6 / 3 | 3 / 2 | decimales propios y ajeno |
| P10 | METRO | 0 / 0 | 0 / 0 | solo catálogo |

Totales ADMIN: **METRO 60 / 6 rollos; KILO 20 / 7 rollos**.  
Totales PROPIA: **METRO 52 / 5 rollos; KILO 13 / 5 rollos**.

## Normalización

- Agrupado se aplana desde `colores`.
- Catálogo y detalle se indexan por ID de producto.
- Reporte suma por producto las filas de `existencia-actual`; una fila ausente se
  normaliza a cero.
- Dashboard se compara por ubicación y por unidad; no mezcla metros con kilos.
- Los enlaces individuales de rollos del detalle se verifican, pero nunca se usan
  para fabricar los totales esperados.
- P6 y P10 deben permanecer explícitamente en agrupado, catálogo y detalle con cero.
- Se validan además `CON_EXISTENCIA` y `AGOTADOS` bajo ambos alcances.

## Excepción de contenedor

P5 tiene dos rollos EN_TRANSITO (5 y 6 KILO), con costos unitarios únicos 31 y 32.
Para ADMIN aparece exclusivamente en los KPI separados **En contenedor**:
cantidad 11 y valor 347. No altera existencia disponible, conteo de rollos ni
totales/filas disponibles. PROPIA no puede ver el sitio TRANSITO aunque lo solicite.
No se modifica el ciclo de vida de contenedores ni el comportamiento de MOSTRADOR.

## Guardas, aislamiento y limpieza

El comando exige simultáneamente `NODE_ENV=test` y `TEST_DATABASE_URL` explícita.
El arnés rechaza igualdad de URL o nombre de base con `DATABASE_URL`, consulta
`current_database()` antes de cada mutación, etiqueta todos los fixtures y elimina
en `finally` únicamente los IDs que creó. Ejecuta `reconstruirCacheExistencias`
dos veces y comprueba idempotencia, suma firmada del kardex y conteo DISPONIBLE.

## Comandos

```sh
NODE_ENV=test TEST_DATABASE_URL='postgresql://…/base_desechable' \
  pnpm --filter @workspace/api-server test:inventory-six-view-integration
pnpm --filter @workspace/api-server typecheck
```

La integración de base de datos no debe ejecutarse contra desarrollo ni producción.

## Resultados de ejecución

Ejecutado el 2026-08-26 contra una base vacía con esquema y seed actuales dentro
de una rama Neon desechable.

- Resultado del arnés: **1 prueba aprobada, 0 fallidas**.
- Diez productos comprobados bajo ADMIN/TODAS y BODEGA/PROPIA.
- Se consultaron 36 respuestas HTTP reales durante la comparación.
- Inventario agrupado, Vista Global, Dashboard, Productos, diez detalles y
  Reporte coincidieron con la matriz en cantidad y rollos después de normalizar
  sus distintos niveles de agregación.
- El caché fue reconstruido dos veces sin cambiar resultados.
- Todos los pares etiquetados cumplieron simultáneamente:
  `cantidad_total = SUM(movimientos.cantidad)` y
  `rollos_count = COUNT(rollos DISPONIBLE)`.
- Los filtros `CON_EXISTENCIA` y `AGOTADOS` coincidieron con el alcance de cada
  usuario; los intentos PROPIA de solicitar el otro sitio no filtraron datos.
- P6 y P10 permanecieron visibles con cantidad 0 y rollos 0.
- P5 apareció como 11 KILO y valor 347 exclusivamente en **En contenedor**; los
  totales disponibles permanecieron en 0 / 0.
- La limpieza final eliminó únicamente los fixtures etiquetados.

No fue necesario corregir comportamiento adicional en el Bloque 5.