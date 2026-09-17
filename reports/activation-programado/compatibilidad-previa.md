# Activación de PROGRAMADO — comprobación previa de compatibilidad

La revisión se completó **antes de editar `activarRollo`**.

## Resultado de la compuerta

No se encontró un flujo legítimo actual que dependa de activar desde BAJA,
VENDIDO, EN_TRANSITO, DISPONIBLE o MOSTRADOR.

- Único llamador operativo encontrado: el handler de
  `POST /inventario/rollos/:id/activar` en
  `artifacts/api-server/src/routes/inventario.ts`.
- El cliente generado declara `activarRollo` y `useActivarRollo`, pero no se
  encontró un consumidor escrito a mano en el frontend.
- No se encontraron otros llamadores operativos en scripts o servicios.
- Las llamadas existentes de prueba en `inventario.test.ts` parten de
  PROGRAMADO: T-12 (activación correcta), T-20B (rechazo por costo inválido)
  y T-BOLSA (rechazo de cantidad fraccionaria).
- El contrato OpenAPI y la documentación de permisos describen la recepción
  de PROGRAMADO. Los retornos legítimos desde BAJA, VENDIDO y EN_TRANSITO
  tienen vías separadas de reverso, reactivación y recepción/cancelación
  documental.

El código anterior **sí aceptaba BAJA, VENDIDO y EN_TRANSITO**, porque solo
consultaba la tabla general de transiciones a DISPONIBLE. El comentario
PROGRAMADO → DISPONIBLE no era una validación.

## Compatibilidad preservada

Un reintento con el mismo UUID de una activación ya completada devuelve el
resultado previo antes de intentar otra transición. No depende de admitir
un nuevo origen DISPONIBLE: no crea otra recepción. Se conserva esa
idempotencia y se cubre con una prueba específica.

Las condiciones previas de costo, unidad/cantidad, existencia del rollo y
autorización del endpoint se conservan para una activación PROGRAMADO.
No se cambia el orden ni el alcance de los candados.

## Límites

La revisión es de código del workspace y documentos del proyecto; no
certifica la ausencia de clientes externos no registrados aquí.
No se consultó ni modificó la base, ni se crearon usuarios o sesiones.
Las pruebas de integración antiguas que escriben datos no se ejecutaron:
se leyeron sus precondiciones, y la nueva cobertura usa el motor real con
dobles de transacción en memoria.