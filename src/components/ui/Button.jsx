import { motion } from "framer-motion";

const VARIANTS = {
  primary:
    "bg-torays-red text-white shadow-glow-red hover:bg-torays-red-light",
  outline:
    "border border-torays-navy-light/50 text-torays-text hover:bg-torays-navy/20 hover:border-torays-navy-light",
  ghost: "text-torays-text-secondary hover:text-torays-text",
};

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  className = "",
  children,
  href,
  ...props
}) {
  const sizeClasses = size === "lg" ? "px-7 py-3.5 text-base" : "px-5 py-2.5 text-sm";
  const sharedProps = {
    whileHover: { scale: 1.03 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.2, ease: "easeOut" },
    className: `inline-flex items-center justify-center gap-2 rounded-full font-heading font-medium transition-colors duration-200 cursor-pointer ${sizeClasses} ${VARIANTS[variant]} ${className}`,
    ...props,
  };

  const content = (
    <>
      {Icon && iconPosition === "left" && <Icon size={18} />}
      {children}
      {Icon && iconPosition === "right" && <Icon size={18} />}
    </>
  );

  if (href) {
    return (
      <motion.a href={href} {...sharedProps}>
        {content}
      </motion.a>
    );
  }

  return <motion.button {...sharedProps}>{content}</motion.button>;
}
