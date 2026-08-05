import { motion } from "framer-motion";

export function SectionHeading({ eyebrow, title, subtitle, align = "center" }) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`flex flex-col gap-3 ${alignClass}`}
    >
      {eyebrow && (
        <span className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl font-heading font-semibold text-torays-text">{title}</h2>
      {subtitle && (
        <p className="max-w-2xl text-torays-text-secondary text-base sm:text-lg">{subtitle}</p>
      )}
    </motion.div>
  );
}
