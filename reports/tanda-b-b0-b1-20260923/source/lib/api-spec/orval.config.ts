import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

/**
 * OpenAPI's `date` format is a calendar label, not an instant.  Orval's
 * `useDates` option intentionally maps both `date` and `date-time` to Date,
 * so date-only fields need a distinct schema before the Zod generator sees
 * them.  Keeping this in the input transformer applies the rule to inline
 * schemas and nested response objects as well as component properties.
 */
const calendarDateTransformer: InputTransformerFn = (config) => {
  const transform = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(transform);
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const schema = value as Record<string, unknown>;
    if (schema.format === "date") {
      const description =
        typeof schema.description === "string" ? schema.description : undefined;
      const isNullable =
        Array.isArray(schema.type) && schema.type.includes("null");

      if (isNullable) {
        return {
          oneOf: [
            { $ref: "#/components/schemas/CalendarDate" },
            { type: "null" },
          ],
          ...(description ? { description } : {}),
        };
      }

      return { $ref: "#/components/schemas/CalendarDate" };
    }

    return Object.fromEntries(
      Object.entries(schema).map(([key, child]) => [key, transform(child)]),
    );
  };

  return transform(config) as typeof config;
};

const inputTransformer: InputTransformerFn = (config) =>
  calendarDateTransformer(titleTransformer(config));

export default defineConfig({
  "api-client-react": {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: inputTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: inputTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          version: 3,
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
