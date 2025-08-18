"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, Eye, EyeOff, Loader2, Chrome } from "lucide-react";

const LoginPage = ({ isOpen = true, onClose}) => {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState({});

  const handleClose = () => {
    if (mode === "signup") {
      // When in register mode, go back to login instead of closing
      setMode("login");
      setShowEmailForm(false);
      setErrors({});
      // Reset form fields
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } else {
      // When in login mode, close and go to home page
      onClose();
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 8;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (!validatePassword(password)) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (mode === "signup") {
      if (!confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Real-time validation
  useEffect(() => {
    if (email && !validateEmail(email)) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email" }));
    } else {
      setErrors((prev) => ({ ...prev, email: "" }));
    }
  }, [email]);

  useEffect(() => {
    if (password && !validatePassword(password)) {
      setErrors((prev) => ({
        ...prev,
        password: "Password must be at least 8 characters",
      }));
    } else {
      setErrors((prev) => ({ ...prev, password: "" }));
    }
  }, [password]);

  useEffect(() => {
    if (mode === "signup" && confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match",
      }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
  }, [confirmPassword, password, mode]);

  const handleSocialSignIn = async (provider) => {
    setIsLoading((prev) => ({ ...prev, [provider]: true }));
    setTimeout(() => {
      console.log(`Sign in with ${provider}`);
      setIsLoading((prev) => ({ ...prev, [provider]: false }));
    }, 2000);
  };

  const handleSignWithEmail = () => {
    setShowEmailForm(true);
  };

  const handleCreateAccount = () => {
    setMode("signup");
    setShowEmailForm(false);
    setErrors({});
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("Sign in with", email, password);
    }
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    if (validateForm()) {
      console.log("Sign up with", email, password);
    }
  };

  const handleBackToLogin = () => {
    setMode("login");
    setShowEmailForm(false);
    setErrors({});
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      if (mode === "login") {
        handleSignIn(e);
      } else {
        handleSignUp(e);
      }
    }
  };

  if (!isOpen) return null;

  const socialButtons = [
    { name: "google", icon: Chrome, label: "Continue with Google" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", duration: 0.3 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 dark:from-gray-800 via-white dark:via-gray-900 to-orange-50 dark:to-gray-800 opacity-60" />

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode + showEmailForm}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <motion.h1
                className="text-3xl font-bold mb-8 text-gray-900 dark:text-white"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {mode === "login" ? "Welcome back." : "Create account"}
              </motion.h1>

              {mode === "login" && !showEmailForm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3 mb-6"
                >
                  {socialButtons.map((social, index) => (
                    <motion.button
                      key={social.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      onClick={() => handleSocialSignIn(social.name)}
                      disabled={isLoading[social.name]}
                      className="w-full py-3 px-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading[social.name] ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-3 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <social.icon className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                      )}
                      {social.label}
                    </motion.button>
                  ))}

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={handleSignWithEmail}
                    className="w-full py-3 px-4 bg-orange-500 text-white rounded-full flex items-center justify-center hover:bg-orange-600 hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    <Mail className="w-5 h-5 mr-3" />
                    Continue with email
                  </motion.button>
                </motion.div>
              )}

              {mode === "login" && showEmailForm && (
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onSubmit={handleSignIn}
                  className="space-y-4 mb-6"
                >
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Email address"
                      className={`w-full py-3 pl-12 pr-4 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        errors.email
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-300 dark:border-gray-700"
                      } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                      required
                      autoFocus
                      aria-label="Email address"
                    />
                    {errors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-1 ml-4"
                      >
                        {errors.email}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Password"
                      className={`w-full py-3 pl-12 pr-12 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        errors.password
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-300 dark:border-gray-700"
                      } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                      required
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    {errors.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-1 ml-4"
                      >
                        {errors.password}
                      </motion.p>
                    )}
                  </div>

                  <div className="text-right">
                    <button
                      type="button"
                      className="text-orange-500 hover:text-orange-600 transition-colors duration-200 text-sm"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Sign in
                  </motion.button>
                </motion.form>
              )}

              {mode === "signup" && (
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  onSubmit={handleSignUp}
                  className="space-y-4 mb-6"
                >
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Email address"
                      className={`w-full py-3 pl-12 pr-4 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        errors.email
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-300 dark:border-gray-700"
                      } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                      required
                      autoFocus
                      aria-label="Email address"
                    />
                    {errors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-1 ml-4"
                      >
                        {errors.email}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Password"
                      className={`w-full py-3 pl-12 pr-12 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        errors.password
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-300 dark:border-gray-700"
                      } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                      required
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                    {errors.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-1 ml-4"
                      >
                        {errors.password}
                      </motion.p>
                    )}
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Confirm password"
                      className={`w-full py-3 pl-12 pr-12 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
                        errors.confirmPassword
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                          : "border-gray-300 dark:border-gray-700"
                      } text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500`}
                      required
                      aria-label="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                    {errors.confirmPassword && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-1 ml-4"
                      >
                        {errors.confirmPassword}
                      </motion.p>
                    )}
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Create account
                  </motion.button>
                </motion.form>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {mode === "login" ? (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    No account?{" "}
                    <button
                      onClick={handleCreateAccount}
                      className="text-orange-500 hover:text-orange-600 font-medium transition-colors duration-200"
                    >
                      Create one
                    </button>
                  </p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Already have an account?{" "}
                    <button
                      onClick={handleBackToLogin}
                      className="text-orange-500 hover:text-orange-600 font-medium transition-colors duration-200"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 dark:text-gray-400 text-xs mt-8 text-center leading-relaxed"
          >
            By continuing, you agree to Drop 'N Roll's{" "}
            <span className="text-orange-500 hover:text-orange-600 cursor-pointer">
              Terms of Service
            </span>{" "}
            and acknowledge that our{" "}
            <span className="text-orange-500 hover:text-orange-600 cursor-pointer">
              Privacy Policy
            </span>{" "}
            applies to you.
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LoginPage;
