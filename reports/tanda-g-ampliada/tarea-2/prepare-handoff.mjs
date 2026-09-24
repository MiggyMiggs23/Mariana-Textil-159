import fs from "node:fs";
const root = process.cwd(), local = root + "/.local/tanda-g-ampliada";
const worker = JSON.parse(fs.readFileSync(local + "/worker-databases.json", "utf8")).inventory;
const build = JSON.parse(fs.readFileSync("reports/tanda-g-ampliada/setup/build-identity.json", "utf8"));
const config = {
  databaseName: "tanda_ga_inventory", databaseUrl: worker.url,
  dataDirectory: local + "/cluster", sourceRoot: local + "/frozen-source",
  sourceIdentity: "currentsource61d-strict", frozenCommit: build.commit,
  sourceArchiveSha256: build.sourceArchiveSha256, apiSha256: build.apiSha256,
  fixtureManifest: root + "/reports/tanda-g-ampliada/setup/fixture-manifest-redacted.json",
  apiOrigin: "http://127.0.0.1:43852",
  apiPid: Number(fs.readFileSync(local + "/inventory-api.pid", "utf8")),
  apiModule: local + "/frozen-source/artifacts/api-server/dist/index.mjs",
  credentialsFile: local + "/credentials.json",
};
fs.writeFileSync(local + "/inventory-handoff.json", JSON.stringify(config), { mode: 0o600 });
console.log("Private inventory handoff prepared; no credentials printed.");