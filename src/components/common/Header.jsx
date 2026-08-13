"use client";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, Upload } from "lucide-react";
import { NavLink } from "react-router-dom";
import TrackParcelModal from "../track/TrackParcelModal";
import GetQuoteBook from "../quote/GetQuoteBook";
import ProfileDropdown from "../profile/ProfileDropdown";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../../contexts/AuthContext";
import { useAuthModal } from "../../contexts/AuthModalContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  const { registerHeaderToggle } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);

  // Tells the floating toggle in App.jsx to stand down while this header is on
  // screen. Returning the unregister function from the effect is what makes a
  // route change back to a headerless page restore it.
  useEffect(() => registerHeaderToggle(), [registerHeaderToggle]);

  // The transparent header only works over the landing hero's dark gradient.
  // On every other route (bulk upload, invoices, history, ...) the page
  // background is light/gray, so a transparent header with light-on-transparent
  // content is effectively invisible until the user scrolls and it flips to a
  // solid background. Treat all interior routes as "solid" from the first
  // paint so the header is always visible there (spec §6).
  const isLandingHero = location.pathname === "/";
  const solidHeader = isScrolled || !isLandingHero;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTracking = () => {
    setShowTrackModal(true);
  };

  const handleModalClose = () => {
    setShowTrackModal(false);
  };

  const handleBookDelivery = () => {
    setShowQuoteModal(true);
  };

  const handleBookDeliveryClose = () => {
    setShowQuoteModal(false);
  };

  const handleLogin = () => openLogin();
  const handleRegister = () => openRegister();

  const handleSmoothScroll = (elementId) => {
    const element = document.getElementById(elementId)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Services", onClick: () => handleSmoothScroll("services"), href: "#" },
    {
      name: "Tracking",
      onClick: handleTracking,
    },
    ...(isAuthenticated ? [{ name: "History", href: "/history" }] : []),
    ...(isAuthenticated ? [{ name: "Bulk Upload", href: "/bulk-upload", badge: "New" }] : []),
    { name: "Support", onClick: () => handleSmoothScroll("contact"), href: "#" },
    { name: "FAQ", href: "/faqs" },
  ];

  // Separate nav item for Billing — shown in mobile menu only (desktop users access via profile dropdown)
  const billingNavItem = isAuthenticated
    ? { name: "Billing", href: "/billing" }
    : null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          solidHeader
            ? "bg-background/95 backdrop-blur-md shadow-lg border-b border-primary/20 h-16"
            : "bg-transparent h-20"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex items-center justify-between transition-all duration-300 ${
              isScrolled ? "h-16" : "h-20"
            }`}
          >
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  {/* The mark sits ON the brand orange, so it takes the on-brand
                      foreground — the same near-black that button labels now use.
                      The codemod mapped this from bg-white to bg-card, which would
                      have made it a dark grey square in dark mode and a white
                      square invisible against a white card in light mode. */}
                  <div className="w-4 h-4 bg-primary-foreground rounded-sm"></div>
                </div>
                <span
                  className={`text-xl font-bold transition-colors duration-300 font-montserrat ${
                    isScrolled ? "text-foreground" : "text-foreground"
                  }`}
                >
                  Drop & Roll
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-5 xl:space-x-8">
              {navItems.map((item) => (
                <div key={item.name} className="relative group">
                  <NavLink
                    to={item.href}
                    onClick={item.onClick}
                    className={({ isActive }) =>
                      `font-medium transition-all duration-300 relative flex items-center gap-2 ${
                        isActive && !item.onClick
                          ? "text-brand-text font-bold"
                          : isScrolled
                          ? "text-foreground/90 hover:text-brand-text"
                          : "text-foreground/90 hover:text-brand-text"
                      }`
                    }
                  >
                    {item.name}
                    {item.badge && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-semibold ml-1">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
                </div>
              ))}
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <ProfileDropdown />
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleLogin}
                    className={`font-medium px-4 py-2 rounded-lg transition-all duration-300 border ${
                      isScrolled
                        ? "text-foreground/90 border-border hover:border-primary hover:text-brand-text hover:bg-primary/10"
                        : "text-foreground/90 border-border hover:border-primary hover:text-brand-text hover:bg-primary/10"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={handleRegister}
                    className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-medium px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
                  >
                    Register
                  </button>
                </div>
              )}

              <ThemeToggle variant="header" />

              {/* Divider */}
              <div className="w-px h-6 bg-border"></div>

              {/* CTA Button */}
              <button
                className="bg-primary hover:bg-primary-hover text-primary-foreground font-medium px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-primary/30"
                onClick={handleBookDelivery}
              >
                Send an Item
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`md:hidden p-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                isScrolled
                  ? "text-foreground hover:text-brand-text"
                  : "text-foreground hover:text-brand-text"
              }`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-primary/20 transition-all duration-300">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={(e) => {
                      if (item.onClick) {
                        item.onClick(e);
                      }
                      setIsMobileMenuOpen(false);
                    }}
                    className={({ isActive }) =>
                      `block px-3 py-2 font-medium transition-all duration-300 hover:text-brand-text hover:bg-primary/10 rounded-md ${
                        isActive && !item.onClick
                          ? "text-brand-text font-bold"
                          : "text-primary-foreground/90"
                      }`
                    }
                  >
                    {item.name}
                  </NavLink>
                ))}

                {/* Appearance — the toggle has to be reachable on a phone too,
                    where the desktop nav is hidden. */}
                <div className="px-3 py-2 border-t border-border mt-2 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">
                      Appearance
                    </span>
                    <ThemeToggle variant="header" />
                  </div>
                </div>

                {/* Auth Section for Mobile */}
                <div className="px-3 py-2 space-y-2 border-t border-border mt-2 pt-4">
                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <div className="text-foreground/90 font-medium mb-2">
                        Profile
                      </div>
                      <button
                        onClick={() => {
                          navigate("/profile-settings");
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full text-left text-primary-foreground/90 hover:text-brand-text hover:bg-primary/10 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                      >
                        Profile Settings
                      </button>
                      <button
                        onClick={() => {
                          navigate("/history");
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full text-left text-primary-foreground/90 hover:text-brand-text hover:bg-primary/10 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                      >
                        Booking History
                      </button>

                      {billingNavItem && (
                        <button
                          onClick={() => {
                            navigate("/billing");
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full text-left text-info-foreground/90 hover:text-info hover:bg-info/10 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                        >
                          Billing &amp; Invoices
                        </button>
                      )}

                      <button
                        onClick={() => {
                          logout(); // Assuming logout from useAuth context
                          setIsMobileMenuOpen(false);
                          navigate("/"); // Redirect to home after logout
                        }}
                        className="w-full text-left text-destructive hover:text-destructive hover:bg-destructive/10 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                      >
                        Logout
                      </button>
                      
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          handleLogin();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full text-primary-foreground/90 border border-border hover:border-primary hover:text-brand-text hover:bg-primary/10 font-medium px-4 py-2 rounded-lg transition-all duration-300"
                      >
                        Login
                      </button>
                      <button
                        onClick={() => {
                          handleRegister();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full bg-gradient-to-r from-primary to-primary-hover hover:from-primary-hover hover:to-primary-hover text-primary-foreground font-medium px-4 py-2 rounded-lg transition-all duration-300"
                      >
                        Register
                      </button>
                    </>
                  )}
                </div>

                <div className="px-3 py-2">
                  <button
                    className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-medium px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105"
                    onClick={() => {
                      handleBookDelivery();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Send an Item
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Tracking Modal */}
      <TrackParcelModal isOpen={showTrackModal} onClose={handleModalClose} />

      {/* Quote Modal */}
      <GetQuoteBook isOpen={showQuoteModal} onClose={handleBookDeliveryClose} />
    </>
  );
}