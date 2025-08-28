"use client"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Settings, Lock, History, LogOut, ChevronDown } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"

export default function ProfileDropdown() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscapeKey)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscapeKey)
    }
  }, [isOpen])

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/")
      setIsOpen(false)
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  const handleNavigation = (path) => {
    navigate(path)
    setIsOpen(false)
  }

  // Generate avatar from email initials
  const getInitials = (email, fullName) => {
    if (fullName) {
      return fullName
        .split(" ")
        .map((name) => name[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return email ? email.slice(0, 2).toUpperCase() : "U"
  }

  const menuItems = [
    {
      icon: Settings,
      label: "Profile Settings",
      onClick: () => handleNavigation("/profile-settings"),
    },
    ...(user?.has_password
      ? [
          {
            icon: Lock,
            label: "Change Password",
            onClick: () => handleNavigation("/change-password"),
          },
        ]
      : []),
    {
      icon: History,
      label: "Booking History",
      onClick: () => handleNavigation("/history"),
    },
    {
      icon: LogOut,
      label: "Logout",
      onClick: handleLogout,
      className: "text-red-400 hover:text-red-300 hover:bg-red-500/10",
    },
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg transition-all duration-300 hover:bg-orange-500/10 hover:text-orange-500 text-white/90"
        aria-label="Profile menu"
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
          {getInitials(user?.email, user?.full_name)}
        </div>
        <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-black/95 backdrop-blur-md border border-orange-500/20 rounded-lg shadow-xl shadow-black/50 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                {getInitials(user?.email, user?.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{user?.full_name || "User"}</p>
                <p className="text-gray-400 text-sm truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={index}
                  onClick={item.onClick}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-left transition-all duration-200 hover:bg-orange-500/10 ${
                    item.className || "text-white/90 hover:text-orange-500"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
