"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    alert("Message sent! We'll get back to you soon.");
    setFormData({ name: "", email: "", message: "" });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <section id="contact" className="bg-background py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Get In Touch
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Ready to get started? Contact us today for a personalized quote
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-card p-8 rounded-xl border border-border">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Send us a Message
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-muted-foreground font-medium mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Your full name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="your.email@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-medium mb-2">
                  Message
                </label>
                <textarea
                  name="message"
                  placeholder="Tell us about your delivery needs..."
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg text-foreground placeholder-subtle-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Info & Box Image */}
          <div className="space-y-8">
            {/* Contact Information */}
            <div className="bg-card p-8 rounded-xl border border-border">
              <h3 className="text-2xl font-bold text-foreground mb-6">
                Contact Information
              </h3>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Phone</p>
                    <p className="text-foreground font-medium">902-450-2850</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Email</p>
                    <p className="text-foreground font-medium">info@dropnroll.com</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Address</p>
                    <p className="text-foreground font-medium">
                      400 Service St, Suite 1326
                    </p>
                  </div>
                </div>

                {/* Social Media */}
                <div className="pt-6 border-t border-border">
                  <p className="text-muted-foreground text-sm mb-4">Follow Us</p>
                  <div className="flex space-x-4">
                    <a
                      href="https://x.com"
                      className="w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary-hover transition-colors"
                    >
                      <FaXTwitter className="w-5 h-5 text-foreground" />
                    </a>
                    <a
                      href="#"
                      className="w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary-hover transition-colors"
                    >
                      <Facebook className="w-5 h-5 text-foreground" />
                    </a>
                    <a
                      href="#"
                      className="w-10 h-10 bg-primary rounded-full flex items-center justify-center hover:bg-primary-hover transition-colors"
                    >
                      <Instagram className="w-5 h-5 text-foreground" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Box Image */}
            {/* <div className="bg-card p-6 rounded-xl border border-border">
              <img
                src="/images/merchandise.png"
                alt="Drop 'n Roll Delivery Box"
                className="w-full rounded-lg shadow-lg"
              />
              <p className="text-muted-foreground text-sm mt-3 text-center">Professional Packaging & Branding</p>
            </div> */}
          </div>
        </div>
      </div>
    </section>
  );
}
