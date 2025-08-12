"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Users,
  Truck,
  Package,
  Settings,
  Bell,
  Search,
  Eye,
  Edit,
  Trash2,
  Plus,
  Menu,
  X,
  Home,
  DollarSign,
  Clock,
  Star,
} from "lucide-react";

// Mock Data
const mockStats = {
  totalDeliveries: 2847,
  activeDrivers: 42,
  monthlyRevenue: 125430,
  onTimeRate: 98.5,
  pendingOrders: 23,
  completedToday: 156,
};

const mockOrders = [
  {
    id: "ORD-001",
    customer: "John Smith",
    driver: "Mike Johnson",
    status: "in-transit",
    pickup: "123 Main St",
    delivery: "456 Oak Ave",
    value: 25.5,
    time: "2 hours ago",
  },
  {
    id: "ORD-002",
    customer: "Sarah Wilson",
    driver: "Emma Davis",
    status: "delivered",
    pickup: "789 Pine St",
    delivery: "321 Elm St",
    value: 18.75,
    time: "4 hours ago",
  },
  {
    id: "ORD-003",
    customer: "Tech Solutions Ltd",
    driver: "Alex Brown",
    status: "pending",
    pickup: "555 Business Blvd",
    delivery: "777 Corporate Dr",
    value: 45.0,
    time: "1 hour ago",
  },
];

const mockDrivers = [
  {
    id: "DRV-001",
    name: "Mike Johnson",
    status: "active",
    rating: 4.9,
    deliveries: 234,
    earnings: 3420,
    location: "Downtown",
  },
  {
    id: "DRV-002",
    name: "Emma Davis",
    status: "active",
    rating: 4.8,
    deliveries: 189,
    earnings: 2890,
    location: "Westside",
  },
  {
    id: "DRV-003",
    name: "Alex Brown",
    status: "offline",
    rating: 4.7,
    deliveries: 156,
    earnings: 2340,
    location: "Eastside",
  },
];

// Sidebar Component
const Sidebar = ({
  activeSection,
  setActiveSection,
  isMobileOpen,
  setIsMobileOpen,
}) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "orders", label: "Orders", icon: Package },
    { id: "drivers", label: "Drivers", icon: Truck },
    { id: "users", label: "Users", icon: Users },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "financials", label: "Financials", icon: DollarSign },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: isMobileOpen ? 0 : -300 }}
        transition={{ duration: 0.3 }}
        className={`fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 lg:relative lg:translate-x-0 lg:z-auto`}
      >
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <img
              src="/images/logo-clean.jpeg"
              alt="Logo"
              className="w-8 h-8 rounded"
            />
            <div className="text-white font-bold">
              DROP<span className="text-orange-500">'N</span>ROLL
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === item.id
                    ? "bg-orange-500 text-black"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <IconComponent size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </motion.div>
    </>
  );
};

// Top Bar Component
const TopBar = ({ isMobileOpen, setIsMobileOpen }) => {
  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search orders, drivers, customers..."
              className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="relative p-2 text-gray-400 hover:text-white">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full"></span>
          </button>
          <div className="flex items-center space-x-3">
            <img
              src="/images/logo-clean.jpeg"
              alt="Admin"
              className="w-8 h-8 rounded-full"
            />
            <div className="text-sm">
              <div className="text-white font-medium">Admin User</div>
              <div className="text-gray-400">admin@dropnroll.com</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, change, icon: Icon, color = "orange" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {change && (
            <p
              className={`text-sm mt-1 ${
                change > 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {change > 0 ? "+" : ""}
              {change}% from last month
            </p>
          )}
        </div>
        <div
          className={`w-12 h-12 bg-${color}-500/10 rounded-lg flex items-center justify-center`}
        >
          <Icon className={`w-6 h-6 text-${color}-500`} />
        </div>
      </div>
    </motion.div>
  );
};

// Dashboard Section
const DashboardSection = () => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Deliveries"
          value={mockStats.totalDeliveries.toLocaleString()}
          change={12.5}
          icon={Package}
        />
        <StatsCard
          title="Active Drivers"
          value={mockStats.activeDrivers}
          change={8.2}
          icon={Truck}
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${mockStats.monthlyRevenue.toLocaleString()}`}
          change={15.3}
          icon={DollarSign}
        />
        <StatsCard
          title="On-Time Rate"
          value={`${mockStats.onTimeRate}%`}
          change={2.1}
          icon={Clock}
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Recent Orders</h3>
            <button className="text-orange-500 hover:text-orange-400 text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {mockOrders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      order.status === "delivered"
                        ? "bg-green-500"
                        : order.status === "in-transit"
                        ? "bg-blue-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="text-white font-medium">{order.id}</p>
                    <p className="text-gray-400 text-sm">{order.customer}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">${order.value}</p>
                  <p className="text-gray-400 text-sm">{order.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Performance */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Top Drivers</h3>
            <button className="text-orange-500 hover:text-orange-400 text-sm font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {mockDrivers.slice(0, 3).map((driver) => (
              <div
                key={driver.id}
                className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                    <span className="text-orange-500 font-bold text-sm">
                      {driver.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{driver.name}</p>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className="text-gray-400 text-sm">
                        {driver.rating}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">
                    {driver.deliveries} deliveries
                  </p>
                  <p className="text-gray-400 text-sm">${driver.earnings}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Orders Section
const OrdersSection = () => {
  const [selectedStatus, setSelectedStatus] = useState("all");

  const statusColors = {
    pending: "bg-yellow-500",
    "in-transit": "bg-blue-500",
    delivered: "bg-green-500",
    cancelled: "bg-red-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Order Management</h2>
        <div className="flex items-center space-x-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="bg-orange-500 hover:bg-orange-600 text-black px-4 py-2 rounded-lg font-medium flex items-center space-x-2">
            <Plus size={20} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Order ID
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Customer
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Driver
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Status
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Value
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Time
                </th>
                <th className="text-left p-4 text-gray-300 font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-t border-gray-700 hover:bg-gray-700/50"
                >
                  <td className="p-4 text-white font-medium">{order.id}</td>
                  <td className="p-4 text-gray-300">{order.customer}</td>
                  <td className="p-4 text-gray-300">{order.driver}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${
                        statusColors[order.status]
                      }`}
                    >
                      {order.status.replace("-", " ")}
                    </span>
                  </td>
                  <td className="p-4 text-white font-medium">${order.value}</td>
                  <td className="p-4 text-gray-400">{order.time}</td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                        <Edit size={16} />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-700 rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Main Admin Dashboard Component
export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection />;
      case "orders":
        return <OrdersSection />;
      case "drivers":
        return (
          <div className="text-center py-20">
            <Truck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Driver Management
            </h3>
            <p className="text-gray-400">
              Driver management features coming soon...
            </p>
          </div>
        );
      case "users":
        return (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              User Management
            </h3>
            <p className="text-gray-400">
              User management features coming soon...
            </p>
          </div>
        );
      case "analytics":
        return (
          <div className="text-center py-20">
            <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Analytics</h3>
            <p className="text-gray-400">Analytics dashboard coming soon...</p>
          </div>
        );
      case "financials":
        return (
          <div className="text-center py-20">
            <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Financial Management
            </h3>
            <p className="text-gray-400">Financial reports coming soon...</p>
          </div>
        );
      case "settings":
        return (
          <div className="text-center py-20">
            <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              System Settings
            </h3>
            <p className="text-gray-400">Settings panel coming soon...</p>
          </div>
        );
      default:
        return <DashboardSection />;
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <TopBar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

        <main className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
