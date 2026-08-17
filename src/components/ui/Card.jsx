import { motion } from "framer-motion";

export function Card({ className = "", glow = "none", noPadding = false, children, ...props }) {
  const glowClass = glow === "red" ? "hover:shadow-glow-red" : glow === "navy" ? "hover:shadow-glow-navy" : "";
  // noPadding drops the default p-6 and clips content to the rounded
  // corners instead — for cards that need a full-bleed cover image flush
  // against the card's own top edge (e.g. Services), while every other
  // card keeps the padded default untouched.
  const paddingClass = noPadding ? "overflow-hidden p-0" : "p-6";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`rounded-2xl border border-torays-line bg-torays-surface ${paddingClass} shadow-[0_1px_2px_rgba(15,20,36,0.04),0_1px_3px_rgba(15,20,36,0.06)] transition-shadow duration-300 ${glowClass} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
