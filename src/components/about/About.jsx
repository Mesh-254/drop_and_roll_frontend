"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView, useAnimation } from "framer-motion"
import { Heart, Shield, Target, Star, Quote } from "lucide-react"

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2, suffix = "" }) => {
  const [count, setCount] = useState(0)
  const countRef = useRef(null)
  const isInView = useInView(countRef, { once: true })

  useEffect(() => {
    if (isInView) {
      let startTime = null
      const animate = (currentTime) => {
        if (startTime === null) startTime = currentTime
        const progress = Math.min((currentTime - startTime) / (duration * 1000), 1)

        setCount(Math.floor(progress * end))

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }
  }, [isInView, end, duration])

  return (
    <span ref={countRef} className="text-3xl md:text-4xl font-bold text-orange-500">
      {count}
      {suffix}
    </span>
  )
}

// Floating Particles Background
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-orange-500/20 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: Math.random() * 10 + 20,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      ))}
    </div>
  )
}

// Mission/Values Cards
const ValueCard = ({ icon: Icon, title, description, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05, rotateY: 5 }}
      className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-2xl border border-gray-700 hover:border-orange-500/50 transition-all duration-300 group"
    >
      <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
        <Icon className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
  )
}

// Team/Fleet Image Card
const ImageCard = ({ src, alt, caption, delay, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.05 }}
      className={`relative group overflow-hidden rounded-2xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
      <img
        src={src || "/placeholder.svg"}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute bottom-4 left-4 right-4 z-20">
        <p className="text-white font-medium text-sm">{caption}</p>
      </div>
      <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors duration-300" />
    </motion.div>
  )
}

export default function About() {
  const controls = useAnimation()
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      controls.start("visible")
    }
  }, [controls, isInView])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  }

  return (
    <section id="about" className="relative bg-black py-20 overflow-hidden">
      {/* Floating Particles Background */}
      <FloatingParticles />

      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-black to-gray-900/50" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial="hidden"
          animate={controls}
          variants={containerVariants}
          className="text-center mb-20"
        >
          <motion.div variants={itemVariants}>
            <span className="inline-block bg-orange-500/10 text-orange-500 px-4 py-2 rounded-full text-sm font-medium mb-4">
              Our Story
            </span>
          </motion.div>
          <motion.h2 variants={itemVariants} className="text-4xl lg:text-6xl font-bold text-white mb-6">
            About <span className="text-orange-500">Drop 'n Roll</span>
          </motion.h2>
          <motion.p variants={itemVariants} className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Born from a passion for connecting people and businesses through reliable, lightning-fast delivery solutions
          </motion.p>
        </motion.div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-gray-700">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold text-white mb-6">
                  From Vision to <span className="text-orange-500">Reality</span>
                </h3>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                  What started as a simple idea between friends has evolved into a revolutionary delivery platform. We
                  saw the frustration of unreliable deliveries, the anxiety of not knowing where your package is, and
                  the disconnect between businesses and their customers.
                </p>
                <p className="text-gray-300 text-lg leading-relaxed">
                  Today, Drop 'n Roll bridges that gap with cutting-edge technology, a passionate team, and an
                  unwavering commitment to making every delivery feel personal, secure, and lightning-fast.
                </p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-3xl" />
                <img
                  src="/images/van-orange.png"
                  alt="Drop 'n Roll Fleet"
                  className="relative w-full rounded-2xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: 2500, suffix: "+", label: "Happy Customers" },
              { number: 99.8, suffix: "%", label: "On-Time Delivery" },
              { number: 50, suffix: "+", label: "Professional Drivers" },
              { number: 24, suffix: "/7", label: "Customer Support" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05 }}
                className="text-center bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-gray-700 hover:border-orange-500/50 transition-all duration-300"
              >
                <AnimatedCounter end={stat.number} suffix={stat.suffix} />
                <p className="text-gray-400 mt-2 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Mission & Values */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Our <span className="text-orange-500">Values</span>
            </h3>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">The principles that drive everything we do</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ValueCard
              icon={Heart}
              title="Customer First"
              description="Every decision we make starts with our customers. Your satisfaction drives our innovation and dedication."
              delay={0}
            />
            <ValueCard
              icon={Shield}
              title="Trust & Security"
              description="Your packages are precious cargo. We treat every delivery with the utmost care and security."
              delay={0.1}
            />
            <ValueCard
              icon={Target}
              title="Precision & Speed"
              description="We don't just deliver fast—we deliver smart. Every route optimized, every timeline respected."
              delay={0.2}
            />
          </div>
        </motion.div>

        {/* Team & Fleet Gallery */}
        {/* <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Meet Our <span className="text-orange-500">Team & Fleet</span>
            </h3>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              The people and vehicles that make the magic happen
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-[600px]">
            <ImageCard
              src="/images/merchandise.png"
              alt="Professional Team"
              caption="Our dedicated customer service team"
              delay={0}
              className="h-full"
            />
            <div className="space-y-6 h-full">
              <ImageCard
                src="/images/van-orange.png"
                alt="Delivery Fleet"
                caption="State-of-the-art delivery vehicles"
                delay={0.1}
                className="h-[280px]"
              />
              <ImageCard
                src="/images/van-dark.png"
                alt="Night Operations"
                caption="24/7 operations for urgent deliveries"
                delay={0.2}
                className="h-[280px]"
              />
            </div>
            <ImageCard
              src="/images/merchandise.png"
              alt="Quality Assurance"
              caption="Quality control and package handling"
              delay={0.3}
              className="h-full"
            />
          </div>
        </motion.div> */}

        {/* Testimonial Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-orange-500/20">
            <Quote className="w-12 h-12 text-orange-500 mx-auto mb-6" />
            <blockquote className="text-2xl md:text-3xl font-bold text-white mb-6 leading-relaxed">
              "Drop 'n Roll transformed our business. Same-day delivery went from impossible to effortless."
            </blockquote>
            <div className="flex items-center justify-center space-x-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-orange-500 fill-current" />
              ))}
            </div>
            <cite className="text-gray-400 font-medium">Sarah Johnson, CEO of LocalCraft Co.</cite>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
