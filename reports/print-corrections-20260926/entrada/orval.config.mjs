export default {
  client: {
    input: "./contract.yaml",
    output: { target: "./generated/client.ts", schemas: "./generated/types", client: "fetch" },
  },
  zod: {
    input: "./contract.yaml",
    output: { target: "./generated/zod.ts", client: "zod" },
  },
};