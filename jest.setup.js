import "@testing-library/jest-dom";

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
