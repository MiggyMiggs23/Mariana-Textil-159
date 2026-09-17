# Desactivación autorizada del catálogo Base — completada

## Respaldo previo

- API detenida durante respaldo, verificaciones y operación, sin reinicios intermedios.
- Captura: 2026-09-17T06:17:15.548Z.
- Restauración desechable: PASS; coincidieron las 60 tablas y las comparaciones de datos y esquema, incluidos triggers y secuencias.
- Archivo: `Mariana-Textil-catalogo-Base-2026-09-17-001715.dump`.
- Tamaño local y descargado: 437723 bytes.
- SHA-256 local y descargado: `250e5cd778c711a00c60946e4bfac3b50d596a315d2da9c086089bab8b09ba76`.
- [Copia verificada en Drive](https://drive.google.com/file/d/1CDGSNa9U7BHepv_3AvoWKn85PhLCESTL/view?usp=drivesdk).
- Permisos de carpeta y archivo verificados: solamente propietario.

## Operación

Se ensayó primero el mismo procedimiento en un clon local aislado de la restauración, sin conexión a la base operativa. El ensayo pasó todas las verificaciones.

Después se ejecutó una sola transacción SERIALIZABLE en la base operativa, con revalidación de la referencia y los conteos bajo bloqueo antes de escribir. COMMIT confirmado el 2026-09-17T06:29:15.421Z.

Únicamente se cambió `activo` de verdadero a falso en:

1. BOM-BAS
2. DUB-BAS2
3. GABCAM-BAS
4. GABDUC-BAS
5. LICMET-BAS
6. MIC-BAS
7. POL-BAS
8. SOC-BAS
9. TUL15-BAS
10. TUL70-BAS
11. TULEST-BAS
12. TULGLI-BAS

Se insertaron 12 registros de auditoría individuales, IDs 3987–3998, con snapshots completos antes/después. La atribución identifica mantenimiento local autorizado, sin suplantar un usuario ni una dirección IP HTTP.

## Verificación

| Comprobación | Antes | Después |
|---|---:|---:|
| Productos activos | 1234 | 1222 |
| Coincidencias Base | 16 | 16 |
| Productos con historial | 1010 | 1010 |
| Filas en precio_historial | 1016 | 1016 |

- ENC-BAS, FRACILBAB-BAS, MAN-BAS y PIQVER-BAS permanecen activos.
- No se borró ninguna fila. El total de productos sigue siendo 1234.
- `precio_historial` conserva íntegro su contenido, no solo sus conteos.
- Todos los productos no aprobados conservan sus filas completas.
- Los 12 productos modificados conservan todos los campos distintos de `activo`, incluido `updated_at`.
- Se preservaron las filas de auditoría previas y todas las demás tablas.
- De las 45 secuencias comparadas, únicamente avanzó la de auditoría, exactamente 12 posiciones.
- Consulta independiente READ ONLY posterior al COMMIT: PASS, 2026-09-17T06:30:11.233Z; comprobó conteos, los 16 estados y la correspondencia de las 12 auditorías con los productos actuales.

Evidencias: `block2-restore-metadata.json`, `drive-verification.json`, `check.json`, `rehearsal.json` y `result.json` en este directorio.

La API permanece detenida. No se ejecutaron inicializadores, autenticaciones ni otras tareas pendientes.