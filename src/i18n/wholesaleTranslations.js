/**
 * Wholesale-only EN/ES dictionary — completely separate from src/i18n/
 * translations.js on purpose. The public site's i18n scope explicitly
 * excludes Wholesale/Torays Boost Pro (see translations.js's own header),
 * and this file does not change that: the public site's translations.js is
 * never imported here, and nothing in this file is reachable from any
 * public-site component. useWholesaleLanguage()/WholesaleLocaleProvider
 * (src/lib/wholesaleLocale.jsx) are the only consumers, scoped to
 * WholesaleLogin.jsx and the private portal.
 *
 * Every user-facing string for the wholesale login screen and portal lives
 * here — nothing is hardcoded inline in a component. Same dot-path lookup
 * convention as the main translations.js (see wholesaleLocale.jsx's own
 * lookup() helper), so this file is a plain nested object, not a flat map.
 */
export const wholesaleTranslations = {
  en: {
    localeSelector: {
      countryLabel: "Country",
      languageLabel: "Language",
      countryValue: "USA",
    },
    login: {
      title: "Shop Login",
      shopName: "Shop Name",
      accessCode: "Access Code",
      submit: "Log In",
      submitting: "Checking…",
      pendingDefault: "This device needs approval. We'll let you know once it's approved.",
    },
    portal: {
      badge: "Wholesale Portal",
      privateArea: "Private area",
      welcome: "Welcome, {shopName}",
      logout: "Log out",
      title: "Check your wholesale prices",
      loading: "Loading…",
      errorTitle: "We couldn't load your prices",
      errorSessionExpired: "Your session expired. Please log in again.",
      errorTransient: "There was a problem reaching our servers. This is usually temporary.",
      retry: "Retry",
    },
    microsoldering: {
      title: "Microsoldering",
      subtitle: "Advanced board-level repair",
    },
    wizard: {
      chooseEquipment: "Select a Device to View Pricing",
      chooseEquipmentSubtitle: "Choose the device, model, and issue for an instant estimate.",
      chooseModel: "Choose your model",
      chooseFault: "Choose the issue",
      back: "Back",
      stepEquipment: "Device",
      stepModel: "Model",
      stepIssue: "Issue",
    },
    progress: {
      headline: "Increase your profit with Torays Boost",
      barLabel: "Calculating your wholesale price…",
      stepEquipmentConfirmed: "Equipment confirmed",
      stepFaultIdentified: "Issue identified",
      stepCalculating: "Calculating opportunity",
    },
    result: {
      title: "Pricing Ready",
      equipmentLabel: "Equipment",
      modelLabel: "Model",
      faultLabel: "Issue",
      shopPrice: "Your Cost with Torays Boost",
      recommendedPrice: "Recommended Customer Price",
      tierGroupLabel: "Choose a price level",
      tierCompetitive: "Silver — Competitive",
      tierRecommended: "Purple — Recommended",
      tierHighProfit: "Gold — High Profit",
      tierCustomLabel: "Custom price",
      tierProfitLabel: "Profit",
      tierMarginSuffix: "margin",
      potentialProfit: "Potential Profit",
      estimatedMargin: "Estimated Margin",
      editableLabel: "Editable",
      growMargin: "Grow your margin with Torays Boost",
      keepCustomerNote: "You keep your customer. We handle the board-level repair.",
      disclaimer: "Estimate before other expenses.",
      lossWarning: "This price would result in a loss for your shop — it's below what you pay Torays Boost.",
      consultAnother: "Check another price",
      requiresDiagnostic: "This service requires a diagnostic — the final wholesale price is confirmed after inspection.",
      rangeNote: "Estimated range — the final price depends on the exact diagnostic.",
    },
    audio: {
      label: "Sound",
      muteLabel: "Mute sound",
      unmuteLabel: "Unmute sound",
    },
    sales: {
      title: "Torays Boost Sales",
      subtitle: "Parts, equipment & accessories",
      statusBadge: "Under maintenance",
      statusActive: "Active",
      maintenanceMessage:
        "Torays Boost Sales is under maintenance. Soon you'll be able to buy parts, equipment, and accessories at special shop prices.",
    },
  },
  es: {
    localeSelector: {
      countryLabel: "País",
      languageLabel: "Idioma",
      countryValue: "USA",
    },
    login: {
      title: "Acceso de Taller",
      shopName: "Nombre del Taller",
      accessCode: "Código de Acceso",
      submit: "Iniciar Sesión",
      submitting: "Verificando…",
      pendingDefault: "Este dispositivo necesita aprobación. Te avisaremos cuando esté aprobado.",
    },
    portal: {
      badge: "Portal Mayorista",
      privateArea: "Área privada",
      welcome: "Bienvenido, {shopName}",
      logout: "Cerrar sesión",
      title: "Consulta tus precios mayoristas",
      loading: "Cargando…",
      errorTitle: "No pudimos cargar tus precios",
      errorSessionExpired: "Tu sesión expiró. Por favor inicia sesión nuevamente.",
      errorTransient: "Hubo un problema al conectar con nuestros servidores. Esto suele ser temporal.",
      retry: "Reintentar",
    },
    microsoldering: {
      title: "Microsoldadura",
      subtitle: "Reparación avanzada de placa",
    },
    wizard: {
      chooseEquipment: "Selecciona un equipo para ver el precio",
      chooseEquipmentSubtitle: "Elige el equipo, modelo y falla para obtener una estimación inmediata.",
      chooseModel: "Elige tu modelo",
      chooseFault: "Elige la falla",
      back: "Atrás",
      stepEquipment: "Equipo",
      stepModel: "Modelo",
      stepIssue: "Falla",
    },
    progress: {
      headline: "Aumenta tu ganancia con Torays Boost",
      barLabel: "Calculando tu precio mayorista…",
      stepEquipmentConfirmed: "Equipo confirmado",
      stepFaultIdentified: "Falla identificada",
      stepCalculating: "Calculando oportunidad",
    },
    result: {
      title: "Cotización lista",
      equipmentLabel: "Equipo",
      modelLabel: "Modelo",
      faultLabel: "Falla",
      shopPrice: "Tu costo con Torays Boost",
      recommendedPrice: "Precio recomendado al cliente",
      tierGroupLabel: "Elige un nivel de precio",
      tierCompetitive: "Plata — Competitivo",
      tierRecommended: "Purple — Recomendado",
      tierHighProfit: "Gold — High Profit",
      tierCustomLabel: "Precio personalizado",
      tierProfitLabel: "Ganancia",
      tierMarginSuffix: "margen",
      potentialProfit: "Ganancia potencial",
      estimatedMargin: "Margen estimado",
      editableLabel: "Editable",
      growMargin: "Aumenta tu margen con Torays Boost",
      keepCustomerNote: "Tú conservas a tu cliente. Nosotros hacemos la reparación a nivel de placa.",
      disclaimer: "Estimación antes de otros gastos.",
      lossWarning: "Este precio generaría pérdida para tu taller — es menor a lo que pagas a Torays Boost.",
      consultAnother: "Consultar otro precio",
      requiresDiagnostic: "Este servicio requiere diagnóstico — el precio mayorista final se confirma después de la inspección.",
      rangeNote: "Rango estimado — el precio final depende del diagnóstico exacto.",
    },
    audio: {
      label: "Sonido",
      muteLabel: "Silenciar sonido",
      unmuteLabel: "Activar sonido",
    },
    sales: {
      title: "Torays Boost Sales",
      subtitle: "Venta de piezas, equipos y accesorios",
      statusBadge: "En mantenimiento",
      statusActive: "Activo",
      maintenanceMessage:
        "Torays Boost Sales está en mantenimiento. Próximamente podrás comprar piezas, equipos y accesorios con precios especiales para shops.",
    },
  },
};
