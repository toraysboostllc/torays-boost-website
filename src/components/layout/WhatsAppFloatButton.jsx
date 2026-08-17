import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { hasWhatsApp } from "../../lib/whatsapp.js";

/**
 * General/"any time" WhatsApp entry point — never opens wa.me directly.
 * Clicking it calls onClick (wired by Home.jsx to open the friendly
 * WhatsAppGateModal). Only the Smart Repair Request's own final step
 * opens a real wa.me link.
 */
export function WhatsAppFloatButton({ onClick }) {
  if (!hasWhatsApp) return null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Chat on WhatsApp"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-torays-red text-white shadow-glow-red"
    >
      <MessageCircle size={26} />
    </motion.button>
  );
}
