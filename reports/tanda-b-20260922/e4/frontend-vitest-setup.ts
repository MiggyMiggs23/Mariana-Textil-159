import { createRequire } from "node:module";
// Threads must install the same guard even if a Vitest version clears execArgv.
const require = createRequire(import.meta.url);
require(`${process.env.E4_SANDBOX}/guard.cjs`);
if (!(globalThis as any).__E4_OFFLINE_GUARD__) throw Error("E4_OFFLINE_GUARD_MISSING");
globalThis.fetch = (() => { throw Error("E4_OFFLINE_ACCESS_BLOCKED"); }) as typeof fetch;
// jsdom lacks these browser DOM APIs; no production components are substituted.
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = function () {};
if (!HTMLElement.prototype.hasPointerCapture) HTMLElement.prototype.hasPointerCapture = () => false;
if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = function () {};
if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = function () {};