import {
  THEMES,
  DEFAULT_THEME,
  STORAGE_KEY,
  getStoredTheme,
  resolveInitialTheme,
  applyTheme,
  initTheme,
  subscribeToThemeChanges,
} from "./theme";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.head.innerHTML = "";
});

describe("getStoredTheme", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredTheme()).toBeNull();
  });

  it("returns a valid stored theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(getStoredTheme()).toBe("dark");
  });

  it("ignores a value that is not a known theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "hot-pink");
    expect(getStoredTheme()).toBeNull();
  });
});

describe("resolveInitialTheme", () => {
  it("defaults to light with nothing stored", () => {
    expect(resolveInitialTheme()).toBe(THEMES.LIGHT);
    expect(DEFAULT_THEME).toBe(THEMES.LIGHT);
  });

  it("prefers a stored theme over the default", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(resolveInitialTheme()).toBe(THEMES.DARK);
  });

  it("does not consult prefers-color-scheme", () => {
    const matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    window.matchMedia = matchMedia;
    resolveInitialTheme();
    expect(matchMedia).not.toHaveBeenCalled();
  });
});

describe("applyTheme", () => {
  it("adds the dark class for dark", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes the dark class for light", () => {
    document.documentElement.classList.add("dark");
    applyTheme(THEMES.LIGHT);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("sets color-scheme so native form controls and scrollbars match", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    applyTheme(THEMES.LIGHT);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("persists by default", () => {
    applyTheme(THEMES.DARK);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("can apply without persisting, for cross-tab echoes", () => {
    applyTheme(THEMES.DARK, { persist: false });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("creates and updates the theme-color meta tag", () => {
    applyTheme(THEMES.DARK);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta).not.toBeNull();
    const darkValue = meta.getAttribute("content");
    applyTheme(THEMES.LIGHT);
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(meta.getAttribute("content")).not.toBe(darkValue);
  });

  it("falls back to the default for an unknown theme", () => {
    expect(applyTheme("hot-pink")).toBe(DEFAULT_THEME);
  });

  it("is idempotent", () => {
    applyTheme(THEMES.DARK);
    applyTheme(THEMES.DARK);
    expect(document.documentElement.className.match(/dark/g)).toHaveLength(1);
  });

  it("adds .theme-transition only when animating, then removes it", () => {
    jest.useFakeTimers();
    applyTheme(THEMES.DARK, { animate: true });
    expect(document.documentElement.classList.contains("theme-transition")).toBe(
      true,
    );
    jest.runAllTimers();
    expect(document.documentElement.classList.contains("theme-transition")).toBe(
      false,
    );
    jest.useRealTimers();
  });

  it("does not animate on the initial application", () => {
    applyTheme(THEMES.DARK);
    expect(document.documentElement.classList.contains("theme-transition")).toBe(
      false,
    );
  });

  it("does not throw when localStorage is unavailable", () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("private mode");
      });
    expect(() => applyTheme(THEMES.DARK)).not.toThrow();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    spy.mockRestore();
  });
});

describe("initTheme", () => {
  it("applies the stored theme and returns it", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    expect(initTheme()).toBe(THEMES.DARK);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("applies light when nothing is stored, without writing a preference", () => {
    expect(initTheme()).toBe(THEMES.LIGHT);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("subscribeToThemeChanges", () => {
  it("applies a theme changed in another tab", () => {
    const seen = [];
    const unsubscribe = subscribeToThemeChanges((t) => seen.push(t));
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }),
    );
    expect(seen).toEqual([THEMES.DARK]);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    unsubscribe();
  });

  it("ignores storage events for other keys", () => {
    const seen = [];
    const unsubscribe = subscribeToThemeChanges((t) => seen.push(t));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "cart", newValue: "dark" }),
    );
    expect(seen).toEqual([]);
    unsubscribe();
  });

  it("stops listening after unsubscribe", () => {
    const seen = [];
    subscribeToThemeChanges((t) => seen.push(t))();
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }),
    );
    expect(seen).toEqual([]);
  });
});
