/**
 * AuthModal.jsx
 *
 * Global modal overlay for Login / Register.
 * - Rendered into document.body via a React portal.
 * - Closes on: X button, Escape key, backdrop click.
 * - Focus trap: Tab cycles only through focusable elements inside the modal.
 * - Focus returns to the triggering element when the modal closes
 *   (handled by AuthModalContext).
 * - Switches between Login and Register without a page reload.
 * - Works on mobile and desktop.
 */
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useAuthModal } from "../../contexts/AuthModalContext";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AuthModal() {
  const { isOpen, view, close, switchView } = useAuthModal();
  const panelRef = useRef(null);

  // ── Focus trap ─────────────────────────────────────────────────────────────
  const trapFocus = useCallback((e) => {
    if (!panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (e.key === "Escape") {
      close();
    }
  }, [close]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", trapFocus);
    // Prevent body scroll while modal is open.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = "";
    };
  }, [isOpen, trapFocus]);

  const handleBackdropClick = (e) => {
    // Only close when clicking the backdrop itself, not the panel.
    if (e.target === e.currentTarget) close();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={handleBackdropClick}
          role="presentation"
        >
          {/* Modal panel */}
          <motion.div
            key="auth-modal-panel"
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={view === "login" ? "Sign in" : "Create account"}
            className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Close button — bg-overlay-bg/text-overlay-fg (not bg-foreground/10 /
                text-foreground): this modal panel is a fixed dark-glass card over
                the permanent dark scrim above, so its own colors must stay constant
                across the site's light/dark toggle rather than following
                --foreground, which flips to near-black in light mode. See
                tokens.css for the full explanation. */}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-overlay-bg hover:bg-overlay-border text-overlay-fg transition-colors"
            >
              <X size={18} />
            </button>

            {/* Form — switches between login and register */}
            <AnimatePresence mode="wait" initial={false}>
              {view === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.18 }}
                >
                  <LoginForm
                    onClose={close}
                    onSwitchToRegister={() => switchView("register")}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                >
                  <RegisterForm
                    onClose={close}
                    onSwitchToLogin={() => switchView("login")}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}