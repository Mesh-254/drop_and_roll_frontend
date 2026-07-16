import { createContext, useCallback, useContext, useRef, useState } from "react";

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, view: "login" });
  // Track the element that triggered the modal so focus can be restored on close.
  const triggerRef = useRef(null);

  const open = useCallback((view = "login") => {
    triggerRef.current = document.activeElement;
    setState({ isOpen: true, view });
  }, []);

  const openLogin = useCallback(() => open("login"), [open]);
  const openRegister = useCallback(() => open("register"), [open]);

  const switchView = useCallback((view) => {
    setState((s) => ({ ...s, view }));
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, isOpen: false }));
    // Restore focus to the element that opened the modal.
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger && typeof trigger.focus === "function") {
      // Defer until after the modal unmounts so focus isn't swallowed.
      requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  return (
    <AuthModalContext.Provider
      value={{ ...state, openLogin, openRegister, switchView, close }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used inside AuthModalProvider");
  return ctx;
}
