---
name: Excepción global del resumen de crédito
description: Política aprobada para separar resumen global de crédito y detalle financiero por sitio.
---

Con los permisos financieros correspondientes, solo deuda actual, saldo a favor, límite y crédito disponible constituyen la excepción global aprobada. Compras, movimientos, pagos, documentos y desgloses se restringen al alcance autorizado en el servidor; conocer un ID o ver al cliente no autoriza sus operaciones de otro sitio.

**Why:** La autorización valida el crédito contra la proyección global. Mostrar una deuda parcial como total produce un disponible falso e induce decisiones equivocadas; entregar el detalle global revela información innecesaria.

**How to apply:** Conservar la proyección FIFO global y restringir las operaciones entregadas sin reconstruir deuda independiente por tienda. Nunca prorratear el límite ni calcular disponible restándole solo deuda local. Identificar siempre el límite como global. Incluir dos leyendas explícitas: el resumen considera todos los sitios; el detalle corresponde solo a los sitios autorizados y no representa la deuda total. Ambas deben viajar dentro de las exportaciones, no solo aparecer en pantalla. La autorización de esta política no permite escrituras de prueba ni ejecutar reimpresiones que registren auditoría.