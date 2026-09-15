# Bloque 4 — detenido antes de la primera operación financiera

## Resultado

El usuario autorizó los dos reversos totales y las dos recapturas exactas,
en ese orden. **No se ejecutó ninguna de las cuatro operaciones.**

La autenticación normal mediante `POST /api/auth/login` con la credencial
configurada respondió **HTTP 401**. No se creó sesión, no se restablecieron
contraseñas, no se crearon usuarios ni se omitieron permisos. El intento de
login puede dejar la auditoría ordinaria de autenticación fallida; no es un
movimiento financiero.

## Instantes verificados en la base real

Base: `heliumdb`. Consultas bajo `REPEATABLE READ READ ONLY`.
Zona de conversión: `America/Mexico_City` (UTC−06:00).
La primera comprobación del reloj dio **15/09/2026 15:07:40.415440** local;
el preflight de ejecución volvió a confirmar el día 15.

| Abono | Recaptura exacta propuesta | Cargo correspondiente | Diferencia en segundos |
|---|---|---|---:|
| 46 — cliente 6 — $10,000 | **15/09/2026 13:35:17.006** | 43 — nota 1004 — 15/09/2026 13:29:34.336084 | **+342.669916** |
| 45 — cliente 7 — $15,000 | **15/09/2026 13:34:10.192** | 44 — nota 1005 — 15/09/2026 13:32:04.605206 | **+125.586794** |

Se compararon los instantes propuestos con `metadata.fechaCaptura`: coinciden
exactamente. No se usó mediodía ni ningún valor por omisión. Se confirmó
EFECTIVO / CAJA_FISICA en ambos originales y veto histórico `true` en ambos
cargos. Los payloads preparados son:

- Abono 46: `fechaEfectiva: "2026-09-15T13:35:17.006-06:00"`.
- Abono 45: `fechaEfectiva: "2026-09-15T13:34:10.192-06:00"`.

Estos payloads **no fueron enviados**.

## Cifras actuales, no resultados de una corrección

| Cliente | Deuda actual | Favor actual | Deuda objetivo todavía no alcanzada |
|---|---:|---:|---:|
| 6 | $15,750.00 | $10,000.00 | $5,750.00 |
| 7 | $22,022.00 | $15,000.00 | $7,022.00 |

Después del 401 se volvió a consultar el libro: siguen solamente los
movimientos 43, 44, 45 y 46 para estos clientes. Se compararon huellas de
las **filas completas** antes y después: las cuatro están intactas.
No hay aplicaciones a los cargos 43 y 44.

- Originales 45 y 46: **14/09/2026 18:00:00**, sin cambios.
- Veto de las notas históricas: sin cambios.
- Historial de Abonos / Ver Reparto: no se acredita un cambio ni comprobación
  visual; las aplicaciones siguen vacías.
- Día 14: conserva los **$25,000** de los originales.
- Día 15: **no se acredita el resultado de las cuatro operaciones**, porque
  ninguna se ejecutó. La compensación de −$25,000 en reversos y +$25,000 en
  recapturas sigue siendo un escenario condicionado a ejecutarlas el día 15.

## Evidencia reproducible

`reports/abonos-bloque4-2026-09-15-evidencia.jsonl` contiene las consultas SQL,
parámetros y salidas textuales de:

1. Fecha local de ejecución.
2. Libro completo de ambos clientes y huellas por fila.
3. Cuatro instantes, diferencias exactas, forma de pago y veto.
4. Saldos canónicos dentro de una transacción de solo lectura.
5. HTTP 401 y lista vacía de IDs financieros confirmados.
6. Comparación final de preservación tras el 401.
7. Aplicaciones finales: lista vacía.

No contiene contraseñas ni cookies. No se modificó código de la aplicación,
no se corrigieron los cuatro errores de tipos ni se ejecutó el Bloque 5.
El ejecutor auxiliar quedó detenido y no se reintentó ningún POST financiero.

Para continuar hace falta una credencial vigente de una cuenta existente
autorizada, proporcionada por el mecanismo seguro de secretos, y volver a
verificar los datos. Si ya no es el día 15 local, detenerse sin escribir.