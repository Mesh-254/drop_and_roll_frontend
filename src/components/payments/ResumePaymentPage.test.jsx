// Behaviour tests for the reminder-email resume page ownership gate (§1/§2).
//   • payable            → routes into /pay/:txId pre-hydrated (unchanged path);
//   • auth_required (out) → redirects to /login?next=<this resume url>;
//   • forbidden_owner     → shows "belongs to a different account" + masked hint;
//   • guest link          → stays frictionless (payable, no login bounce).

import { render, screen, waitFor } from "@testing-library/react";

const mockNavigate = jest.fn();
let mockPathname = "/pay/resume/abc-token";
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ resumeToken: "abc-token" }),
  useLocation: () => ({ pathname: mockPathname }),
}));

const mockResumeBooking = jest.fn();
jest.mock("../../api/BookingApi", () => ({
  __esModule: true,
  default: { resumeBooking: (...a) => mockResumeBooking(...a) },
}));

let mockIsAuthenticated = false;
jest.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

import ResumePaymentPage from "./ResumePaymentPage";

beforeEach(() => {
  mockNavigate.mockClear();
  mockResumeBooking.mockReset();
  mockIsAuthenticated = false;
  mockPathname = "/pay/resume/abc-token";
});

test("payable state routes straight into the payment page", async () => {
  mockResumeBooking.mockResolvedValue({
    success: true,
    data: { state: "payable", transaction: { id: "tx-123" }, guest_email: "g@e.com" },
  });
  render(<ResumePaymentPage />);
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      "/pay/tx-123",
      expect.objectContaining({ replace: true }),
    ),
  );
});

test("auth_required while logged out redirects to login with next=", async () => {
  mockIsAuthenticated = false;
  mockResumeBooking.mockResolvedValue({
    success: true,
    data: { state: "auth_required", booking_id: "b-1" },
  });
  render(<ResumePaymentPage />);
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      "/login?next=%2Fpay%2Fresume%2Fabc-token",
      { replace: true },
    ),
  );
});

test("forbidden_owner shows the different-account state with masked hint", async () => {
  mockIsAuthenticated = true;
  mockResumeBooking.mockResolvedValue({
    success: true,
    data: { state: "forbidden_owner", booking_id: "b-1", owner_hint: "j••••n@gmail.com" },
  });
  render(<ResumePaymentPage />);
  expect(
    await screen.findByRole("heading", { name: /different account/i }),
  ).toBeInTheDocument();
  expect(screen.getByText(/j••••n@gmail.com/)).toBeInTheDocument();
  // never bounced to login automatically
  expect(mockNavigate).not.toHaveBeenCalledWith(
    expect.stringContaining("/login"),
    expect.anything(),
  );
});

test("guest link stays frictionless (payable, no login bounce)", async () => {
  mockIsAuthenticated = false;
  mockResumeBooking.mockResolvedValue({
    success: true,
    data: { state: "payable", transaction: { id: "tx-guest" }, guest_email: "g@e.com" },
  });
  render(<ResumePaymentPage />);
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/pay/tx-guest", expect.anything()));
  expect(mockNavigate).not.toHaveBeenCalledWith(
    expect.stringContaining("/login"),
    expect.anything(),
  );
});
