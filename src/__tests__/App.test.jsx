import { render, screen } from "@testing-library/react";
import App from "../App"; // Adjust path if needed

/* eslint-env jest */
test("renders welcome message", () => {
  render(<App />);
  expect(screen.getByText(/welcome/i)).toBeInTheDocument(); // Assumes "Welcome" in App.jsx
});
