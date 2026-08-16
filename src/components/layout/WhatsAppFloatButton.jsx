import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { hasWhatsApp, buildWhatsAppLink } from "../../lib/whatsapp.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export function WhatsAppFloatButton() {
  const { t } = useLanguage();
  if (!hasWhatsApp) return null;

  return (
    <motion.a
      href={buildWhatsAppLink(t("common.whatsappDefaultMessage"))}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
      whileHover={{ scale: 1.08 }}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-torays-red text-white shadow-glow-red"
    >
      <MessageCircle size={26} />
    </motion.a>
  );
}
