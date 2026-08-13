import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "node:util";

// jsdom ships no TextEncoder/TextDecoder, and react-router-dom v7 reaches for
// TextEncoder at import time — so merely importing <MemoryRouter> in a test threw
// "TextEncoder is not defined" before the test body ran, which reads as a broken
// test rather than a missing global. Node has both; hand them over.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder;
}

// jsdom implements neither of these, and a component that uses one throws on
// mount rather than failing an assertion — which makes the real failure
// unreadable. Stubbed here rather than per-test file so any component using
// infinite scroll or a resize observer is testable at all.
//
// Deliberately inert: they record nothing and fire no callbacks. A test that
// needs scroll behaviour should drive it explicitly rather than rely on a stub
// pretending to observe.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
