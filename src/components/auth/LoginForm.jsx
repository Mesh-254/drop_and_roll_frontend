/**
 * LoginForm.jsx
 *
 * The login card — shared by the full-page route (/login deep-link) and the
 * modal. Accepts optional callbacks so the parent can switch views or close
 * without the form needing to know whether it's inside a modal.
 *
 * Google Sign-In root-cause note:
 *   The old LoginPage rendered a plain <button> with a Google SVG icon but
 *   NO onClick handler — GoogleLogin was imported but never rendered.
 *   Fix: render <GoogleLogin> directly. It calls handleGoogleSuccess with a
 *   credentialResponse whose .credential field is the ID token the backend
 *   expects (verified via google.oauth2.id_token.verify_oauth2_token).
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, Zap } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import TurnstileWidget from "./TurnstileWidget";
import { wasSessionExpired, consumeRedirectPath } from "../../lib/authSession";

export default function LoginForm({ onClose, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  // Phase 3, Task 3.4: the Turnstile challenge is invisible until the backend asks for it
  // (CHALLENGE_REQUIRED after repeated failures), then the widget renders and supplies a token.
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const { login, googleAuth, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const firstInputRef = useRef(null);
  // Only true when this form was reached via a session-expiry redirect, so the
  // "your session expired" notice never shows on a normal/first-time login.
  // Captured on mount so it survives the consumeRedirectPath() call on submit.
  const [expiredNotice] = useState(() => wasSessionExpired());

  // Pre-fill email if navigated here with state (e.g. from register or error redirect).
  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
    if (location.state?.fromError) setErrors({ general: location.state.fromError });
  }, [location.state]);

  // Auto-focus first input when mounted (modal open or page load).
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const backendUrl = import.meta.env.VITE_NEXT_PUBLIC_BACKEND_URL;

  const afterLogin = (result) => {
    const userRole = result.data.user?.role;
    if (userRole === "admin") {
      const accessToken = localStorage.getItem("access_token");
      fetch(`${backendUrl}/api/users/auth/admin/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })
        .then((res) => {
          if (res.ok || res.redirected) window.location.href = `${backendUrl}/admin/`;
          else throw new Error("Admin bridge failed");
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to access admin panel. Please try again.");
        });
      return;
    }
    // Redirect-back priority: (1) an expiry-captured route, so the user lands
    // exactly where they were kicked out — not the default dashboard; (2) a
    // router-state `from` (page-route deep-link flow); (3) role default.
    const expiredRedirect = wasSessionExpired() ? consumeRedirectPath() : null;
    const from = location.state?.from?.pathname;
    if (onClose) onClose();
    navigate(expiredRedirect || from || getRedirectPath(userRole), {
      replace: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!email) newErrors.email = "Email is required.";
    if (!password) newErrors.password = "Password is required.";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    try {
      const result = await login(email, password, rememberMe, turnstileToken);
      if (result.success) {
        afterLogin(result);
        return;
      }
      let msg = result.message || "Login failed.";
      let redirect = null;
      if (result.code === "CHALLENGE_REQUIRED") {
        // Phase 3, Task 3.4: surface the widget and ask the user to solve it, then retry.
        setChallengeRequired(true);
        setTurnstileToken("");
        msg = "Please complete the verification challenge below, then try again.";
      } else if (result.code === "EMAIL_NOT_FOUND") {
        msg = `${msg} Redirecting to register...`;
        redirect = () => {
          if (onClose) onClose();
          if (onSwitchToRegister) {
            onSwitchToRegister();
          } else {
            navigate("/register", { state: { email: email.toLowerCase() } });
          }
        };
      } else if (result.code === "ACCOUNT_NOT_ACTIVATED") {
        msg = `${msg} Redirecting to resend confirmation...`;
        redirect = () => {
          if (onClose) onClose();
          navigate("/resend-confirmation");
        };
      } else if (result.code === "ACCOUNT_TEMPORARILY_LOCKED") {
        // Phase 2, Task 2.7: distinct message for lockout vs. wrong credentials. No
        // redirect — the user just waits out the bounded cooloff. Show an approximate
        // wait when the backend sends a retry-after hint.
        const mins = result.retryAfter ? Math.ceil(result.retryAfter / 60) : null;
        msg = mins
          ? `Too many failed attempts. This account is temporarily locked. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`
          : (result.message || "Too many failed attempts. This account is temporarily locked. Try again later.");
      }
      setErrors({ general: msg });
      toast.error(msg);
      if (redirect) setTimeout(redirect, 4000);
    } catch {
      const msg = "Login failed. Please try again.";
      setErrors({ general: msg });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setErrors({});
    try {
      const result = await googleAuth(credentialResponse.credential);
      if (result.success) {
        afterLogin(result);
      } else {
        const msg = result.message || "Google authentication failed.";
        setErrors({ general: msg });
        toast.error(msg);
      }
    } catch {
      const msg = "Google authentication failed. Please try again.";
      setErrors({ general: msg });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    const msg = "Google authentication failed. Please try again.";
    setErrors({ general: msg });
    toast.error(msg);
    setIsLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="backdrop-blur-xl bg-foreground/10 border border-foreground/20 rounded-3xl shadow-2xl p-8 space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-primary/20 border border-primary/30 rounded-full">
          <Zap size={16} className="text-brand-text" />
          <span className="text-xs font-semibold text-brand-text uppercase tracking-wider">
            Drop 'N Roll
          </span>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-1">Welcome back</h2>
        <p className="text-muted-foreground text-sm">Sign in to your account</p>
      </div>

      {/* Session-expiry notice — distinct, non-alarming, and only shown when the
          user was redirected here by an expiry (never on a normal login). Kept
          separate from the red error banner below. */}
      {expiredNotice && !errors.general && (
        <div className="bg-warning/15 border border-warning/40 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-warning text-sm">
            Your session expired — please log in again.
          </p>
        </div>
      )}

      {/* General error */}
      {errors.general && (
        <div className="bg-destructive/20 border border-destructive/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-destructive text-sm">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/60 group-focus-within:text-brand-text w-5 h-5 transition-colors" />
            <input
              ref={firstInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className={`w-full py-3 pl-12 pr-4 bg-foreground/10 border rounded-xl backdrop-blur-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.email
                  ? "border-destructive/50 focus:ring-destructive/50"
                  : "border-foreground/20 focus:ring-ring/50 focus:border-primary/30"
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-destructive text-sm mt-1 ml-4">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-text/60 group-focus-within:text-brand-text w-5 h-5 transition-colors" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className={`w-full py-3 pl-12 pr-12 bg-foreground/10 border rounded-xl backdrop-blur-sm text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.password
                  ? "border-destructive/50 focus:ring-destructive/50"
                  : "border-foreground/20 focus:ring-ring/50 focus:border-primary/30"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand-text transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-destructive text-sm mt-1 ml-4">{errors.password}</p>
          )}
        </div>

        {/* Remember me + forgot password */}
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            onClick={onClose}
            className="text-brand-text hover:text-brand-text transition-colors font-medium"
          >
            Forgot password?
          </Link>
        </div>

        {/* Phase 3, Task 3.4: Turnstile appears only after the backend returns CHALLENGE_REQUIRED */}
        {challengeRequired && (
          <TurnstileWidget
            className="flex justify-center mt-4"
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            onError={() => setTurnstileToken("")}
          />
        )}

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading || (challengeRequired && !turnstileToken)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 mt-4 bg-gradient-to-r from-primary to-primary-hover text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in <Zap size={16} />
            </>
          )}
        </motion.button>

        {/* Divider */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-foreground/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-card/80 text-muted-foreground">or continue with</span>
          </div>
        </div>

        {/* Google Sign-In — renders Google's native button which provides the
            ID token (credentialResponse.credential) the backend verifies via
            google.oauth2.id_token.verify_oauth2_token. */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            shape="rectangular"
            width="350"
            text="signin_with"
          />
        </div>
      </form>

      {/* Switch to register */}
      <p className="text-center text-muted-foreground text-sm">
        Don't have an account?{" "}
        {onSwitchToRegister ? (
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-brand-text hover:text-brand-text font-semibold transition-colors"
          >
            Create one
          </button>
        ) : (
          <Link
            to="/register"
            className="text-brand-text hover:text-brand-text font-semibold transition-colors"
          >
            Create one
          </Link>
        )}
      </p>

      {/* Terms */}
      <p className="text-center text-subtle-foreground text-xs leading-relaxed">
        By continuing, you agree to Drop 'N Roll's{" "}
        <span className="text-brand-text cursor-pointer">Terms of Service</span>{" "}
        and{" "}
        <span className="text-brand-text cursor-pointer">Privacy Policy</span>
      </p>
    </motion.div>
  );
}
