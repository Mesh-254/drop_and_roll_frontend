"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { GoogleLogin } from "@react-oauth/google";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login, googleAuth, getRedirectPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const backendUrl = 'http://127.0.0.1:8000';

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
    if (location.state?.fromError) {
      setErrors({ general: location.state.fromError });
    }
  }, [location.state]);

  // In LoginPage.jsx:
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await login(email, password, rememberMe);
      console.log("Login Result Code:", result.code); // Debug: Check if code matches switch

      if (result.success) {
        const userRole = result.data.user?.role;

        // ✅ Handle admin IMMEDIATELY (external redirect)
        if (userRole === "admin") {
          const accessToken = localStorage.getItem("access_token"); // or your storage key

          if (!accessToken) {
            alert("No access token found. Please log in again.");
            return;
          }

          // Make authenticated request to set Django session
          fetch(`${backendUrl}/api/users/auth/admin/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            credentials: "include", // Required for sessionid cookie
          })
            .then((response) => {
              if (response.ok || response.redirected) {
                // Django will redirect to /admin/ and set sessionid
                window.location.href = `${backendUrl}/admin/`;
              } else {
                throw new Error("Failed to authenticate with Django admin");
              }
            })
            .catch((err) => {
              console.error("Admin bridge failed:", err);
              alert("Failed to access admin panel. Please try again.");
            });

          return; // Prevent further navigation
        }

        // other users
        const redirectPath =
          location.state?.from?.pathname || getRedirectPath(userRole);
        navigate(redirectPath, { replace: true });
      } else {
        let redirectMessage = result.message || "Login failed.";
        let shouldRedirect = false;
        let redirectPath = null;
        const redirectTimeout = 4000; // 4 seconds for reading

        switch (result.code) {
          case "EMAIL_NOT_FOUND":
            redirectMessage = `${
              result.message || "No account found with this email."
            } Redirecting to register...`;
            shouldRedirect = true;
            redirectPath = "/register";
            break;
          case "ACCOUNT_NOT_ACTIVATED":
            redirectMessage = `${
              result.message || "Account is not activated."
            } Redirecting to resend confirmation...`;
            shouldRedirect = true;
            redirectPath = "/resend-confirmation";
            break;
          default:
            redirectMessage =
              result.message || "Login failed. Please check your credentials.";
            break;
        }

        setErrors({ general: redirectMessage });

        if (shouldRedirect && redirectPath) {
          console.log(
            `Scheduling redirect to ${redirectPath} in ${redirectTimeout}ms`
          );
          setTimeout(() => {
            console.log(`Redirecting to ${redirectPath}`);
            navigate(redirectPath, {
              state: { email: email.toLowerCase() }, // Prefill email on target page
            });
          }, redirectTimeout);
        }
      }
    } catch (error) {
      console.error("Login Error:", error); // Debug
      setErrors({ general: "Login failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };
  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    if (!email) {
      newErrors.email = "Email is required.";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setErrors({});

    try {
      const result = await googleAuth(credentialResponse.credential);
      if (result.success) {
        const userRole = result.data.user?.role;

        // ✅ Handle admin login IMMEDIATELY (external redirect)
        if (userRole === "admin") {
          const accessToken = localStorage.getItem("access_token"); // or your storage key

          if (!accessToken) {
            alert("No access token found. Please log in again.");
            return;
          }

          // Make authenticated request to set Django session
          fetch(`${backendUrl}/api/users/auth/admin/`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            credentials: "include", // Required for sessionid cookie
          })
            .then((response) => {
              if (response.ok || response.redirected) {
                // Django will redirect to /admin/ and set sessionid
                window.location.href = `${backendUrl}/admin/`;
              } else {
                throw new Error("Failed to authenticate with Django admin");
              }
            })
            .catch((err) => {
              console.error("Admin bridge failed:", err);
              alert("Failed to access admin panel. Please try again.");
            });

          return; // Prevent further navigation
        }

        // Non-admin: Use normal React navigation
        const redirectPath =
          location.state?.from?.pathname || getRedirectPath(userRole);

        navigate(redirectPath, { replace: true });
      } else {
        setErrors({
          general: result.message || "Google authentication failed.",
        });
      }
    } catch (error) {
      setErrors({ general: "Google authentication failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = (error) => {
    setErrors({ general: "Google authentication failed. Please try again." });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to your Drop 'N Roll account
          </p>
        </div>

        {errors.general && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6 flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 dark:text-red-400 text-sm">
              {errors.general}
            </p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className={`w-full py-3 pl-12 pr-4 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                  errors.email
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400`}
                required
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-sm mt-1 ml-4">{errors.email}</p>
            )}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`w-full py-3 pl-12 pr-12 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                  errors.password
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                    : "border-gray-300 dark:border-gray-600"
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1 ml-4">
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Remember me
              </span>
            </label>

            <Link
              to="/forgot-password"
              className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Sign in"
            )}
          </button>

          <div className="mt-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              clientId="your-google-client-id"
              buttonText="Sign in with Google"
              className="w-full py-3 bg-white text-gray-700 rounded-full border border-gray-300 hover:bg-gray-100 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google"
                className="w-5 h-5"
              />
              Sign in with Google
            </GoogleLogin>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
            By continuing, you agree to Drop 'N Roll's{" "}
            <span className="text-orange-500 hover:text-orange-600 cursor-pointer">
              Terms of Service
            </span>{" "}
            and acknowledge that our{" "}
            <span className="text-orange-500 hover:text-orange-600 cursor-pointer">
              Privacy Policy
            </span>{" "}
            applies to you.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
