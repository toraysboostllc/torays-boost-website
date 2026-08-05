import { motion } from "framer-motion";

export function Card({ className = "", glow = "none", children, ...props }) {
  const glowClass = glow === "red" ? "hover:shadow-glow-red" : glow === "navy" ? "hover:shadow-glow-navy" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`rounded-2xl border border-torays-line bg-torays-surface p-6 transition-shadow duration-300 ${glowClass} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
