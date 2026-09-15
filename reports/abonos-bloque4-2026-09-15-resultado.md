# Bloque 4 — ejecutado y verificado

**Resultado:** se completaron exactamente las cuatro operaciones financieras
autorizadas, en el orden indicado, mediante los endpoints existentes y una
sesión operativa real de una cuenta ADMIN existente. No hubo reintentos
financieros ni movimientos adicionales de corrección.

## 1. Instantes exactos comprobados antes de escribir

Zona: **America/Mexico_City, UTC−06:00**. La fecha local del servidor se
revalidó antes de cada operación: **15/09/2026**.

| Cliente / abono original | Recaptura usada | Cargo de la nota | Diferencia exacta |
|---|---|---|---:|
| 6 / 46 — $10,000 | **15/09/2026 13:35:17.006** | 43 / nota 1004: 15/09/2026 13:29:34.336084 | **+342.669916 s** |
| 7 / 45 — $15,000 | **15/09/2026 13:34:10.192** | 44 / nota 1005: 15/09/2026 13:32:04.605206 | **+125.586794 s** |

Los payloads enviados fueron exactamente:

```json
{"clienteId":6,"fechaEfectiva":"2026-09-15T13:35:17.006-06:00"}
{"clienteId":7,"fechaEfectiva":"2026-09-15T13:34:10.192-06:00"}
```

`clienteId` identifica aquí la ruta de cada solicitud. No se envió un ticket
dirigido. Ambas fechas coincidieron con la captura original guardada.
No se usó mediodía, una fecha por omisión ni redondeo.
Las fechas persistidas de las recapturas se comprobaron después de cada POST.

## 2. Operaciones ejecutadas

Signos en esta tabla: **libro de crédito**.

| Orden | Operación | ID nuevo | Origen | Importe | Fecha efectiva en Ciudad de México | HTTP |
|---:|---|---:|---:|---:|---|---:|
| 1 | Reverso total del abono 46 | **47** | 46 | +$10,000.00 | 15/09/2026 15:16:51.254 | 201 |
| 2 | Reverso total del abono 45 | **48** | 45 | +$15,000.00 | 15/09/2026 15:16:51.304 | 201 |
| 3 | Recaptura correspondiente al 46 | **49** | Referencia al 46 | −$10,000.00 | **15/09/2026 13:35:17.006** | 201 |
| 4 | Recaptura correspondiente al 45 | **50** | Referencia al 45 | −$15,000.00 | **15/09/2026 13:34:10.192** | 201 |

Las recapturas conservaron **EFECTIVO / CAJA_FISICA**. Sus referencias y notas
identifican al abono original y aclaran que no hubo ingreso físico adicional.
Los reversos llevaron la fecha del servidor, sin intentar retrofecharlos.

Se encontraron los cuatro registros de auditoría financiera:

| Auditoría | Acción | Movimiento |
|---:|---|---:|
| 3959 | REVERSAR_PAGO_CLIENTE | 47 |
| 3960 | REVERSAR_PAGO_CLIENTE | 48 |
| 3961 | PAGO_CLIENTE | 49 |
| 3962 | PAGO_CLIENTE | 50 |

## 3. Saldos y reparto confirmados

Lectura del proyector canónico dentro de una transacción de solo lectura,
contrastada con las respuestas HTTP reales:

| Cliente | Nota | Saldo deudor | Saldo a favor | Recaptura aplicada |
|---|---|---:|---:|---:|
| **6** | **1004** | **$5,750.00** | **$0.00** | 49: $10,000.00 |
| **7** | **1005** | **$7,022.00** | **$0.00** | 50: $15,000.00 |

Aplicaciones persistidas:

```text
id | abono_movimiento_id | venta_movimiento_id | importe
5  | 49                  | 43                  | 10000.00
6  | 50                  | 44                  | 15000.00
```

Los dos POST también devolvieron `saldoAFavor = "0.00"` y
`saldoAFavorGenerado = "0.00"`. No se añadió ningún movimiento para forzar
este resultado.

## 4. Verificación real de Historial y «Ver Reparto»

