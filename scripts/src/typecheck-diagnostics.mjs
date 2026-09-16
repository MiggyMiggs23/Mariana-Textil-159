import { relative, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const TS_DIAGNOSTIC_MARKER = /\b(?:error|warning)\s+TS\d+\b/i;

export function diagnosticKey(diagnostic) {
  return [
    diagnostic.file,
    diagnostic.line,
    diagnostic.column,
    diagnostic.code,
    diagnostic.message,
  ].join("\u0000");
}

function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE, "");
}

function normalisePath(file, { cwd, root }) {
  const candidate = file.trim().replaceAll("\\", "/");
  if (!candidate) return "<unknown>";

  const absolute = candidate.startsWith("/")
    ? candidate
    : resolve(cwd, candidate);
  const repositoryRelative = relative(root, absolute).replaceAll(sep, "/");

  if (
    repositoryRelative &&
    repositoryRelative !== ".." &&
    !repositoryRelative.startsWith("../")
  ) {
    return repositoryRelative;
  }
  return candidate;
}

function parseDiagnosticLine(line, { cwd, root }) {
  const parenthesised = line.match(
    /(^|[\s])((?:[A-Za-z]:)?[^()\s]+)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.*)$/i,
  );
  if (parenthesised) {
    return {
      file: normalisePath(parenthesised[2], { cwd, root }),
      line: Number(parenthesised[3]),
      column: Number(parenthesised[4]),
      severity: parenthesised[5].toLowerCase(),
      code: parenthesised[6].toUpperCase(),
      message: parenthesised[7].trim(),
    };
  }

  const colonSeparated = line.match(
    /(^|[\s])((?:[A-Za-z]:)?[^:\s]+(?:[\\/][^:\s]+)*):(\d+):(\d+)\s+-\s+(error|warning)\s+(TS\d+):\s*(.*)$/i,
  );
  if (colonSeparated) {
    return {
      file: normalisePath(colonSeparated[2], { cwd, root }),
      line: Number(colonSeparated[3]),
      column: Number(colonSeparated[4]),
      severity: colonSeparated[5].toLowerCase(),
      code: colonSeparated[6].toUpperCase(),
      message: colonSeparated[7].trim(),
    };
  }

  const global = line.match(
    /(^|[\s])(error|warning)\s+(TS\d+):\s*(.*)$/i,
  );
  if (global) {
    return {
      file: "<global>",
      line: 0,
      column: 0,
      severity: global[2].toLowerCase(),
      code: global[3].toUpperCase(),
      message: global[4].trim(),
    };
  }
  return null;
}

export function parseTypeScriptDiagnostics(output, options = {}) {
  const { cwd = DEFAULT_ROOT, root = DEFAULT_ROOT } = options;
  const diagnostics = [];
  const parserFailures = [];

  for (const rawLine of String(output ?? "").split(/\r?\n/u)) {
    const line = stripAnsi(rawLine).trim();
    if (!line) continue;

    const diagnostic = parseDiagnosticLine(line, { cwd, root });
    if (diagnostic) {
      diagnostics.push(diagnostic);
      continue;
    }
    if (TS_DIAGNOSTIC_MARKER.test(line)) {
      parserFailures.push(`No se pudo interpretar el diagnóstico TypeScript: ${line}`);
    }
  }
  return { diagnostics, parserFailures };
}

export function formatDiagnostic(diagnostic) {
  return `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code}: ${diagnostic.message}`;
}