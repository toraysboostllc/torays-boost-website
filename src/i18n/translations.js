/**
 * Single source of truth for every user-facing string on the public site
 * and the repair-request wizard, in English and Spanish. Nothing outside
 * this file should hardcode display copy for the areas it covers — read
 * through useLanguage()'s t() instead, so there is exactly one place to
 * update either language.
 *
 * The English side of the wizard's device/brand/problem/question labels is
 * DERIVED from repairRequest.config.js (not retyped) so the two can never
 * drift apart; only the Spanish side is hand-written there.
 *
 * Scope (per the approved i18n request): Navbar, Hero, Services, How It
 * Works, the repair-request wizard, Contact, FAQ, and Footer. WhyChooseUs,
 * AboutUs, Testimonials, Privacy, and Terms are intentionally out of scope
 * for this round and remain English-only — see the final report for why.
 * Wholesale/Torays Boost Pro is never touched by this file.
 */
import { DEVICE_CATEGORIES, PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP } from "../config/repairRequest.config.js";
import { services } from "../config/services.config.js";
import { PROMO_SLIDES } from "../config/promoCarousel.config.js";

function idLabelMap(list) {
  return Object.fromEntries(list.map((item) => [item.id, item.label]));
}

const enCategories = idLabelMap(DEVICE_CATEGORIES);
const enBrands = Object.fromEntries(
  DEVICE_CATEGORIES.filter((c) => c.brands).flatMap((c) => c.brands.map((b) => [b.id, b.label]))
);
const enProblems = Object.fromEntries(
  Object.values(PROBLEMS_BY_GROUP).flatMap((list) => list.map((p) => [p.id, p.label]))
);
const enQuestions = Object.fromEntries(
  Object.entries(SMART_QUESTIONS_BY_GROUP).map(([group, questions]) => [
    group,
    Object.fromEntries(questions.map((q) => [q.id, q.text])),
  ])
);
// Photo alt text for the Services cards — kept separate from services.config.js
// since it describes the specific stock photo chosen per card, not the
// service itself, and would drift from the image if it lived in config.
const enServiceImageAlts = {
  ps5: "Sony PlayStation 5 console standing upright next to its DualSense controller.",
  hdmi: "PS5 HDMI port repair in Miami by Torays Boost",
  microsoldering: "Technician performing microsoldering on a circuit board under a professional microscope.",
  iphone: "Opened iPhone with its internal components exposed on a repair bench.",
  ipad: "Back view of a silver Apple iPad.",
  macbook: "Side view of an open MacBook laptop on a desk.",
  samsung: "Close-up of an Android smartphone screen, representing the Samsung phones and tablets we repair.",
  xbox: "Professional Xbox Series X board-level repair by Torays Boost in Miami",
  switch: "Nintendo Switch console in its dock next to its blue and red Joy-Con controllers.",
  "data-recovery": "Open laptop showing its internal motherboard and storage drive during data recovery work.",
};
const enServices = Object.fromEntries(
  services.map((s) => [s.id, { title: s.title, description: s.description, imageAlt: enServiceImageAlts[s.id] }])
);
const enPromoSlides = Object.fromEntries(
  PROMO_SLIDES.map((s) => [s.id, { title: s.title, description: s.description }])
);

