import {
  createUserBodyNombreMax,
  createUserBodyNombreMin,
  createUserBodyPasswordMax,
  createUserBodyPasswordMin,
  createUserBodyUsuarioMax,
  createUserBodyUsuarioMin,
  updateUserBodyNombreMax,
  updateUserBodyNombreMin,
  updateUserBodyPasswordMax,
  updateUserBodyPasswordMin,
  updateUserBodyUsuarioMax,
  updateUserBodyUsuarioMin,
} from "@workspace/api-zod";

type UserField = "nombre" | "usuario" | "password";
type UserValidationIssue = {
  code: string;
  path: readonly PropertyKey[];
};

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  usuario: "Usuario",
  password: "Contraseña",
  rol: "Rol",
  ubicacionId: "Sitio",
  alcanceConsulta: "Alcance de consulta",
  activo: "Estado",
};

const STRING_LIMITS: Record<
  "create" | "update",
  Record<UserField, { min: number; max: number }>
> = {
  create: {
    nombre: {
      min: createUserBodyNombreMin,
      max: createUserBodyNombreMax,
    },
    usuario: {
      min: createUserBodyUsuarioMin,
      max: createUserBodyUsuarioMax,
    },
    password: {
      min: createUserBodyPasswordMin,
      max: createUserBodyPasswordMax,
    },
  },
  update: {
    nombre: {
      min: updateUserBodyNombreMin,
      max: updateUserBodyNombreMax,
    },
    usuario: {
      min: updateUserBodyUsuarioMin,
      max: updateUserBodyUsuarioMax,
    },
    password: {
      min: updateUserBodyPasswordMin,
      max: updateUserBodyPasswordMax,
    },
  },
};

function isUserField(field: string): field is UserField {
  return field === "nombre" || field === "usuario" || field === "password";
}

export function formatUserValidationErrors(
  issues: readonly UserValidationIssue[],
  body: unknown,
  mode: "create" | "update",
): string {
  const input =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  return issues
    .map((issue) => {
      const field = String(issue.path[0] ?? "");
      const label = FIELD_LABELS[field] ?? "Campo";

      if (isUserField(field) && issue.code === "too_small") {
        const { min } = STRING_LIMITS[mode][field];
        const value = input[field];
        const length = typeof value === "string" ? value.length : 0;
        const missing = Math.max(1, min - length);
        return `${label}: mínimo ${min} caracteres; faltan ${missing}.`;
      }
      if (isUserField(field) && issue.code === "too_big") {
        return `${label}: máximo ${STRING_LIMITS[mode][field].max} caracteres.`;
      }
      if (issue.code === "invalid_type") {
        return `${label}: es obligatorio y debe tener el formato correcto.`;
      }
      if (issue.code === "invalid_value") {
        return `${label}: selecciona una opción válida.`;
      }
      return `${label}: revisa el valor capturado.`;
    })
    .join(" ");
}