/* eslint-env jest */
// §6: the header must be visible (solid background) from first paint on every
// interior route, and only transparent over the landing hero at the top of the
// page. Regression guard for "header invisible on /bulk-upload until you scroll".

import { render } from "@testing-library/react";

// react-router v7 needs TextEncoder in jsdom; existing tests avoid it by
// mocking the module. We do the same and drive pathname via a mutable holder.
const mockLocation = { pathname: "/" };
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: mockLocation.pathname }),
  NavLink: ({ children }) => children,
}));

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));
jest.mock("../../contexts/AuthModalContext", () => ({
  useAuthModal: () => ({ openLogin: jest.fn(), openRegister: jest.fn() }),
}));
jest.mock("../track/TrackParcelModal", () => () => null);
jest.mock("../quote/GetQuoteBook", () => () => null);
jest.mock("../profile/ProfileDropdown", () => () => null);
jest.mock("lucide-react", () => new Proxy({}, { get: () => () => null }));

import Header from "./Header";
// Header now hosts the theme toggle and registers it with ThemeContext, so it
// needs the real provider. Not mocked: the registration is a genuine part of
// mounting a Header, and a stub would hide it breaking.
import { ThemeProvider } from "../../contexts/ThemeContext";

function renderAt(path) {
  mockLocation.pathname = path;
  const { container } = render(
    <ThemeProvider>
      <Header />
    </ThemeProvider>,
  );
  return container.querySelector("header");
}

test("landing route ('/') starts transparent (over the dark hero)", () => {
  const header = renderAt("/");
  expect(header.className).toMatch(/bg-transparent/);
  expect(header.className).not.toMatch(/bg-black/);
});

test("interior route renders a solid, visible header from first paint", () => {
  const header = renderAt("/bulk-upload/abc123");
  expect(header.className).toMatch(/bg-black/);
  expect(header.className).not.toMatch(/bg-transparent/);
});

test("another interior route (invoice) is solid too", () => {
  const header = renderAt("/invoices/xyz");
  expect(header.className).toMatch(/bg-black/);
});
