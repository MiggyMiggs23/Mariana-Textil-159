# Verificación de navegador — Bloque 4

**Resultado: aprobado para Historial de Abonos y Ver Reparto de ambas notas.**

Aplicación real y datos reales después de las cuatro operaciones autorizadas.
Se reutilizó la sesión operativa, sin crear usuarios ni sesiones de prueba.
El navegador bloqueó POST/PUT/PATCH/DELETE: cero solicitudes mutadoras.

## Salida textual de la comprobación

```text
/tickets/104 — nota 1004
Historial de Abonos (1)
Importe aplicado: $10,000.00
Estado: ABONO PARCIAL
Saldo pendiente: $5,750.00
Ver Reparto: apertura correcta
Nota de destino: #1004
Saldo: $15,750.00 → $5,750.00
Aplicado: +$10,000.00

/tickets/105 — nota 1005
Historial de Abonos (1)
Importe aplicado: $15,000.00
Estado: ABONO PARCIAL
Saldo pendiente: $7,022.00
Ver Reparto: apertura correcta
Nota de destino: #1005
Saldo: $22,022.00 → $7,022.00
Aplicado: +$15,000.00

Ambos diálogos cerrados después de verificar.
No fixtures. No nuevos logins. No modificaciones de código/workflows.
```

Se examinaron las capturas reales de ambos diálogos. Esta comprobación no
reabre ni acredita la matriz de PDF/XLSX ni la validación anterior de los
cuatro estados a 402 px.