export const translations = {
  en: {
    common: {
      langEn: "English",
      langEs: "Español",
      loading: "Loading…",
    },
    nav: {
      home: "Torays Boost home",
      services: "Services",
      about: "About",
      howItWorks: "How It Works",
      faq: "FAQ",
      contact: "Contact",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },
    hero: {
      eyebrow: "Torays Boost LLC",
      titlePrefix: "Expert Repair for",
      titleHighlight: "Phones, Consoles & Computers",
      description:
        "Professional diagnostics and electronics repair for iPhone, iPad, smartphones, PS5, Xbox, MacBook, laptops and board-level problems.",
      cta: "Start Your Repair Request",
      imageAlt: "Torays Boost repair bench: PS5, Xbox, controllers, phones, a tablet, and a MacBook under microscope repair",
      trustWarranty: "Warranty Included",
      trustTurnaround: "Fast Turnaround",
      trustPricing: "Honest Pricing",
      trustTechnicians: "Experienced Technicians",
    },
    promoCarousel: {
      regionLabel: "Current promotions",
      cta: "Request an Estimate",
      prevLabel: "Previous promotion",
      nextLabel: "Next promotion",
      goToLabel: "Go to promotion {number}",
      slides: enPromoSlides,
    },
    services: {
      eyebrow: "Services",
      title: "What We Repair",
      subtitle: "Board-level and component-level repair across the devices you rely on most.",
      items: enServices,
      // Descriptive link text for the 2 cards (iPhone, PS5) that point to
      // their own local SEO landing page — keyed by service id so it's
      // only ever rendered where services.config.js actually sets
      // localPagePath, never a generic "click here".
      localLinkLabels: {
        iphone: "Phone repair in Miami",
        ps5: "PS5 repair in Miami",
        ipad: "iPad repair in Miami",
        xbox: "Xbox repair in Miami",
      },
    },
    howItWorks: {
      eyebrow: "Process",
      title: "How It Works",
      steps: {
        1: { title: "Select Your Device", description: "Tell us what you have and what's wrong with it." },
        2: { title: "Answer Three Quick Questions", description: "A few smart questions help us understand the issue." },
        3: {
          title: "Send Your Request",
          description: "Send it to Torays Boost via WhatsApp or email — no pricing bots, a real person replies.",
        },
      },
    },
    contact: {
      eyebrow: "Contact",
      title: "Get In Touch",
      email: "Email",
      whatsapp: "WhatsApp",
      address: "Address",
      hours: "Hours",
      hoursMonFri: "Monday – Friday",
      hoursSat: "Saturday",
      hoursSun: "Sunday",
      hoursClosed: "Closed",
      hoursTbd: "TBD",
      formTitle: "Send us a message",
      namePlaceholder: "Your name",
      emailPlaceholder: "Your email",
      messagePlaceholder: "How can we help?",
      sendMessage: "Send Message",
      mapPlaceholder: "Map will appear once the shop address is added to site.config.js",
    },
    whatsappGate: {
      title: "Before messaging us",
      message: "Complete your repair request first so we can help you faster. It only takes a moment.",
      start: "Start request",
      notNow: "Not now",
      close: "Close",
    },
    faq: {
      eyebrow: "FAQ",
      title: "Frequently Asked Questions",
      items: {
        warranty: {
          question: "Do your repairs come with a warranty?",
          answer:
            "Yes — every repair includes a warranty covering the specific part and labor performed. Warranty length depends on the repair type; we'll confirm the exact terms when we respond to your request.",
        },
        turnaround: {
          question: "How long does a typical repair take?",
          answer:
            "Most standard repairs (screens, batteries, charging ports) are completed within 1-3 business days. Board-level microsoldering and data recovery can take longer depending on the complexity — we'll confirm timing when we respond to your request.",
        },
        diagnostics: {
          question: "Do you charge for diagnostics?",
          answer:
            "We don't publish automatic pricing online. Send us your device and issue through our quick repair request, and we'll always let you know the cost upfront before any work begins.",
        },
        shipping: {
          question: "Can I ship my device in for repair?",
          answer:
            "Yes, we accept mail-in repairs. Reach out via WhatsApp or email and we'll walk you through packaging and shipping instructions to make sure your device arrives safely.",
        },
        "data-safety": {
          question: "Is my data safe during the repair?",
          answer:
            "Absolutely. We treat every device with strict data privacy — your data is never accessed beyond what's required to complete the repair.",
        },
        unrepairable: {
          question: "What if my device can't be repaired?",
          answer:
            "If after diagnostics we determine a device isn't repairable, you won't be charged for the attempt. We're upfront about repair odds before starting any board-level work.",
        },
      },
    },
    footer: {
      tagline: "Professional microsoldering and board-level electronics repair.",
      privacyPolicy: "Privacy Policy",
      termsConditions: "Terms & Conditions",
      imageCredits: "Image Credits",
      allRightsReserved: "All rights reserved.",
      localPages: {
        heading: "Miami Repair Guides",
        phoneRepair: "Phone repair in Miami",
        iphoneRepair: "iPhone repair in Miami",
        ipadRepair: "iPad repair in Miami",
        ps5Repair: "PS5 repair in Miami",
        ps5ControllerRepair: "PS5 controller repair in Miami",
        xboxRepair: "Xbox repair in Miami",
      },
    },
    wizard: {
      stepOf: "Step {current} of {total}",
      close: "Close",
      back: "Back",
      continueLabel: "Continue",
      reviewRequest: "Review Request",
      notSureOther: "Not sure / Other",
      photosNote: "You can attach photos after WhatsApp opens.",
      getQuote: "Get My Quote on WhatsApp",
      sendEmail: "Send via Email",
      addEmailHint: "Add your email above to send via email.",
      editLabel: "Edit {label}",
      // Split into pieces (not one flat sentence) so the Terms/Privacy
      // links land exactly where the required wording puts them, while
      // every word still comes from this translation file.
      policyConsent: {
        prefix:
          "I understand that this request is only for a no-obligation estimate, does not authorize any repair or charge, and I agree to the ",
        termsLabel: "Terms of Service",
        middle: " and ",
        privacyLabel: "Privacy Policy",
        suffix: ".",
        error: "Please accept the Terms and Privacy Policy to continue.",
      },
      // Shown separately from the mandatory checkbox above — the checkbox
      // itself only covers the no-obligation-estimate/Terms acknowledgment,
      // never WhatsApp, so this note is what actually discloses the
      // WhatsApp authorization.
      whatsappAuthNote:
        "By submitting this request, you authorize Torays Boost LLC to respond through WhatsApp only regarding this estimate or repair. This does not authorize advertising.",
      titles: {
        device: "Select your device type",
        model: "Select brand and model",
        issue: "What's the main issue?",
        contact: "Your details",
      },
      subtitles: {
        device: "What device needs repair?",
        model: "Choose the brand and exact model.",
        issue: "Select the main problem, then answer what's left.",
        contact: "Almost done. How should we reach you?",
      },
      deviceTypes: {
        phone: "Smartphone",
        tablet: "Tablet",
        console: "Console",
        controller: "Controller",
        laptop: "Laptop / MacBook",
        "data-recovery": "Data Recovery",
      },
      fields: {
        brand: "Brand",
        exactModel: "Exact model",
        exactModelOptional: "Exact model (optional)",
        enterExactModel: "Enter the exact model",
        modelPlaceholder: "e.g. iPhone 14 Pro, PS5 Slim, MacBook Air M2",
        modelPlaceholderPhone: "e.g. Galaxy S24 Ultra",
        modelPlaceholderLaptop: "e.g. Inspiron 15 3520",
        customBrand: "Brand name",
        customBrandPlaceholder: "e.g. Xiaomi, Sony, Toshiba",
        name: "Full name",
        namePlaceholder: "Your full name",
        phone: "Phone / WhatsApp",
        phonePlaceholder: "(786) 123-4567",
        phoneError: "Enter a valid 10-digit US phone number.",
        email: "Email (optional)",
        emailPlaceholder: "you@email.com",
        details: "Additional details (optional)",
        detailsPlaceholder: "More details about the issue…",
        popularModels: "Popular models",
        otherModel: "Other model",
        notSureModel: "Not sure",
      },
      diagnostics: "A couple of quick questions",
      confirm: {
        title: "Your quote request is ready",
        body: "We've prepared your message with all the details. It has not been sent yet — continue to WhatsApp and press send there.",
        summaryTitle: "What you're about to send",
        whatNext: "What happens next?",
        next1: "We review your request",
        next2: "Our technician analyzes the issue",
        next3: "You receive a quote as soon as possible",
        send: "Continue to WhatsApp",
        edit: "Edit my details",
        emailInstead: "Prefer email? Send it that way instead.",
        notStored: "No information is stored. You decide what to send.",
        close: "Close",
      },
      answers: { yes: "Yes", no: "No", "not-sure": "Not sure" },
      categories: enCategories,
      brands: enBrands,
      problems: enProblems,
      questions: enQuestions,
      summary: {
        name: "Name",
        phone: "Phone",
        email: "Email",
        device: "Device",
        brand: "Brand",
        model: "Model",
        problem: "Problem",
        notSureModel: "Not sure",
        additionalDetails: "Additional details",
        whatsappGreeting: "Hi! I'd like to request a repair:",
        emailSubjectPrefix: "Repair Request",
        consentConfirmation:
          "✅ I understand that this request is only for a no-obligation estimate and does not authorize any repair or charge.",
      },
    },
  },
  es: {
    common: {
      langEn: "English",
      langEs: "Español",
      loading: "Cargando…",
    },
    nav: {
      home: "Inicio de Torays Boost",
      services: "Servicios",
      about: "Nosotros",
      howItWorks: "Cómo funciona",
      faq: "Preguntas",
      contact: "Contacto",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
    },
    hero: {
      eyebrow: "Torays Boost LLC",
      titlePrefix: "Reparación Experta de",
      titleHighlight: "Teléfonos, Consolas y Computadoras",
      description:
        "Diagnóstico profesional y reparación electrónica para iPhone, iPad, smartphones, PS5, Xbox, MacBook, laptops y problemas de placa.",
      cta: "Iniciar Solicitud de Reparación",
      imageAlt: "Banco de reparación de Torays Boost: PS5, Xbox, controles, teléfonos, una tablet y una MacBook en reparación bajo microscopio",
      trustWarranty: "Garantía Incluida",
      trustTurnaround: "Entrega Rápida",
      trustPricing: "Precios Honestos",
      trustTechnicians: "Técnicos Experimentados",
    },
    promoCarousel: {
      regionLabel: "Promociones actuales",
      cta: "Solicitar estimado",
      prevLabel: "Promoción anterior",
      nextLabel: "Siguiente promoción",
      goToLabel: "Ir a la promoción {number}",
      slides: {
        "ps5-cleaning": {
          title: "PS5 Deep Cleaning + Liquid Metal",
          description: "Mantenimiento térmico profesional para mejorar la refrigeración y el rendimiento.",
        },
        "ps5-hdmi": {
          title: "PS5 HDMI / No Image Repair",
          description: "Microsoldadura profesional para problemas de HDMI y falta de imagen.",
        },
        "screen-battery": {
          title: "Screen & Battery Repair",
          description: "Reemplazo de pantallas y baterías para teléfonos y tablets.",
        },
        "controller-tmr": {
          title: "Controller Drift & TMR Upgrade",
          description: "Reparación precisa de drift y actualización de joysticks TMR.",
        },
        "laptop-data-recovery": {
          title: "Laptop Repair & Data Recovery",
          description: "Reparación de placas y opciones profesionales de recuperación de datos.",
        },
      },
    },
    services: {
      eyebrow: "Servicios",
      title: "Qué Reparamos",
      subtitle: "Reparación a nivel de placa y de componentes para los dispositivos que más usas.",
      items: {
        ps5: { title: "Reparación de PS5", description: "Puertos HDMI, fallas de encendido, lector de disco y diagnóstico completo a nivel de placa.", imageAlt: "Consola Sony PlayStation 5 de pie junto a su control DualSense." },
        hdmi: { title: "Reparación de HDMI", description: "Reemplazo de puerto HDMI a nivel micro para consolas y laptops — reflow de precisión, sin atajos.", imageAlt: "PS5 HDMI port repair in Miami by Torays Boost" },
        microsoldering: { title: "Microsoldadura", description: "Reparación a nivel de chip bajo microscopio profesional: reballing de IC, reparación de pistas, recuperación por daño de líquido.", imageAlt: "Técnico realizando microsoldadura en una placa de circuito bajo un microscopio profesional." },
        iphone: { title: "iPhone", description: "Pantallas, baterías, puertos de carga y reparación a nivel de placa para cada generación de iPhone.", imageAlt: "iPhone abierto con sus componentes internos expuestos sobre una mesa de reparación." },
        ipad: { title: "iPad", description: "Pantalla, digitalizador, batería y reparación de placa lógica en toda la línea de iPad.", imageAlt: "Vista trasera de un iPad plateado de Apple." },
        macbook: { title: "MacBook", description: "Recuperación por daño de líquido, teclado, batería y reparación de placa lógica.", imageAlt: "Vista lateral de una laptop MacBook abierta sobre un escritorio." },
        samsung: { title: "Samsung", description: "Pantalla, puerto de carga y reparación a nivel de chip para teléfonos y tablets Samsung.", imageAlt: "Primer plano de la pantalla de un smartphone Android, representando los teléfonos y tablets Samsung que reparamos." },
        xbox: { title: "Xbox", description: "Reparaciones de HDMI, encendido y sobrecalentamiento con diagnóstico completo antes de la devolución.", imageAlt: "Professional Xbox Series X board-level repair by Torays Boost in Miami" },
        switch: { title: "Nintendo Switch", description: "Joy-Con drift, puerto de carga, pantalla y reparación a nivel de placa para todos los modelos de Switch.", imageAlt: "Consola Nintendo Switch en su base, junto a los controles Joy-Con azul y rojo." },
        "data-recovery": { title: "Recuperación de Datos", description: "Recuperamos datos de dispositivos y discos dañados, expuestos a líquido o que no encienden.", imageAlt: "Laptop abierta mostrando su placa madre interna y unidad de almacenamiento durante un trabajo de recuperación de datos." },
      },
      localLinkLabels: {
        iphone: "Reparación de teléfonos en Miami",
        ps5: "Reparación de PS5 en Miami",
        ipad: "Reparación de iPad en Miami",
        xbox: "Reparación de Xbox en Miami",
      },
    },
    howItWorks: {
      eyebrow: "Proceso",
      title: "Cómo Funciona",
      steps: {
        1: { title: "Selecciona tu Dispositivo", description: "Cuéntanos qué tienes y qué le pasa." },
        2: { title: "Responde Tres Preguntas Rápidas", description: "Unas preguntas inteligentes nos ayudan a entender el problema." },
        3: {
          title: "Envía tu Solicitud",
          description: "Envíala a Torays Boost por WhatsApp o correo — sin bots de precios, te responde una persona real.",
        },
      },
    },
    contact: {
      eyebrow: "Contacto",
      title: "Ponte en Contacto",
      email: "Correo",
      whatsapp: "WhatsApp",
      address: "Dirección",
      hours: "Horario",
      hoursMonFri: "Lunes – Viernes",
      hoursSat: "Sábado",
      hoursSun: "Domingo",
      hoursClosed: "Cerrado",
      hoursTbd: "Por confirmar",
      formTitle: "Envíanos un mensaje",
      namePlaceholder: "Tu nombre",
      emailPlaceholder: "Tu correo",
      messagePlaceholder: "¿Cómo podemos ayudarte?",
      sendMessage: "Enviar Mensaje",
      mapPlaceholder: "El mapa aparecerá cuando se agregue la dirección del taller en site.config.js",
    },
    whatsappGate: {
      title: "Antes de escribirnos",
      message: "Completa primero tu solicitud de reparación para que podamos ayudarte más rápido. Solo tomará un momento.",
      start: "Iniciar solicitud",
      notNow: "Ahora no",
      close: "Cerrar",
    },
    faq: {
      eyebrow: "Preguntas Frecuentes",
      title: "Preguntas Frecuentes",
      items: {
        warranty: {
          question: "¿Las reparaciones tienen garantía?",
          answer:
            "Sí — toda reparación incluye garantía sobre la pieza específica y el trabajo realizado. La duración depende del tipo de reparación; confirmamos los términos exactos al responder tu solicitud.",
        },
        turnaround: {
          question: "¿Cuánto tarda una reparación típica?",
          answer:
            "La mayoría de las reparaciones estándar (pantallas, baterías, puertos de carga) se completan en 1-3 días hábiles. La microsoldadura a nivel de placa y la recuperación de datos pueden tardar más según la complejidad — confirmamos el tiempo al responder tu solicitud.",
        },
        diagnostics: {
          question: "¿Cobran por el diagnóstico?",
          answer:
            "No publicamos precios automáticos en línea. Envíanos tu dispositivo y el problema mediante nuestra solicitud rápida de reparación, y siempre te avisaremos el costo por adelantado antes de comenzar cualquier trabajo.",
        },
        shipping: {
          question: "¿Puedo enviar mi dispositivo para reparación?",
          answer:
            "Sí, aceptamos reparaciones por correo. Contáctanos por WhatsApp o email y te explicamos cómo empacar y enviar tu dispositivo de forma segura.",
        },
        "data-safety": {
          question: "¿Mis datos están seguros durante la reparación?",
          answer:
            "Por supuesto. Tratamos cada dispositivo con estricta privacidad de datos — nunca accedemos a tu información más allá de lo necesario para completar la reparación.",
        },
        unrepairable: {
          question: "¿Qué pasa si mi dispositivo no se puede reparar?",
          answer:
            "Si después del diagnóstico determinamos que un dispositivo no es reparable, no se te cobra por el intento. Somos honestos sobre las posibilidades de reparación antes de comenzar cualquier trabajo a nivel de placa.",
        },
      },
    },
    footer: {
      tagline: "Microsoldadura profesional y reparación electrónica a nivel de placa.",
      privacyPolicy: "Política de Privacidad",
      termsConditions: "Términos y Condiciones",
      imageCredits: "Créditos de imágenes",
      allRightsReserved: "Todos los derechos reservados.",
      localPages: {
        heading: "Guías de Reparación en Miami",
        phoneRepair: "Reparación de teléfonos en Miami",
        iphoneRepair: "Reparación de iPhone en Miami",
        ipadRepair: "Reparación de iPad en Miami",
        ps5Repair: "Reparación de PS5 en Miami",
        ps5ControllerRepair: "Reparación de control de PS5 en Miami",
        xboxRepair: "Reparación de Xbox en Miami",
      },
    },
    wizard: {
      stepOf: "Paso {current} de {total}",
      close: "Cerrar",
      back: "Atrás",
      continueLabel: "Continuar",
      reviewRequest: "Revisar solicitud",
      notSureOther: "No estoy seguro / Otro",
      photosNote: "Puedes adjuntar fotos después de abrir WhatsApp.",
      getQuote: "Cotizar por WhatsApp",
      sendEmail: "Enviar por correo",
      addEmailHint: "Agrega tu correo arriba para enviar por email.",
      editLabel: "Editar {label}",
      policyConsent: {
        prefix:
          "Entiendo que esta solicitud es únicamente para recibir un estimado sin compromiso, que no autoriza ninguna reparación ni cargo, y acepto los ",
        termsLabel: "Términos de servicio",
        middle: " y la ",
        privacyLabel: "Política de privacidad",
        suffix: ".",
        error: "Acepta los Términos y la Política de privacidad para continuar.",
      },
      whatsappAuthNote:
        "Al enviar esta solicitud, autorizas a Torays Boost LLC a responderte por WhatsApp únicamente en relación con este estimado o reparación. Esto no autoriza publicidad.",
      titles: {
        device: "Elige tu tipo de dispositivo",
        model: "Elige marca y modelo",
        issue: "¿Cuál es el problema principal?",
        contact: "Tus datos",
      },
      subtitles: {
        device: "¿Qué equipo necesita reparación?",
        model: "Elige la marca y el modelo exacto.",
        issue: "Elige el problema principal y responde lo que falte.",
        contact: "Ya casi. ¿Cómo te contactamos?",
      },
      deviceTypes: {
        phone: "Smartphone",
        tablet: "Tablet",
        console: "Consola",
        controller: "Control",
        laptop: "Laptop / MacBook",
        "data-recovery": "Recuperación de Datos",
      },
      fields: {
        brand: "Marca",
        exactModel: "Modelo exacto",
        exactModelOptional: "Modelo exacto (opcional)",
        enterExactModel: "Escribe el modelo exacto",
        modelPlaceholder: "ej. iPhone 14 Pro, PS5 Slim, MacBook Air M2",
        modelPlaceholderPhone: "ej. Galaxy S24 Ultra",
        modelPlaceholderLaptop: "ej. Inspiron 15 3520",
        customBrand: "Nombre de la marca",
        customBrandPlaceholder: "ej. Xiaomi, Sony, Toshiba",
        name: "Nombre completo",
        namePlaceholder: "Tu nombre completo",
        phone: "Teléfono / WhatsApp",
        phonePlaceholder: "(786) 123-4567",
        phoneError: "Escribe un teléfono de EE. UU. de 10 dígitos válido.",
        email: "Correo (opcional)",
        emailPlaceholder: "tu@correo.com",
        details: "Detalles adicionales (opcional)",
        detailsPlaceholder: "Más detalles sobre el problema…",
        popularModels: "Modelos frecuentes",
        otherModel: "Otro modelo",
        notSureModel: "No estoy seguro",
      },
      diagnostics: "Un par de preguntas rápidas",
      confirm: {
        title: "Tu solicitud está lista",
        body: "Preparamos tu mensaje con todos los datos. Todavía no se ha enviado — continúa a WhatsApp y pulsa enviar allí.",
        summaryTitle: "Esto es lo que vas a enviar",
        whatNext: "¿Qué sigue?",
        next1: "Revisamos tu solicitud",
        next2: "Nuestro técnico analiza el problema",
        next3: "Recibes tu cotización lo antes posible",
        send: "Continuar a WhatsApp",
        edit: "Editar mis datos",
        emailInstead: "¿Prefieres correo? Envíalo por esa vía.",
        notStored: "No se guarda ninguna información. Tú decides qué enviar.",
        close: "Cerrar",
      },
      answers: { yes: "Sí", no: "No", "not-sure": "No estoy seguro" },
      categories: {
        iphone: "iPhone",
        "smartphones-other": "Smartphones — Otras Marcas",
        ipad: "iPad",
        "tablets-other": "Tablets — Otras Marcas",
        ps5: "PlayStation / PS5",
        xbox: "Xbox",
        controllers: "Controles",
        macbook: "MacBook",
        "laptops-other": "Laptops — Otras Marcas",
        "data-recovery": "Recuperación de Datos",
      },
      brands: {
        samsung: "Samsung",
        "google-pixel": "Google Pixel",
        motorola: "Motorola",
        oneplus: "OnePlus",
        lg: "LG",
        other: "Otro",
        dell: "Dell",
        hp: "HP",
        lenovo: "Lenovo",
        asus: "ASUS",
        acer: "Acer",
        "microsoft-surface": "Microsoft Surface",
      },
      problems: {
        "broken-screen": "Pantalla Rota",
        "back-glass": "Vidrio Trasero",
        "battery-replacement": "Cambio de Batería",
        "charging-port": "Puerto de Carga",
        camera: "Cámara",
        "no-power": "No Enciende",
        "water-damage": "Daño por Agua",
        "data-recovery": "Recuperación de Datos",
        other: "Otro",
        "hdmi-no-image": "HDMI / Sin Imagen",
        overheating: "Sobrecalentamiento",
        "disc-drive": "Lector de Disco",
        "liquid-damage": "Daño por Líquido",
        "stick-drift": "Stick Drift (Desviación del Joystick)",
        buttons: "Botones",
        "physical-liquid-damage": "Daño Físico/Líquido",
        "slow-performance": "Rendimiento Lento",
        "motherboard-repair": "Reparación de Placa Base",
      },
      questions: {
        phone: {
          "liquid-damage": "¿El dispositivo tuvo daño por agua o líquido?",
          "front-screen-cracked": "¿La pantalla o el vidrio frontal está roto?",
          "back-glass-cracked": "¿El vidrio trasero está roto?",
        },
        tablet: {
          "liquid-damage": "¿El dispositivo tuvo daño por agua o líquido?",
          "screen-cracked": "¿La pantalla o el vidrio frontal está roto?",
          "dropped-or-bent": "¿El dispositivo se cayó o se dobló?",
        },
        console: {
          "powers-on": "¿La consola enciende?",
          "displays-image": "¿Muestra imagen en el televisor?",
          "liquid-or-physical-damage": "¿Tuvo daño físico o por líquido?",
        },
        controller: {
          "powers-on-and-connects": "¿El control enciende y se conecta?",
          "stick-drift-constant": "¿El stick drift es constante?",
          "dropped-or-liquid": "¿Se cayó o estuvo expuesto a líquido?",
        },
        laptop: {
          "powers-on": "¿La computadora enciende?",
          "liquid-damage": "¿Tuvo daño por líquido?",
          "screen-cracked": "¿La pantalla está rota o dañada?",
        },
        "data-recovery": {
          "powers-on": "¿El dispositivo enciende?",
          "storage-recognized": "¿El almacenamiento es reconocido?",
          "dropped-or-liquid": "¿Se cayó o estuvo expuesto a líquido?",
        },
      },
      summary: {
        name: "Nombre",
        phone: "Teléfono",
        email: "Correo",
        device: "Dispositivo",
        brand: "Marca",
        model: "Modelo",
        problem: "Problema",
        notSureModel: "No estoy seguro",
        additionalDetails: "Detalles adicionales",
        whatsappGreeting: "¡Hola! Quisiera solicitar una reparación:",
        emailSubjectPrefix: "Solicitud de Reparación",
        consentConfirmation:
          "✅ Entiendo que esta solicitud es solamente para recibir un estimado sin compromiso y que no autoriza ninguna reparación ni cargo.",
      },
    },
  },
};

export function formatTranslation(str, vars = {}) {
  return Object.entries(vars).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, value), str);
}
