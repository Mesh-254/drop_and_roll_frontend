"use client";

import { motion } from "framer-motion";
import { Zap, Truck, Briefcase, MapPin, Check } from "lucide-react";
import { useState, Suspense } from "react";
import GetQuoteBook from "../quote/GetQuoteBook"; // Adjust path as needed

const services = [
  {
    id: 1,
    name: "Same Day",
    tier: "Express",
    subtitle: "Ultra-fast local delivery",
    icon: Zap,
    features: [
      "Within 4 hours",
      "Milton Keynes area",
      "Priority handling",
      "Real-time tracking",
    ],
    price: "£12.99",
    color: "from-orange-500 to-red-500",
    bgColor: "bg-orange-50 dark:bg-orange-900/10",
    borderColor: "border-orange-300 dark:border-orange-700",
  },
  {
    id: 2,
    name: "Standard",
    tier: "Standard",
    subtitle: "Reliable next-day delivery",
    icon: Truck,
    features: [
      "Next business day",
      "Full tracking",
      "Insured delivery",
      "SMS updates",
    ],
    price: "£6.99",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50 dark:bg-blue-900/10",
    borderColor: "border-blue-300 dark:border-blue-700",
  },
  {
    id: 3,
    name: "Business",
    tier: "Business",
    subtitle: "Multi-location routing",
    icon: Briefcase,
    features: [
      "Scheduled delivery",
      "Multiple stops",
      "Signature required",
      "Invoice billing",
    ],
    price: "£8.99",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50 dark:bg-purple-900/10",
    borderColor: "border-purple-300 dark:border-purple-700",
  },
  {
    id: 4,
    name: "Up to 200 miles",
    tier: "Nationwide",
    subtitle: "Extended coverage delivery",
    icon: MapPin,
    features: [
      "UK-wide service",
      "Flexible timing",
      "Route optimized",
      "24/7 support",
    ],
    price: "£14.99",
    color: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50 dark:bg-green-900/10",
    borderColor: "border-green-300 dark:border-green-700",
  },
];

const ServiceCard = ({ service, onGetQuote, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  const Icon = service.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
        isHovered ? "transform scale-105" : ""
      }`}
    >
      {/* Glowing Background Effect */}
      {isHovered && (
        <motion.div
          layoutId={`glow-${service.id}`}
          className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-5 blur-xl`}
        />
      )}

      {/* Card Container */}
      <div
        className={`relative h-full rounded-2xl border-2 p-6 transition-all duration-300 backdrop-blur-sm
          ${service.bgColor} ${service.borderColor}
          ${isHovered ? "border-primary/50 shadow-2xl" : "shadow-lg"}`}
      >
        {/* Tier Badge */}
        <div className="mb-4 flex items-center justify-between">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider text-brand-text bg-brand-surface uppercase">
            {service.tier}
          </span>
        </div>

        {/* Icon Circle */}
        <motion.div
          animate={
            isHovered ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-center justify-center"
        >
          <div className={`relative w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30
            ${isHovered ? "bg-primary/20 border-primary/60 shadow-lg shadow-primary/30" : ""}`}
          >
            <Icon className="w-10 h-10 text-brand-text" />
          </div>
        </motion.div>

        {/* Title and Subtitle */}
        <h3 className="text-2xl font-bold text-foreground mb-2 font-montserrat">
          {service.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-6">
          {service.subtitle}
        </p>

        {/* Features List */}
        <ul className="space-y-3 mb-6">
          {service.features.map((feature, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 + idx * 0.05 }}
              viewport={{ once: true }}
              className="flex items-center text-sm text-muted-foreground"
            >
              <Check className="w-5 h-5 text-brand-text mr-3 flex-shrink-0" />
              {feature}
            </motion.li>
          ))}
        </ul>

        {/* Price Section */}
        <div className="mb-6 pb-6 border-b border-border">
          <div className="text-3xl font-bold text-brand-text font-montserrat">
            {service.price}
          </div>
          <p className="text-xs text-subtle-foreground dark:text-muted-foreground mt-1">
            excl. VAT
          </p>
        </div>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onGetQuote(service)}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300
            bg-gradient-to-r from-primary to-primary-hover 
            hover:from-primary-hover hover:to-primary-hover
            text-primary-foreground shadow-lg hover:shadow-primary/30
            transform hover:scale-105 active:scale-95
            focus:outline-none focus:ring-2 focus:ring-ring/50`}
        >
          Get Quote
        </motion.button>
      </div>
    </motion.div>
  );
};

export default function Services() {
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const handleGetQuote = (service) => {
    // Optionally handle service-specific logic here (e.g., set in context if available)
    console.log("Selected service:", service); // Placeholder for service handling
    setShowQuoteModal(true);
  };

  return (
    <section id="services" className="py-20 px-4 sm:px-6 lg:px-8 bg-card dark:bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 font-montserrat text-balance">
            Our Services
          </h2>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-1 w-12 bg-surface-hover dark:bg-surface"></div>
            <div className="h-1 w-20 bg-primary rounded-full"></div>
            <div className="h-1 w-12 bg-surface-hover dark:bg-surface"></div>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect delivery service for your needs. Fast, reliable,
            and transparent pricing.
          </p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              onGetQuote={handleGetQuote}
              index={index}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground mb-6">
            Not sure which service is right for you?
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleGetQuote(null)}
            className="px-8 py-4 rounded-full bg-primary hover:bg-primary-hover text-primary-foreground font-bold shadow-lg hover:shadow-primary/30 transition-all duration-300 transform hover:scale-105"
          >
            Get a Custom Quote
          </motion.button>
        </motion.div>
      </div>

      {/* Quote Modal */}
      {showQuoteModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-overlay flex items-center justify-center">
              Loading...
            </div>
          }
        >
          <GetQuoteBook
            isOpen={showQuoteModal}
            onClose={() => setShowQuoteModal(false)}
          />
        </Suspense>
      )}
    </section>
  );
}