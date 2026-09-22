# Expectativas B0/B1 regeneradas — 2026-09-22

Preparación completada; **no se ejecutó la liberación de fase B**.

- Autorización ampliada guardada literalmente antes de cualquier otra escritura.
- Catálogo nuevo de la conexión efectiva de la API en REPEATABLE READ READ ONLY,
  con default_transaction_read_only=on y ROLLBACK. Coincide íntegramente con el
  diagnóstico aceptado: ninguna diferencia adicional.
- B0 reconstruido vacío e idéntico al catálogo real antes de A+C.
- B1 obtenido solo con el SQL A+C aprobado. Enums completos y trigger ALWAYS
  preservados. Comparación completa con B1 histórico: solo las diez diferencias
  aceptadas de B0, sin cambios adicionales.
- Preflight: **24/24 PASS**, incluidos CLI real, symlink, rechazos negativos,
  restauraciones y postflight SQL. Instancia PostgreSQL detenida y eliminada.
- Wrapper actualizado: **9/9 PASS**. Además, copia exacta del wrapper final
  rechazó un inventario alterado con exit 1, etapa release_hash_before,
  preflight not_run y api_exec_attempted=false. No arrancó una API.
- La primera ejecución de las nueve pruebas pasó, pero el lector del resultado
  esperaba TAP y Node emitió su formato predeterminado. Se conservó esa salida y
  se repitió con TAP explícito; no se cambió ninguna prueba ni lógica del wrapper.
- Inventario: cambió únicamente la entrada de release-expected.json.
  Wrapper: cambió únicamente el hash literal del inventario.
- Bundle activo y candidato, SQL, preflight y workflow conservados.
  Mismo proceso API, sin reinicios. Ningún SQL de escritura en la base real.
- Las evidencias de arranque previas del manifiesto son HISTÓRICAS: no son
  nuevos ensayos del paquete regenerado. No se repitió ningún arranque.
- El bloqueo descrito en bloqueo-wrapper.md es histórico y quedó resuelto por
  autorizacion-ampliada-del-propietario.txt.

## Hashes vigentes

| Archivo / catálogo | SHA-256 |
| --- | --- |
| B0 esquema | 37f6af5a2e06748a8499b995caeec072770090c36f2ad741d35c65953421bec8 |
| B0 atributos | c08c02eae60d61c611ff4ce3cb5854a4cb117a7a015ee8d50a0618eb4264626b |
| B1 esquema | 89c445d53c3db7d8cb3a45bdab49f82acb12943d62084eced21ab3af5cf5a358 |
| B1 atributos | 597213c727c1b825a480720b0484badf26c17a02309fba8cd57d72af0e7a7665 |
| release-expected.json | dc6df26888aae04eee23ffe24afc2edeb8c9eb4d8b8470c896c33f10cdba02de |
| release-assets.sha256 | 9bd719c5faea69c903d53cdbed306fbf65d8763140a616f34c791d514e85a230 |
| api-start-audit.sh | 48f1f785121778352ddcf71301901f1287c1496c37c4078b92794d62df681654 |

El manifiesto final y su sidecar están en reports/e2-paquete-liberacion-preparado-20260921/.
El inventario package-integrity.sha256 incluye el texto final y estas evidencias
sin dependencia circular. Las pruebas originales no se editaron.
El texto para pegar se entrega en fase-b-20260922.txt y en
reports/e2-paquete-liberacion-preparado-20260921/09-fase-b-texto.md.
