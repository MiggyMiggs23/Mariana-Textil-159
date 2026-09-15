# Bloque 0 — Diagnóstico confirmado antes de corregir

Fecha: 2026-09-15. Zona operativa: `America/Mexico_City`.

Las consultas se ejecutaron antes de modificar código, mediante el pool
configurado de la aplicación. No se ejecutaron inicializadores, pruebas de
escritura, cambios de usuarios ni sesiones.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database_name,
       current_setting('transaction_read_only') AS read_only;
```

Salida textual:

```json
[{"database_name":"heliumdb","read_only":"on"}]
```

`metadata` es una columna de texto; se utilizó `metadata::jsonb` para consultar
sus propiedades. Los instantes se devolvieron como texto SQL, sin conversión de
fechas por el cliente JavaScript.

## 1. ABONO de los clientes 6 y 7

```sql
SELECT id, cliente_id, importe::text,
       to_char(created_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD HH24:MI:SS.US') AS created_at_utc,
       to_char(created_at AT TIME ZONE 'America/Mexico_City',
               'YYYY-MM-DD HH24:MI:SS.US') AS created_at_mexico,
       cuenta_destino, forma_pago,
       metadata::jsonb->>'fechaCaptura' AS fecha_captura
FROM movimientos_credito
WHERE tipo='ABONO' AND cliente_id IN (6,7)
ORDER BY cliente_id, created_at, id;
```

Salida textual:

```json
[
  {
    "id": 46,
    "cliente_id": 6,
    "importe": "-10000.00",
    "created_at_utc": "2026-09-15 00:00:00.000000",
    "created_at_mexico": "2026-09-14 18:00:00.000000",
    "cuenta_destino": "CAJA_FISICA",
    "forma_pago": "EFECTIVO",
    "fecha_captura": "2026-09-15T19:35:17.006Z"
  },
  {
    "id": 45,
    "cliente_id": 7,
    "importe": "-15000.00",
    "created_at_utc": "2026-09-15 00:00:00.000000",
    "created_at_mexico": "2026-09-14 18:00:00.000000",
    "cuenta_destino": "CAJA_FISICA",
    "forma_pago": "EFECTIVO",
    "fecha_captura": "2026-09-15T19:34:10.192Z"
  }
]
```

## 2. VENTA_CREDITO de las notas 1004 y 1005

```sql
SELECT m.id, m.cliente_id, m.ticket_id, t.folio, u.nombre AS sitio,
       m.importe::text,
       to_char(m.created_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD HH24:MI:SS.US') AS created_at_utc,
       to_char(m.created_at AT TIME ZONE 'America/Mexico_City',
               'YYYY-MM-DD HH24:MI:SS.US') AS created_at_mexico,
       m.fecha_vencimiento::text,
       m.metadata::jsonb->>'preventImplicitFavor' AS prevent_implicit_favor
FROM movimientos_credito m
JOIN tickets t ON t.id=m.ticket_id
LEFT JOIN ubicaciones u ON u.id=t.ubicacion_id
WHERE m.tipo='VENTA_CREDITO'
  AND m.cliente_id IN (6,7)
  AND t.folio IN (1004,1005)
ORDER BY m.cliente_id, t.folio, m.id;
```

Salida textual:

```json
[
  {
    "id": 43,
    "cliente_id": 6,
    "ticket_id": 104,
    "folio": 1004,
    "sitio": "Cruces",
    "importe": "15750.00",
    "created_at_utc": "2026-09-15 19:29:34.336084",
    "created_at_mexico": "2026-09-15 13:29:34.336084",
    "fecha_vencimiento": "2026-10-15",
    "prevent_implicit_favor": "true"
  },
  {
    "id": 44,
    "cliente_id": 7,
    "ticket_id": 105,
    "folio": 1005,
    "sitio": "Cruces",
    "importe": "22022.00",
    "created_at_utc": "2026-09-15 19:32:04.605206",
    "created_at_mexico": "2026-09-15 13:32:04.605206",
    "fecha_vencimiento": "2026-10-15",
    "prevent_implicit_favor": "true"
  }
]
```

## 3. Todas las aplicaciones relacionadas

```sql
SELECT a.id, a.abono_movimiento_id, a.venta_movimiento_id, a.importe::text,
       to_char(a.created_at AT TIME ZONE 'UTC',
               'YYYY-MM-DD HH24:MI:SS.US') AS created_at_utc
FROM aplicaciones_credito a
WHERE a.abono_movimiento_id IN (
  SELECT id FROM movimientos_credito
  WHERE tipo='ABONO' AND cliente_id IN (6,7)
)
OR a.venta_movimiento_id IN (
  SELECT m.id FROM movimientos_credito m
  JOIN tickets t ON t.id=m.ticket_id
  WHERE m.tipo='VENTA_CREDITO'
    AND m.cliente_id IN (6,7) AND t.folio IN (1004,1005)
)
ORDER BY a.id;
```

Salida textual:

```json
[]
```

## 4. Comparación de vencimientos

```sql
SELECT t.id AS ticket_id, t.folio, m.cliente_id, m.id AS movimiento_id,
       t.fecha_vencimiento::text AS vencimiento_ticket,
       m.fecha_vencimiento::text AS vencimiento_movimiento,
       t.fecha_vencimiento IS DISTINCT FROM m.fecha_vencimiento AS difieren
FROM tickets t
JOIN movimientos_credito m
  ON m.ticket_id=t.id AND m.tipo='VENTA_CREDITO'
WHERE t.folio IN (1004,1005) AND m.cliente_id IN (6,7)
ORDER BY m.cliente_id, t.folio, m.id;
ROLLBACK;
```

Salida textual del SELECT:

```json
[
  {
    "ticket_id": 104,
    "folio": 1004,
    "cliente_id": 6,
    "movimiento_id": 43,
    "vencimiento_ticket": "2026-10-15",
    "vencimiento_movimiento": "2026-10-15",
    "difieren": false
  },
  {
    "ticket_id": 105,
    "folio": 1005,
    "cliente_id": 7,
    "movimiento_id": 44,
    "vencimiento_ticket": "2026-10-15",
    "vencimiento_movimiento": "2026-10-15",
    "difieren": false
  }
]
```

## Dictamen

- **D1 CONFIRMADO para ambos:** el instante efectivo quedó a medianoche UTC,
  equivalente al día 14 en México. La captura real fue el día 15 a las
  13:35:17.006 y 13:34:10.192, respectivamente. Los días locales difieren.
- **D2 CONFIRMADO para ambos:** los instantes efectivos de los abonos preceden
  a los cargos de sus notas, y ambos cargos contienen
  `preventImplicitFavor=true`. La condición de elegibilidad de
  `canImplicitlyApply` rechaza esa combinación. No existen aplicaciones.
- **D3 NO CONFIRMADO:** los dos vencimientos coinciden en `2026-10-15` para
  cada nota. No corresponde corregir una discrepancia que no se encontró.
- Los dos abonos sí tienen destino `CAJA_FISICA`; la causa de estos dos casos
  no es una cuenta destino nula.

## Alcance histórico antes del cambio de regla

Se consultaron los clientes con cargos marcados mediante:

```sql
SELECT DISTINCT cliente_id
FROM movimientos_credito
WHERE tipo='VENTA_CREDITO'
  AND metadata LIKE '%"preventImplicitFavor":true%'
ORDER BY cliente_id;
```

Dentro de una transacción READ ONLY se cargó su libro mediante
`loadCustomerCreditLedger` y se comparó `projectCreditLedger` con una copia en
memoria en la que se desactivaba el veto. No se guardó esa copia.

Salida textual:

```json
{
  "solo_lectura": true,
  "simulacion_solo_en_memoria": true,
  "clientes_analizados": 2,
  "notas_historicas_marcadas": 2,
  "notas_cuyo_saldo_se_reduciria": 2,
  "notas_que_quedarian_pagadas": 0,
  "casos_conocidos": [
    {
      "cliente_id": 6,
      "movimiento_id": 43,
      "ticket_id": 104,
      "saldo_actual": "15750.00",
      "saldo_simulado_sin_veto": "5750.00"
    },
    {
      "cliente_id": 7,
      "movimiento_id": 44,
      "ticket_id": 105,
      "saldo_actual": "22022.00",
      "saldo_simulado_sin_veto": "7022.00"
    }
  ]
}
```

Estos saldos históricos quedan protegidos: la simulación no autoriza limpiar
marcas ni redistribuir movimientos existentes. Su corrección financiera exige
la aprobación separada del Bloque 4.