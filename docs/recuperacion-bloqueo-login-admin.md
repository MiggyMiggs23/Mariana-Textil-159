# Recuperación conservadora de bloqueo de inicio de sesión ADMIN

El bloqueo de inicio de sesión conserva la auditoría como evidencia inmutable. **Nunca elimine ni edite registros de auditoría o de la base de datos para recuperar el acceso.**

## Bloqueo de una sola IP de origen

Después de cinco fallos recientes para el mismo usuario desde una IP, solamente esa fuente queda bloqueada. Para recuperar acceso ADMIN:

1. Confirme que la solicitud es legítima.
2. Cambie a otra IP confiable y administrada (por ejemplo, otra salida corporativa o VPN aprobada).
3. Inicie sesión con las credenciales correctas. El éxito cierra la ventana de fallos anterior para comprobaciones futuras.

No cambie a una red pública ni permita que el cliente envíe manualmente `X-Forwarded-For`.

## Bloqueo global temporal del usuario

Quince fallos recientes para el mismo usuario, acumulados entre distintas IP, activan el bloqueo global. Espere 15 minutos sin nuevos intentos y vuelva a iniciar sesión desde una IP confiable.

Si el bloqueo reaparece, detenga los intentos y escale el incidente para investigar credenciales comprometidas o clientes mal configurados. No intente desbloquear modificando la auditoría, usuarios, sesiones ni otros datos directamente.