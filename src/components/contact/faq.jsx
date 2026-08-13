"use client";
import { motion } from "framer-motion";
import { ChevronDown, HelpCircle, MessageCircle, Mail, Phone, Search } from "lucide-react";
import { useState, useMemo } from "react";

// MODERN DESIGN UPGRADE: Premium dark-mode FAQ with search and categorized answers
const FAQs = [
  {
    id: 1,
    category: "Delivery",
    question: "How long does delivery take?",
    answer:
      "Standard delivery takes 24-48 hours. Same-day delivery is available for orders placed before 2 PM on weekdays. Express delivery can be as quick as 4-6 hours.",
  },
  {
    id: 2,
    category: "Delivery",
    question: "What areas do you deliver to?",
    answer:
      "We deliver across Milton Keynes, Oxford, and 200+ surrounding areas within a 50-mile radius. Check our service map during quote process to verify your postcode.",
  },
  {
    id: 3,
    category: "Delivery",
    question: "Can I schedule a delivery in advance?",
    answer:
      "Yes! You can schedule deliveries up to 30 days in advance. Simply select your preferred date and time during the booking process.",
  },
  {
    id: 4,
    category: "Pricing",
    question: "How is the price calculated?",
    answer:
      "Prices depend on distance, parcel weight/size, delivery type, and urgency. Our quote system calculates this instantly - no hidden fees.",
  },
  {
    id: 5,
    category: "Pricing",
    question: "Do you offer bulk discounts?",
    answer:
      "Yes! We offer volume discounts for businesses with multiple deliveries. Contact our sales team for a custom quote.",
  },
  {
    id: 6,
    category: "Pricing",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards, debit cards, Apple Pay, Google Pay, and bank transfers for business accounts.",
  },
  {
    id: 7,
    category: "Tracking",
    question: "How can I track my delivery?",
    answer:
      "Use your tracking number from the confirmation email. You'll get real-time GPS updates and notifications at each milestone.",
  },
  {
    id: 8,
    category: "Tracking",
    question: "Will I get notified when my package arrives?",
    answer:
      "Yes! We send SMS and email notifications when your package is picked up, out for delivery, and delivered.",
  },
  {
    id: 9,
    category: "Tracking",
    question: "What if my delivery is late?",
    answer:
      "We offer a 30% refund if your delivery is more than 30 minutes late. Contact support with your tracking number.",
  },
  {
    id: 10,
    category: "Support",
    question: "How can I contact customer support?",
    answer:
      "Chat with us 24/7 using the chat widget on our website, email support@delivery.co.uk, or call 0800 123 4567. Average response time is under 5 minutes.",
  },
  {
    id: 11,
    category: "Support",
    question: "What if there's an issue with my delivery?",
    answer:
      "Report issues immediately through our app or contact support. We have a dedicated team to resolve problems within 24 hours.",
  },
  {
    id: 12,
    category: "Support",
    question: "Can I cancel or modify my booking?",
    answer:
      "Cancellations are free up to 2 hours before pickup. Modifications can be made anytime. Use the app or contact support.",
  },
];

export default function FAQ() {
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...new Set(FAQs.map((faq) => faq.category))];

  const filteredFAQs = useMemo(() => {
    return FAQs.filter((faq) => {
      const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-5xl mx-auto">
        {/* MODERN DESIGN UPGRADE: Centered header with subtitle */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="w-6 h-6 text-brand-text" />
            <span className="text-brand-text font-bold text-sm uppercase tracking-wider">
              Help & Support
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about our delivery services, pricing, and tracking.
          </p>
        </motion.div>

        {/* MODERN DESIGN UPGRADE: Search and filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="mb-10 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-card/50 border border-border text-foreground placeholder-subtle-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary hover:border-primary/30 transition-all duration-300"
            />
          </div>

          {/* Category Filter - Modern Pill Style */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <motion.button
                key={category}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all duration-300 ${
                  selectedCategory === category
                    ? "bg-gradient-to-r from-primary to-primary-hover text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-card/50 text-muted-foreground hover:text-primary-foreground hover:bg-surface/50 border border-border"
                }`}
              >
                {category}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* MODERN DESIGN UPGRADE: Animated accordion with detailed styling */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-4"
        >
          {filteredFAQs.map((faq) => (
            <motion.div
              key={faq.id}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              className={`group rounded-xl border transition-all duration-300 overflow-hidden ${
                expandedId === faq.id
                  ? "bg-gradient-to-br from-card/80 to-background border-primary/50 shadow-lg shadow-primary/10"
                  : "bg-card/30 border-border hover:border-primary/30"
              }`}
            >
              <motion.button
                onClick={() =>
                  setExpandedId(expandedId === faq.id ? null : faq.id)
                }
                className="w-full px-6 py-4 flex items-start justify-between gap-4 transition-all duration-300"
              >
                <div className="flex items-start gap-4 text-left flex-1">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <span className="text-brand-text text-xs font-bold">?</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground text-left group-hover:text-brand-text transition-colors">
                      {faq.question}
                    </h3>
                    <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-primary/20 text-brand-text border border-primary/30">
                      {faq.category}
                    </span>
                  </div>
                </div>

                <motion.div
                  animate={{
                    rotate: expandedId === faq.id ? 180 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0 mt-1"
                >
                  <ChevronDown
                    className="w-5 h-5 text-muted-foreground group-hover:text-brand-text transition-colors"
                    strokeWidth={3}
                  />
                </motion.div>
              </motion.button>

              {/* MODERN DESIGN UPGRADE: Smooth expand/collapse with gradient background */}
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: expandedId === faq.id ? "auto" : 0,
                  opacity: expandedId === faq.id ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4 text-muted-foreground border-t border-border/50">
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={
                      expandedId === faq.id
                        ? { opacity: 1, y: 0 }
                        : { opacity: 0, y: -10 }
                    }
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="leading-relaxed"
                  >
                    {faq.answer}
                  </motion.p>
                </div>
              </motion.div>
            </motion.div>
          ))}

          {/* No Results State */}
          {filteredFAQs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <HelpCircle className="mx-auto text-muted-foreground mb-4" size={56} />
              <h3 className="text-xl font-bold text-foreground mb-2">
                No FAQs found
              </h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search or filters
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2 rounded-lg font-bold transition-colors inline-block"
              >
                Clear Filters
              </motion.button>
            </motion.div>
          )}
        </motion.div>

        {/* MODERN DESIGN UPGRADE: Support CTA with icon features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-2xl p-8 sm:p-12"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              Still have questions?
            </h3>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Our support team is available 24/7 to help. Choose your preferred way to contact us.
            </p>
          </div>

          {/* Support Methods - MODERN DESIGN UPGRADE: Card grid with icons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: MessageCircle,
                label: "Live Chat",
                desc: "Average response: 2 minutes",
                color: "text-info",
                bgColor: "bg-info/20",
              },
              {
                icon: Mail,
                label: "Email Support",
                desc: "support@delivery.co.uk",
                color: "text-purple-400",
                bgColor: "bg-purple-500/20",
              },
              {
                icon: Phone,
                label: "Phone",
                desc: "0800 123 4567",
                color: "text-success",
                bgColor: "bg-success/20",
              },
            ].map((method, idx) => {
              const Icon = method.icon;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -4 }}
                  className="bg-card/50 border border-border hover:border-primary/30 rounded-xl p-6 transition-all duration-300 text-center cursor-pointer hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className={`${method.bgColor} rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4`}>
                    <Icon className={method.color} size={24} />
                  </div>
                  <h4 className="font-bold text-foreground mb-2">{method.label}</h4>
                  <p className="text-sm text-muted-foreground">{method.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
