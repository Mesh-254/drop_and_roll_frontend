/**
 * LoginPage.jsx — preserved as a standalone page for any direct references
 * that haven't been migrated to the modal. The /login route now uses
 * AuthModalRoute (in App.jsx) which opens AuthModal over the home background.
 */
import LoginForm from "./LoginForm";

const LoginPage = () => (
  <div className="relative min-h-screen bg-gradient-to-br from-background via-card to-background overflow-hidden flex items-center justify-center p-4">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 via-transparent to-transparent rounded-full blur-3xl" />
    </div>
    <div className="relative z-10 w-full max-w-md">
      <LoginForm />
    </div>
  </div>
);

export default LoginPage;
