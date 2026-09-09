export const TIPOS_EQUIPO = [
  "IMPRESORA_TICKETS",
  "IMPRESORA_ETIQUETAS",
  "COMPUTADORA_POS",
  "PISTOLA_ESCANER",
  "SMARTPHONE_ESCANER",
] as const;

export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

export interface DefinicionTipoEquipo {
  label: string;
  checklist: readonly { key: string; label: string }[];
}

/** Canonical equipment names and setup requirements used by every consumer. */
export const DEFINICIONES_EQUIPO: Readonly<Record<TipoEquipo, DefinicionTipoEquipo>> =
  Object.freeze({
    IMPRESORA_TICKETS: {
      label: "Impresora térmica de tickets",
      checklist: [
        { key: "TICKET_REAL", label: "Instalada y probada con un ticket real" },
        { key: "PAPEL_80MM", label: "Papel de 80 mm cargado" },
      ],
    },
    IMPRESORA_ETIQUETAS: {
      label: "Impresora de etiquetas",
      checklist: [
        { key: "ETIQUETA_REAL", label: "Instalada y probada con una etiqueta real" },
        {
          key: "MEDIDA_100X70",
          label: "Medida de etiqueta 100 × 70 mm configurada",
        },
      ],
    },
    COMPUTADORA_POS: {
      label: "Computadora POS",
      checklist: [
        {
          key: "PAPEL_NAVEGADOR_80MM",
          label:
            "Tamaño de papel del navegador en Roll Paper 80 mm para la impresora de tickets",
        },
        { key: "MARGENES_NINGUNO", label: "Márgenes del navegador en Ninguno" },
        { key: "ESCALA_REAL", label: "Escala en Tamaño real" },
        {
          key: "IMPRESORA_PREDETERMINADA",
          label: "Impresora de tickets predeterminada correcta",
        },
      ],
    },
    PISTOLA_ESCANER: {
      label: "Pistola escáner",
      checklist: [
        { key: "TECLADO_ESPANOL", label: "Configurada a teclado español" },
        {
          key: "QR_ROLLO",
          label: "Probada leyendo un QR de rollo del sistema",
        },
      ],
    },
    SMARTPHONE_ESCANER: {
      label: "Smartphone escáner",
      checklist: [
        {
          key: "SESION_CAMARA",
          label: "Sesión iniciada y permisos de cámara concedidos",
        },
        {
          key: "QR_ROLLO",
          label: "Probado leyendo un QR de rollo del sistema",
        },
      ],
    },
  });

export const CHECKLIST_KEYS_EQUIPO = Object.freeze(
  Array.from(
    new Set(
      TIPOS_EQUIPO.flatMap((tipo) =>
        DEFINICIONES_EQUIPO[tipo].checklist.map((item) => item.key),
      ),
    ),
  ),
);

export function checklistEquipo(tipo: TipoEquipo) {
  return DEFINICIONES_EQUIPO[tipo].checklist;
}

export function esChecklistEquipoValido(tipo: TipoEquipo, key: string): boolean {
  return checklistEquipo(tipo).some((item) => item.key === key);
}