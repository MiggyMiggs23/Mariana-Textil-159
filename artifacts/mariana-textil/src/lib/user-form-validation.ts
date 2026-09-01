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

export const CREATE_USER_FIELD_LIMITS = {
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
} as const;

export const UPDATE_USER_FIELD_LIMITS = {
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
} as const;

export type UserFormField = keyof typeof CREATE_USER_FIELD_LIMITS;
export type UserFormErrors = Partial<Record<UserFormField, string>>;

function validateLength(
  label: string,
  value: string,
  limits: { min: number; max: number },
): string | undefined {
  if (value.length < limits.min) {
    return `${label}: mínimo ${limits.min} caracteres; faltan ${limits.min - value.length}.`;
  }
  if (value.length > limits.max) {
    return `${label}: máximo ${limits.max} caracteres.`;
  }
  return undefined;
}

export function validateUserForm(
  values: { nombre: string; usuario: string; password: string },
  mode: "create" | "update",
): UserFormErrors {
  const limits =
    mode === "create"
      ? CREATE_USER_FIELD_LIMITS
      : UPDATE_USER_FIELD_LIMITS;
  const errors: UserFormErrors = {};
  errors.nombre = validateLength(
    "Nombre",
    values.nombre,
    limits.nombre,
  );
  errors.usuario = validateLength(
    "Usuario",
    values.usuario,
    limits.usuario,
  );
  if (mode === "create" || values.password.length > 0) {
    errors.password = validateLength(
      "Contraseña",
      values.password,
      limits.password,
    );
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  ) as UserFormErrors;
}