Comprobación aprobada sobre la aplicación montada, con la misma sesión
operativa real, **sin fixtures ni sesión de prueba**. Se bloquearon todos los
POST/PUT/PATCH/DELETE del navegador; hubo **cero solicitudes mutadoras**.

- `/tickets/104`: **Historial de Abonos (1)**, abono de **$10,000.00**,
  estado **ABONO PARCIAL**, pendiente **$5,750.00**.
  Al pulsar **Ver Reparto** se abrió el detalle de la nota **1004**:
  **$15,750.00 → $5,750.00**, aplicado **$10,000.00**.
- `/tickets/105`: **Historial de Abonos (1)**, abono de **$15,000.00**,
  estado **ABONO PARCIAL**, pendiente **$7,022.00**.
  Al pulsar **Ver Reparto** se abrió el detalle de la nota **1005**:
  **$22,022.00 → $7,022.00**, aplicado **$15,000.00**.

Las dos ventanas se cerraron al terminar. Después se cerró la sesión
operativa por el endpoint normal y se eliminó su archivo temporal privado.
Esta comprobación no extiende la aprobación a pruebas antiguas de otras
pantallas, estados o tamaños.

## 5. Originales y veto preservados

Se compararon las huellas de las filas completas de los movimientos
**43, 44, 45 y 46** antes y después. Coinciden: no se modificó ninguno.

- **45:** permanece como ABONO de **−$15,000.00**, efectivo el
  **14/09/2026 a las 18:00:00** en Ciudad de México.
- **46:** permanece como ABONO de **−$10,000.00**, efectivo el
  **14/09/2026 a las 18:00:00** en Ciudad de México.
- Los cargos 43 y 44 conservaron su metadata completa, incluido el
  veto histórico **`preventImplicitFavor=true`**.

## 6. Efecto diario confirmado

Signos en esta tabla: **dinero recibido**, opuestos a los del libro de crédito.
Se aíslan estos originales y las cuatro operaciones; no se afirma el total
global de todos los movimientos del sitio.

| Día local | Originales 45 y 46 | Reversos 47 y 48 | Recapturas 49 y 50 | Neto |
|---|---:|---:|---:|---:|
| **14/09/2026** | +$25,000.00 | $0.00 | $0.00 | **+$25,000.00** |
| **15/09/2026** | $0.00 | −$25,000.00 | +$25,000.00 | **$0.00** |

**Confirmado: el día 14 conserva los $25,000 y el día 15 quedó en cero neto
por las cuatro operaciones.** No se trasladó el ingreso histórico al día 15
ni se modificó la lógica de Cobrado o Cuentas Destino.

Consulta ejecutada:

```sql
SELECT (created_at AT TIME ZONE 'America/Mexico_City')::date::text AS dia,
       sum(-importe)::numeric(18,2)::text AS neto_recibido,
       sum(-importe) FILTER (WHERE id = ANY($1::int[]))
         ::numeric(18,2)::text AS neto_cuatro_operaciones
FROM movimientos_credito
WHERE id = ANY($2::int[])
GROUP BY 1 ORDER BY 1;
-- $1 = [47,48,49,50]
-- $2 = [45,46,47,48,49,50]
```

Salida textual:

```json
[
  {"dia":"2026-09-14","neto_recibido":"25000.00","neto_cuatro_operaciones":null},
  {"dia":"2026-09-15","neto_recibido":"0.00","neto_cuatro_operaciones":"0.00"}
]
```

## 7. Evidencia y alcance

- **Consultas, parámetros, salidas textuales y respuestas HTTP:**
  `reports/abonos-bloque4-2026-09-15-ejecucion.jsonl`.
- **Verificación de navegador:** `reports/abonos-bloque4-2026-09-15-ui.md`.
- El intento anterior bloqueado por HTTP 401 se conserva separado en
  `reports/abonos-bloque4-2026-09-15-evidencia.jsonl`; no produjo operaciones
  financieras ni se borró su evidencia.
- No se crearon usuarios ni se alteraron permisos o contraseñas.
- No se modificó código de la aplicación ni los **cuatro errores de tipos**.
- No se ejecutó ni implementó nada del **Bloque 5**.
- No hubo publicación ni movimientos financieros fuera de los cuatro
  autorizados.