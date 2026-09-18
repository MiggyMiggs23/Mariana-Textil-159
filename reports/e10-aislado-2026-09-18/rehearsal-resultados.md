# E10 — ensayo PostgreSQL + HTTP aislado

- Estado: **PASS**
- Salida terminal: **0**
- Total: **2409.533 ms**
- DDL: **2661.091 ms**
- Destino: socket Unix fijado; base `e10_ensayo_20260918`; TCP PostgreSQL deshabilitado.
- Frontera auth: AuthContext en proceso sólo en el arnés; no login, renovación, usuario ni sesión.
- Retención: copia y fixtures conservados; sin limpieza DELETE.

| Grupo | ms monotónicos | aserciones |
|---|---:|---:|
| authorization-and-validation | 99.766 | 134 |
| ledger-idempotency-and-inverse | 105.807 | 22 |
| arqueo-persistence-stale-and-replay | 98.365 | 11 |
| mixed-writes-and-race-inverse | 45.722 | 3 |
| sql-immutability-and-fixed-location | 61.515 | 11 |
| exports-and-confidential-audit-readers | 404.020 | 18 |
| canonical-financial-readers-after-each-fondo-write | 751.096 | 8 |
| negative-balance-and-insufficient-withdrawal | 40.605 | 4 |

El JSON adjunto contiene hashes, conteos, identidad efectiva, conciliación y evidencia por caso.
