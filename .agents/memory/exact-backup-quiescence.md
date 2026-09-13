---
name: Referencias exactas de respaldo y arranque
description: Conservar hashes completos exige controlar también escrituras de inicialización y autenticación.
---

Mantener detenidos los escritores entre la captura del respaldo que servirá de referencia exacta y la operación protegida. No reiniciar la API durante ese intervalo.

**Why:** Los inicializadores pueden renovar fechas de configuración aunque sus valores efectivos no cambien. Un reinicio invalidó la igualdad de filas protegidas contra una restauración verificada; ignorar las fechas habría reducido indebidamente la garantía de conservación.

**How to apply:** Ante diferencias, comparar todas las columnas y mantener el bloqueo. Renovar respaldo y restauración si la referencia quedó obsoleta. Separar en la evidencia el estado al commit de la operación y los efectos posteriores del arranque, del evaluador y de un inicio de sesión normal; no afirmar igualdad posterior basándose únicamente en la comprobación anterior.