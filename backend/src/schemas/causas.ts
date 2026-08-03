export const rutParamsSchema = {
  type: "object",
  required: ["rut"],
  additionalProperties: false,
  properties: {
    rut: { type: "string", minLength: 2, maxLength: 32 },
  },
} as const;

export const paidQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: { type: "integer", minimum: 1, maximum: 500 },
    offset: { type: "integer", minimum: 0 },
    participacion: { type: "string", enum: ["ambas", "demandante", "demandado"] },
    competencia: { type: "string", enum: ["laboral", "civil", "cobranza", "penal"] },
    estado: { type: "string", minLength: 1, maxLength: 32 },
    tipo_causa: { type: "string", enum: ["O", "M", "E", "I"] },
    tribunal_id: { type: "string", minLength: 1, maxLength: 64 },
    q: { type: "string", minLength: 1, maxLength: 200 },
    fecha_desde: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    fecha_hasta: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    include_abogados: { type: "string", enum: ["true", "false"] },
  },
} as const;

export const apiKeyHeadersSchema = {
  type: "object",
  properties: {
    "x-api-key": { type: "string", minLength: 8, maxLength: 200 },
  },
} as const;

export const errorResponseSchema = {
  type: "object",
  additionalProperties: true,
  required: ["error"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    details: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          field: { type: "string" },
          keyword: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

export type PaidQuery = {
  limit?: number;
  offset?: number;
  participacion?: "ambas" | "demandante" | "demandado";
  competencia?: "laboral" | "civil" | "cobranza" | "penal";
  estado?: string;
  tipo_causa?: "O" | "M" | "E" | "I";
  tribunal_id?: string;
  q?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  include_abogados?: "true" | "false";
};
