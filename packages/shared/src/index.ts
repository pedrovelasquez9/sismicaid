// Tipos compartidos entre apps/api y apps/web.
// Alineados con docs/SPEC.md (sección 6) y docs/DATABASE.md.
// ponytail: solo enums + DTOs públicos por ahora; el esquema de DB real llega con el ORM en el siguiente slice.

export * from "./enums";
export * from "./dto";
export * from "./enterprise.js";
