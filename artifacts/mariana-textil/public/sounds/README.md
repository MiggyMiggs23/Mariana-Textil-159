# Notification sounds

| Event | Sound file |
| --- | --- |
| New bell notification (including `AVISO` and `SOLICITUD`) | `aviso.ogg` |
| New `ALERTA` | `alerta.ogg` |
| Confirmed registered payment (`requestAppSound("PAGO", stableEventId)`) | `solicitud.ogg` |

Enabling sound is silent. Playback requires the user's enabled preference, browser audio permission, and an exclusive Web Lock. Route changes, reload baselines, updates to existing notification IDs, and feed refetches do not play sounds.