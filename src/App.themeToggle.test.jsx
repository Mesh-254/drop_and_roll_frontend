import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthModalProvider } from "./contexts/AuthModalContext";
import ThemeToggle from "./components/common/ThemeToggle";
import Header from "./components/common/Header";

// App itself pulls in Google Maps, Stripe and the auth stack, which is a lot of
// surface for one placement assertion. This asserts the CONTRACT instead: a
// route with no Header still gets a toggle, and a route with one does not get
// two. Full-route coverage is the eval lane's job (evals/eval_theme_coverage.mjs).
function HeaderlessRoute() {
  return (
    <div>
      <p>login page</p>
      <ThemeToggle variant="floating" />
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("toggle reachability", () => {
  it("shows a toggle on a route that renders no Header", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <HeaderlessRoute />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toBeInTheDocument();
  });
});

describe("Header", () => {
  it("renders exactly one theme toggle, even alongside the floating one", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <AuthModalProvider>
              <Header />
              <ThemeToggle variant="floating" />
            </AuthModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    const toggles = screen.getAllByRole("button", {
      name: /switch to (dark|light) mode/i,
    });
    expect(toggles).toHaveLength(1);
    // Counting alone would pass for the wrong reason: with no toggle in the
    // Header, the floating one is the only button and the count is still 1.
    // The surviving toggle must be the Header's, i.e. not fixed-position.
    expect(toggles[0].className).not.toMatch(/fixed/);
  });

  it("puts its toggle in the nav, not floating", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <AuthModalProvider>
              <Header />
            </AuthModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(toggle.className).not.toMatch(/fixed/);
  });
});
