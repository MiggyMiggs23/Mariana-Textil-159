---
name: Recuperación de operaciones inciertas
description: Diferenciar rechazo previo, COMMIT incierto y pérdida de acceso posterior; recuperar sin duplicar ni filtrar datos.
---

Un fallo de reautorización o entrega después del COMMIT no demuestra rollback.
Conservar el UUID original y clasificar explícitamente el resultado confirmado
pero no consultable, separado del COMMIT incierto.

**Why:** La interfaz descartaba una intención ante 403/409 aunque la operación
ya podía estar guardada. Un reintento incierto tampoco adquiere prueba de
no-efecto sólo porque ahora falten permisos.

**How to apply:** Purgar datos privados al revocar acceso, pero conservar
metadatos mínimos de recuperación. No habilitar otra intención por ese error.
Validar respuestas antes del COMMIT cuando sea posible y cubrir por separado
rollback precommit y fallo de entrega postcommit.

Para cerrar administrativamente una intención como «sin efecto», la ausencia
momentánea de registro no basta: sincronizar con el mismo lock y namespace del
productor y reservar permanentemente la clave cancelada antes de desbloquear.

**Why:** Una solicitud original retrasada puede llegar después de la consulta
vacía y ejecutarse junto con la nueva intención.

**How to apply:** Todo productor debe comprobar la cancelación después del
lock y antes de efectos. La resolución debe ser auditada, idempotente y probar
el caso de solicitud original tardía; nunca limpiar una cuarentena por un 404.

## Confirmación durable y desmontaje de componentes

**Why:** La invalidación de consultas puede desmontar el componente que inició
una escritura ya confirmada. Vincular la limpieza durable a `isMounted` deja
una recuperación pendiente falsa y bloquea la siguiente intención.

**How to apply:** Separar actualizaciones React de finalización durable.
Después del ACK correspondiente, invalidación satisfactoria y comprobación
fresca de sesión, la limpieza puede continuar desmontada, pero sólo si siguen
coincidiendo exactamente ámbito, operación, comando/intención persistida y
marcador CONFIRMED de actor/acción/UUID originales. Comparar y borrar sin un
await intermedio; nunca borrar reemplazos, resultados inciertos, cuarentena o
evidencia cuyo refresco/autorización falló. Una marca CONFIRMED cargada del
almacenamiento no sustituye este protocolo ni autoriza limpieza automática.
Probar el hook real montado, desmontándolo durante la invalidación; incluir
rechazo de refresco, revocación/logout y sustitución de intención.