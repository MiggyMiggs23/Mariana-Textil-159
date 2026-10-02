---
name: Evidencia histórica de recibos
description: Criterio acordado para emitir recibos de movimientos anteriores sin reconstruir saldos.
---

Permitir recibos históricos únicamente con evidencia guardada completa. Si falta información, bloquear la emisión explicando cada dato ausente; nunca suplirlo con saldos actuales, asumir cero ni reconstruir aplicaciones.

**Why:** El usuario confirmó que prefiere conocer el tamaño y los motivos de la insuficiencia antes de decidir cualquier recuperación. Tener una aplicación guardada no demuestra que estén conservados el remanente y el saldo total inmediatamente posteriores.

**How to apply:** Separar los conteos de aplicaciones completas de los de evidencia suficiente para el recibo. Revisar la auditoría además de las tablas de aplicaciones, incluidas las columnas dedicadas de sitio. No contar la ausencia del nuevo folio de recibo como evidencia financiera perdida: se asigna en la emisión. Con auditoría retenida después de purgas, validar la identidad y fecha del movimiento, no solo el ID potencialmente reutilizado.

**Autorización documental E3/E5 (activada 02/10/2026):** `recibos_abonos.ver` permite descubrir/consultar/imprimir; defaults ADMIN+TERMINAL, preservando overrides y demás módulos. No ADMIN queda limitado al sitio asignado incluso con TODAS; sin sitio denegar. E5 exige recibo original de recepción CAJA, no constancia financiera. No concede recepción/aplicación/autorización monetaria ni altera el perímetro E11.

**HTTP y SQL deben concordar:** una lectura HTTP exitosa no demuestra que el INSERT auditado de impresión esté autorizado. En el ensayo se corrigió `e5_insert_authority`, que seguía exigiendo ADMIN para impresiones. Mantener el permiso/sitio/evidencia en ambas capas sin debilitar ninguna rama financiera. Nuevas instalaciones E5/E11 terminan con el instalador canónico explícito `lib/db/src/lib/receipt-print-authority.mjs`; no añadir migraciones financieras ocultas al arranque.

**Evidencia de cierre:** `reports/receipt-terminal-print-20261001/ESTADO.md`. El PASS digital MAIN de `remainder-rjBxgw` complementa dos E3 válidos de un ensayo anterior globalmente fallido; revisión visual parcial aparte. No llamarlo PASS del testing agent ni impresión física. Conservar intentos fallidos, auditoría previa y comparaciones financieras exactas.