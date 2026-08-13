import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { ThemeProvider, useTheme } from "../../contexts/ThemeContext";
import { STORAGE_KEY } from "../../utils/theme";

const renderToggle = (props) =>
  render(
    <ThemeProvider>
      <ThemeToggle {...props} />
    </ThemeProvider>,
  );

/** Stands in for Header: a header-mounted toggle that announces itself. */
function FakeHeaderWithToggle() {
  const { registerHeaderToggle } = useTheme();
  useEffect(() => registerHeaderToggle(), [registerHeaderToggle]);
  return <ThemeToggle variant="header" />;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("ThemeToggle", () => {
  it("renders an accessible button", () => {
    renderToggle();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("labels the action, not the state, so the label says where a click goes", () => {
    renderToggle();
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toBeInTheDocument();
  });

  it("updates the label after switching", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button"));
    expect(
      screen.getByRole("button", { name: /switch to light mode/i }),
    ).toBeInTheDocument();
  });

  it("exposes pressed state for assistive tech", async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the theme on click", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("is operable with the keyboard", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await user.keyboard(" ");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("is type=button so it never submits a surrounding form", () => {
    renderToggle();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("has a visible focus ring", () => {
    renderToggle();
    expect(screen.getByRole("button").className).toMatch(/focus-visible:ring/);
  });

  it("marks its icons decorative, so the label is read once", () => {
    const { container } = renderToggle();
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders fixed-position when floating", () => {
    renderToggle({ variant: "floating" });
    expect(screen.getByRole("button").className).toMatch(/fixed/);
  });

  it("is not fixed-position in the header", () => {
    renderToggle({ variant: "header" });
    expect(screen.getByRole("button").className).not.toMatch(/fixed/);
  });

  it("accepts extra classes", () => {
    renderToggle({ className: "ml-4" });
    expect(screen.getByRole("button").className).toMatch(/ml-4/);
  });

  it("hides the floating variant when a header toggle is present", () => {
    render(
      <ThemeProvider>
        <FakeHeaderWithToggle />
        <ThemeToggle variant="floating" />
      </ThemeProvider>,
    );
    // Only the header's toggle survives.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button").className).not.toMatch(/fixed/);
  });

  it("names only tokens, never a raw colour", () => {
    renderToggle();
    expect(screen.getByRole("button").className).not.toMatch(
      /\b(bg|text|border)-(white|black|gray|slate|zinc|orange)-?\d*\b/,
    );
  });
});
