# Carga de clientes reales completada — 25/09/2026

**Se cargaron una sola vez los 2,575 clientes del archivo autorizado.**
MAIN comunicó los resultados de la prueba desechable antes de ejecutar la carga.
Después del commit, una conexión nueva verificó los datos en una transacción
`REPEATABLE READ READ ONLY`; no hizo ninguna escritura.

## Autorización

Texto literal conservado en [autorizacion-propietario.txt](autorizacion-propietario.txt):

> autorizo cargar estos 2,575 clientes en la base de la aplicación, con límite de crédito de $150,000 pesos cada uno, una sola vez, después de tu prueba en base desechable. No borres ni modifiques ningún otro dato.

## Resultado comprobado en la base de la aplicación

| Concepto | Resultado |
|---|---:|
| Clientes importados y verificados campo por campo | 2,575 |
| Con RFC / sin RFC | 2,277 / 298 |
| Con dirección particular / sin dirección | 2,007 / 568 |
| Con teléfono / sin teléfono | 1,924 / 651 |
| Clientes con RFC genérico XAXX010101000 | 7 |
| Registros excluidos | **0** |
| Límite de crédito de cada cliente | **$150,000.00 MXN** |
| Días de crédito de cada cliente | **0** |
| Saldo inicial de cada cliente | **$0.00** |
| Correo y contacto | Vacíos (NULL) |
| Total actual del catálogo | **2,576** |
| Cliente de sistema previamente existente | **1, conservado íntegro** |

La dirección del Excel se guardó en `direccion_particular`; la dirección de
entrega quedó vacía. Los nombres, direcciones y teléfonos se conservaron sin
truncamientos. El nombre más largo tiene 97 caracteres; el contrato API permite
200. Los 2,575 registros aprobaron también los validadores Zod reales de alta
y edición. RFC, teléfono y dirección no tienen un límite menor en esos contratos,
las rutas revisadas ni los formularios de alta y edición.

## Única normalización de RFC: quitar espacios y guiones

El archivo exacto contiene **cinco**, no siete, RFC que requieren esa limpieza.
La comparación se hizo contra la celda original, sin recortarla previamente:

| Fila Excel | Original | Guardado |
|---|---|---|
| 439 | CAC160222-RC6 | CAC160222RC6 |
| 1120 | IAR 161104PI0 | IAR161104PI0 |
| 1302 | COSA 591101FL4 | COSA591101FL4 |
| 1535 | LOS101130 S83 | LOS101130S83 |
| 2167 | JILR850422 IUA | JILR850422IUA |

Dos RFC de 14 caracteres no contienen espacios ni guiones y se conservaron
exactamente como vienen: fila **1632**, `PERMM690523QB5`; fila **1772**,
`GOMM5502223663`. No se inventaron correcciones ni se afirma su validez fiscal.
Los siete clientes con RFC genérico se mantuvieron separados, sin inventar RFC
y sin modificar restricciones del sistema.

## Integridad y evidencia

- Verificación independiente posterior al commit: coincidencia exacta de los
  **2,575 IDs importados** con todos los campos del archivo y valores autorizados.
- Las huellas de las **108 tablas**, excluyendo únicamente las nuevas filas de
  clientes, coinciden con las anteriores a la carga: el cliente existente y las
  **otras 107 tablas** no cambiaron.
- No se modificó el esquema ni se cargaron filas de auditoría u otras tablas.
  Solo se agregaron clientes y avanzó su secuencia de identificadores.
- La prueba previa sobre PostgreSQL desechable con el esquema efectivo completo
  comprobó carga íntegra, rechazo de repetición y rollback ante un fallo tardío.
- El archivo Excel original quedó intacto.

SHA-256 del archivo fuente:
`847e6e3305e66508bf7c5eefce1b73d107364e4ccd3d78852961a86f72fbed50`.

Evidencia técnica: [resultado-prueba.md](resultado-prueba.md),
[disposable-proof.json](disposable-proof.json),
[application-result.json](application-result.json),
[postcommit-readonly-proof.json](postcommit-readonly-proof.json).

**Carga terminada: no volver a importar este archivo.** Conservar la reclamación
`apply-once.claim.json` y el resultado de aplicación. La autorización fue de una
sola vez; no retirar el bloqueo de repetición ni ejecutar un reset.