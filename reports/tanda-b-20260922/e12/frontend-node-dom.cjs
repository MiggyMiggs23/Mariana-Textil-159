"use strict";
// Loaded after the offline guard and before any React/testing-library imports.
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/cobros", pretendToBeVisual: true,
  // No resources option, no scripts: jsdom cannot load remote resources.
});
for (const key of ["window", "document", "navigator", "location", "history", "HTMLElement", "HTMLInputElement",
  "HTMLButtonElement", "Element", "Node", "Document", "DocumentFragment",
  "MutationObserver", "Event", "MouseEvent", "KeyboardEvent", "CustomEvent", "PopStateEvent", "HashChangeEvent",
  "HTMLFormElement", "HTMLSelectElement", "SVGElement", "NodeFilter"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key], writable: true });
}
// wouter 3.10.0 uses bare location/history and bare event methods in
// use-browser-location.js (including its pushState/replaceState patch).
// These must share JSDOM's window identity and Event realm.
for (const method of ["addEventListener", "removeEventListener", "dispatchEvent"]) {
  globalThis[method] = dom.window[method].bind(dom.window);
}
// Deliberately do not copy window timers, process, fetch or networking globals.
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
dom.window.PointerEvent = globalThis.PointerEvent;
HTMLElement.prototype.scrollIntoView = function () {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = function () {};
HTMLElement.prototype.releasePointerCapture = function () {};
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
dom.window.ResizeObserver = globalThis.ResizeObserver;
// Keep the guard's fetch; do not install a browser network implementation.
dom.window.fetch = globalThis.fetch;
dom.window.WebSocket = globalThis.WebSocket;
process.once("exit", () => dom.window.close());