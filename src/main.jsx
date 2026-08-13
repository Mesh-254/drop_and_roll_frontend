import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { fetchParcelLimits } from "./utils/parcelValidation";
import { initTheme } from "./utils/theme";

// Before render, so React's first paint agrees with the class index.html set.
initTheme();

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
