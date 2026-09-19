import fs from "node:fs";
import path from "node:path";

const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg) {
  throw new Error("usage: node prepare-isolated-copy.mjs SOURCE TARGET");
}

const source = fs.realpathSync(sourceArg);
const target = fs.realpathSync(targetArg);
if (!target.startsWith("/tmp/")) {
  throw new Error("isolated target must be under /tmp");
}

const packageFiles = [
  "package.json",
  "scripts/package.json",
  ...["artifacts", "lib"].flatMap((parent) => {
    const root = path.join(target, parent);
    if (!fs.existsSync(root)) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, "package.json")))
      .map((entry) => `${parent}/${entry.name}/package.json`);
  }),
  ...(fs.existsSync(path.join(target, "lib/integrations"))
    ? fs.readdirSync(path.join(target, "lib/integrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() &&
        fs.existsSync(path.join(target, "lib/integrations", entry.name, "package.json")))
      .map((entry) => `lib/integrations/${entry.name}/package.json`)
    : []),
];

const internal = new Map();
for (const file of packageFiles) {
  const archived = fs.readFileSync(path.join(target, file));
  const activePath = path.join(source, file);
  if (!fs.existsSync(activePath) || !archived.equals(fs.readFileSync(activePath))) {
    throw new Error(`dependency manifest differs from installed workspace: ${file}`);
  }
  const pkg = JSON.parse(archived);
  if (pkg.name) internal.set(pkg.name, path.dirname(file));
}

for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "scripts/src/typecheck-runner.mjs"]) {
  const archived = fs.readFileSync(path.join(target, file));
  const active = fs.readFileSync(path.join(source, file));
  if (!archived.equals(active)) {
    throw new Error(`toolchain input differs from installed workspace: ${file}`);
  }
}

const links = [];
function shareModules(fromDirectory, toDirectory) {
  fs.mkdirSync(toDirectory, { recursive: true });
  for (const entry of fs.readdirSync(fromDirectory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(fromDirectory, entry.name);
    const to = path.join(toDirectory, entry.name);
    if (entry.isDirectory() && entry.name.startsWith("@")) {
      shareModules(from, to);
      continue;
    }
    const resolved = fs.realpathSync(from);
    let destination = resolved;
    if (resolved.startsWith(`${source}/`) && !resolved.startsWith(`${source}/node_modules/`)) {
      destination = path.join(target, path.relative(source, resolved));
      if (!fs.existsSync(destination)) {
        throw new Error(`missing same-revision workspace dependency: ${destination}`);
      }
    }
    fs.symlinkSync(destination, to, fs.statSync(from).isDirectory() ? "dir" : "file");
    links.push({ from: to, to: destination });
  }
}

for (const file of packageFiles) {
  const relativeDirectory = path.dirname(file);
  const activeModules = path.join(source, relativeDirectory, "node_modules");
  const isolatedModules = path.join(target, relativeDirectory, "node_modules");
  if (fs.existsSync(activeModules)) shareModules(activeModules, isolatedModules);

  const pkg = JSON.parse(fs.readFileSync(path.join(target, file)));
  const dependencies = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
  };
  for (const [name, version] of Object.entries(dependencies)) {
    if (!String(version).startsWith("workspace:")) continue;
    const internalDirectory = internal.get(name);
    if (!internalDirectory) throw new Error(`unknown workspace dependency: ${name}`);
    const link = path.join(isolatedModules, name);
    const destination = path.join(target, internalDirectory);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(destination, link, "dir");
    links.push({ from: link, to: destination });
  }
}

fs.mkdirSync(path.join(target, "node_modules/.bin"), { recursive: true });
const compiler = fs.realpathSync(path.join(source, "node_modules/typescript/bin/tsc"));
fs.symlinkSync(compiler, path.join(target, "node_modules/.bin/tsc"));

const invalidInternalLinks = links.filter(({ to }) =>
  to.startsWith(`${source}/`) && !to.startsWith(`${source}/node_modules/`));
if (invalidInternalLinks.length) {
  throw new Error(`workspace links escaped isolated copy: ${JSON.stringify(invalidInternalLinks)}`);
}

console.log(JSON.stringify({
  source,
  target,
  packageFiles,
  internalPackages: [...internal.entries()].map(([name, directory]) => ({ name, directory })),
  links,
  invalidInternalLinks,
}, null, 2));