import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { STORAGE_KEY, THEMES } from "../utils/theme";

function Probe() {
  const { theme, isDark, toggleTheme, setTheme, hasHeaderToggle } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <span data-testid="has-header">{String(hasHeaderToggle)}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme(THEMES.DARK)}>go dark</button>
    </div>
  );
}

/** Stands in for Header: announces a header-mounted toggle while it is on screen. */
function FakeHeader() {
  const { registerHeaderToggle } = useTheme();
  useEffect(() => registerHeaderToggle(), [registerHeaderToggle]);
  return <div>header</div>;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeProvider", () => {
  it("starts light with nothing stored", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("is-dark")).toHaveTextContent("false");
  });

  it("starts from the stored preference", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("toggleTheme flips the theme, the class and storage", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme applies a specific theme", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "go dark" }));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("reports no header toggle by default", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("has-header")).toHaveTextContent("false");
  });

  it("reports a header toggle once a Header registers", () => {
    render(
      <ThemeProvider>
        <FakeHeader />
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("has-header")).toHaveTextContent("true");
  });

  it("reports none again after the Header unmounts", () => {
    const { rerender } = render(
      <ThemeProvider>
        <FakeHeader />
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("has-header")).toHaveTextContent("true");
    rerender(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("has-header")).toHaveTextContent("false");
  });

  it("follows a change made in another tab", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }),
      );
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("throws a useful error when used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});
