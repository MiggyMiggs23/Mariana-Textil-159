# Autorización operativa condicionada — guardas temporales E1

Registrada el 18 de septiembre de 2026, antes de cualquier DDL o escritura de esta intervención en la base operativa.

## Alcance autorizado por el propietario

Instalar **tres funciones y tres triggers temporales y removibles sobre `heliumdb`**, sin tocar funciones, triggers ni restricciones permanentes de E1.

SQL presentado: `instalacion-transaccional-propuesta.sql`, SHA-256 `4ec88685b4c3d1e8906e10734e2e2ef46c94885c829c1a6f865b872bff7f55e5`. Los fragmentos individuales y sus retiros están en `sql/`.

## Condiciones obligatorias

1. Revalidar la identidad **desde el proceso de la API** antes del primer DDL. Si no puede confirmarse hoy, detenerse. No sustituir esta evidencia por un archivo histórico, una integración ni una conexión independiente.
2. La API permanece pausada.
3. Mantener un supervisor activo con su límite. Si se agota antes de COMMIT, interrumpir y revertir.
4. Si se pierde la respuesta después de COMMIT, verificar el resultado real. No presumir rollback ni reinstalar a ciegas.
5. Conservar esta autorización en `reports/` antes de la primera escritura operativa.
6. Antes de ejecutar, revalidar que la operativa mantiene sus **27 objetos E1** y no tiene las guardas. Cualquier diferencia obliga a detenerse.
7. Conservar el clon y el respaldo de Drive hasta cerrar E1.

## Verificación posterior requerida

- Tres guardas instaladas y activas.
- Los tres intentos de SQL directo rechazados con `E1C01`, `E1P01` y `E1A01`.
- Transferencias ordinarias, correcciones sin dinero físico y operaciones de crédito sin movimiento de dinero admitidas conforme a sus contratos.
- Tres movimientos históricos intactos.
- Tiempo real medido.

## Condiciones de retiro exigidas

- Efectivo: E2 y E3 coordinados.
- Pendientes: E3 y E5 con sus dependencias.
- Atribución histórica: no se libera automáticamente con ninguna entrega; requiere decisión explícita del propietario sobre la evidencia y el sitio.

La autorización no permite reanudar la API. Después de la intervención se debe informar si E1 queda listo para reanudarla o qué falta.

## Estado de esta autorización

**NO EJECUTADA: detenida en la condición 1.** La API está detenida y no hay un proceso API disponible cuyo pool real pueda consultarse. No se arrancó la API para intentar obtener la identidad ni se sustituyó por otra conexión. Los detalles se conservan en `detencion-por-identidad.md`.