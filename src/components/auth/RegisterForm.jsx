/**
 * RegisterForm.jsx
 *
 * The register card — shared by the full-page /register deep-link and the modal.
 *
 * Google Sign-In root-cause note (same as LoginForm):
 *   The old RegisterPage rendered a plain <button> with a Google SVG but no
 *   onClick. Fix: render <GoogleLogin> which calls handleGoogleSuccess with
 *   credentialResponse.credential (ID token) that the backend verifies.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  Zap,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { getFailedRules, getPasswordStrength } from "../../utils/passwordValidation";
import TurnstileWidget, { TURNSTILE_ENABLED } from "./TurnstileWidget";

export default function RegisterForm({ onClose, onSwitchToLogin }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  // Phase 3, Task 3.5: bot verification is unconditional on registration.
  const [turnstileToken, setTurnstileToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { register, googleAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (location.state?.email)
      setFormData((p) => ({ ...p, email: location.state.email }));
    if (location.state?.fromError)
      setErrors({ general: location.state.fromError });
  }, [location.state]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name] || errors.general)
      setErrors((p) => ({ ...p, [name]: "", general: "" }));
  };

  const validate = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = "First name is required";
    if (!formData.lastName.trim()) e.lastName = "Last name is required";
    if (!formData.email) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      e.email = "Please enter a valid email";
    if (!formData.password) e.password = "Password is required";
    else {
      const failed = getFailedRules(formData.password);
      if (failed.length > 0) e.password = failed.map((r) => r.label).join(", ");
    }
    if (!formData.confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (formData.password !== formData.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Phase 3, Task 3.5: require a solved challenge before submitting when Turnstile is on.
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setErrors({ general: "Please complete the verification challenge below." });
      return;
    }
    setIsLoading(true);
    setErrors({});
    try {
      const result = await register({
        full_name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        password: formData.password,
        turnstile_token: turnstileToken,
      });
      if (result.success) {
        if (onClose) onClose();
        navigate("/email-confirmation", {
          state: { email: formData.email.toLowerCase() },
        });
        return;
      }
      let msg = result.message || "Registration failed. Please try again.";
      if (result.code === "ACCOUNT_ALREADY_EXISTS") {
        msg = `${msg} Redirecting to sign in...`;
        setErrors({ general: msg });
        toast.error(msg);
        setTimeout(() => {
          if (onSwitchToLogin) {
            onSwitchToLogin();
          } else {
            if (onClose) onClose();
            navigate("/login", {
              state: { email: formData.email.toLowerCase() },
            });
          }
        }, 3000);
      } else if (result.code === "ACCOUNT_NOT_ACTIVATED") {
        msg = `${msg} Redirecting to resend confirmation...`;
        setErrors({ general: msg });
        toast.error(msg);
        setTimeout(() => {
          if (onClose) onClose();
          navigate("/resend-confirmation");
        }, 3000);
      } else {
        setErrors({ general: msg });
        toast.error(msg);
      }
    } catch {
      const msg = "An unexpected error occurred. Please try again.";
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
        if (onClose) onClose();
        navigate("/", { replace: true });
      } else {
        const msg = result.message || "Google registration failed.";
        setErrors({ general: msg });
        toast.error(msg);
      }
    } catch {
      const msg = "Google registration failed. Please try again.";
      setErrors({ general: msg });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    const msg = "Google sign-up failed. Please try again.";
    setErrors({ general: msg });
    toast.error(msg);
    setIsLoading(false);
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const passwordsMatch =
    formData.confirmPassword && formData.confirmPassword === formData.password;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 space-y-5"
    >
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full">
          <Zap size={16} className="text-orange-400" />
          <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
            Drop 'N Roll
          </span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-1">Create account</h2>
        <p className="text-gray-300 text-sm">Join Drop 'N Roll today</p>
      </div>

      {/* General error */}
      {errors.general && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* First name */}
        <div>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400/60 group-focus-within:text-orange-400 w-5 h-5 transition-colors" />
            <input
              ref={firstInputRef}
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="First name"
              autoComplete="given-name"
              className={`w-full py-3 pl-12 pr-4 bg-white/10 border rounded-xl backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.firstName
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : "border-white/20 focus:ring-orange-500/50 focus:border-orange-500/30"
              }`}
            />
          </div>
          {errors.firstName && (
            <p className="text-red-400 text-sm mt-1 ml-4">{errors.firstName}</p>
          )}
        </div>

        {/* Last name */}
        <div>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400/60 group-focus-within:text-orange-400 w-5 h-5 transition-colors" />
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Last name"
              autoComplete="family-name"
              className={`w-full py-3 pl-12 pr-4 bg-white/10 border rounded-xl backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.lastName
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : "border-white/20 focus:ring-orange-500/50 focus:border-orange-500/30"
              }`}
            />
          </div>
          {errors.lastName && (
            <p className="text-red-400 text-sm mt-1 ml-4">{errors.lastName}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400/60 group-focus-within:text-orange-400 w-5 h-5 transition-colors" />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              autoComplete="email"
              className={`w-full py-3 pl-12 pr-4 bg-white/10 border rounded-xl backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.email
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : "border-white/20 focus:ring-orange-500/50 focus:border-orange-500/30"
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-sm mt-1 ml-4">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400/60 group-focus-within:text-orange-400 w-5 h-5 transition-colors" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              autoComplete="new-password"
              className={`w-full py-3 pl-12 pr-12 bg-white/10 border rounded-xl backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.password
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : "border-white/20 focus:ring-orange-500/50 focus:border-orange-500/30"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-400 text-sm mt-1 ml-4">{errors.password}</p>
          )}
          {formData.password && (
            <div className="mt-1 ml-4">
              <div className="flex items-center gap-1 mb-1">
                {["weak", "medium", "strong"].map((tier) => (
                  <div
                    key={tier}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      passwordStrength === "weak"
                        ? tier === "weak"
                          ? "bg-red-500"
                          : "bg-white/20"
                        : passwordStrength === "medium"
                        ? tier !== "strong"
                          ? "bg-yellow-400"
                          : "bg-white/20"
                        : "bg-green-500"
                    }`}
                  />
                ))}
                <span className="text-xs text-gray-400 ml-1 capitalize">
                  {passwordStrength}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400/60 group-focus-within:text-orange-400 w-5 h-5 transition-colors" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm password"
              autoComplete="new-password"
              className={`w-full py-3 pl-12 pr-12 bg-white/10 border rounded-xl backdrop-blur-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                errors.confirmPassword
                  ? "border-red-500/50 focus:ring-red-500/50"
                  : passwordsMatch
                  ? "border-green-500/50 focus:ring-green-500/50"
                  : "border-white/20 focus:ring-orange-500/50 focus:border-orange-500/30"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-400 text-sm mt-1 ml-4">{errors.confirmPassword}</p>
          )}
          {passwordsMatch && (
            <div className="flex items-center gap-2 text-green-400 text-sm mt-1 ml-4">
              <Check size={14} /> Passwords match
            </div>
          )}
        </div>

        {/* Phase 3, Task 3.5: Cloudflare Turnstile — renders only when a site key is set */}
        <TurnstileWidget
          className="flex justify-center"
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken("")}
        />

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 mt-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Creating account...
            </>
          ) : (
            <>
              Create account <Zap size={16} />
            </>
          )}
        </motion.button>

        {/* Divider */}
        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-slate-900/80 text-gray-400">or sign up with</span>
          </div>
        </div>

        {/* Google Sign-Up — see LoginForm for root-cause note */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            size="large"
            shape="rectangular"
            width="350"
            text="signup_with"
          />
        </div>
      </form>

      {/* Switch to login */}
      <p className="text-center text-gray-400 text-sm">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
          >
            Sign in
          </button>
        ) : (
          <Link
            to="/login"
            className="text-orange-400 hover:text-orange-300 font-semibold transition-colors"
          >
            Sign in
          </Link>
        )}
      </p>

      {/* Terms */}
      <p className="text-center text-gray-500 text-xs leading-relaxed">
        By creating an account, you agree to Drop 'N Roll's{" "}
        <span className="text-orange-400 cursor-pointer">Terms of Service</span>{" "}
        and{" "}
        <span className="text-orange-400 cursor-pointer">Privacy Policy</span>
      </p>
    </motion.div>
  );
}
