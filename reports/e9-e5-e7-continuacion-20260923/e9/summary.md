# E9 — corrección y ensayo aislado

El `22P02` provenía de
`d->'investigacion'-ARRAY['estado','cierre']`. Por precedencia de operadores,
PostgreSQL intentaba usar el texto exacto `investigacion` como JSONB; el error
anterior lo confirmó con `Token "investigacion" is invalid`. La operación
esperada era quitar las claves `estado` y `cierre` del objeto JSONB
`detail.investigacion`.

Se corrigió a
`((d->'investigacion')-ARRAY['estado','cierre'])`, también en el valor anterior.
El ensayo con productor real en PostgreSQL desechable terminó con
`E9_DISPOSABLE_PG_PASS` y `E9_DISPOSABLE_CLUSTER_DESTROYED_PASS`.

La prueba cubrió ambas diferencias, investigación/cierre, replay, rol forjado,
alcance entre sitios, rollback por fallo de auditoría, corte inalterado y cero
filas o enlaces Fondo. Los gates E9 API/UI quedaron ON; el gate de ingreso al
Fondo permanece OFF.

Después del PASS aislado, el operador autorizado aplicó únicamente la función
corregida a la base efectiva de la API: `BEGIN / SET / DO / CREATE FUNCTION /
COMMIT`. Las tablas E9 y Fondo conservaron conteos y huellas (cero filas);
`live-status.json` registra `sqlApplied=true` y `committed=true`.