import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { fetchParcelLimits } from "./utils/parcelValidation";
import { applyAppTheme } from "./utils/theme";

// The app has exactly one theme. This clears any stale "light" preference left
// by the toggle that used to exist, so a user who pressed it is not stranded on
// a half-flipped screen. See utils/theme.js for the measurement.
applyAppTheme();

// Warm the parcel limits cache so Zod schemas use live backend values.
fetchParcelLimits();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
