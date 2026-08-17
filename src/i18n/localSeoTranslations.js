/**
 * EN/ES copy for the local SEO landing pages (Phone, PS5, PS5 Controller,
 * iPhone, iPad, Xbox). Kept as its own module, separate from
 * translations.js — that file is shared by every route (Home, Privacy,
 * Wholesale, etc.), so keeping this large, single-purpose block of copy
 * out of it keeps translations.js from becoming an unmanageable catch-all.
 * (This was originally also a code-splitting boundary, back when these
 * pages were lazy-loaded; now that they're bundled eagerly with the rest
 * of the app — see App.jsx's comment on why — that particular benefit no
 * longer applies, but the organizational one still does.)
 */
export const localSeoTranslations = {
  en: {
    localSeo: {
      breadcrumbHome: "Home",
      estimateExplainer: {
        eyebrow: "No Obligation",
        title: "What Requesting an Estimate Means",
        body: "Requesting an estimate is free and doesn't commit you to anything. We review the details you share, and for some issues — like liquid damage or a device that won't power on — a physical inspection is needed before we can confirm a final price. Nothing is repaired and nothing is charged until you approve the work.",
      },
      serviceArea: {
        title: "Serving Kendall & Miami",
        body: "Torays Boost repairs devices for customers throughout Kendall and the greater Miami area.",
      },
      pages: {
        phoneRepairMiami: { relatedLinkLabel: "Phone repair in Miami" },
        ps5RepairMiami: { relatedLinkLabel: "PS5 repair in Miami" },
        ps5ControllerRepairMiami: { relatedLinkLabel: "PS5 controller repair in Miami" },
        iphoneRepairMiami: { relatedLinkLabel: "iPhone repair in Miami" },
        ipadRepairMiami: { relatedLinkLabel: "iPad repair in Miami" },
        xboxRepairMiami: { relatedLinkLabel: "Xbox repair in Miami" },
      },
    },
    phoneRepairPage: {
      seo: {
        title: "Phone Repair Miami | iPhone & Board Repair",
        description:
          "Professional phone and iPhone repair in Miami and Kendall. Screens, charging ports, no power, liquid damage and board-level microsoldering. Request an estimate.",
      },
      breadcrumbLabel: "Phone Repair Miami",
      hero: {
        eyebrow: "Phone Repair — Miami & Kendall",
        h1: "Phone Repair in Miami",
        summary:
          "Screen replacements, charging port repair, boot loops, water damage assessment, and board-level microsoldering for iPhone and other smartphones — serving Miami and Kendall.",
        ctaLabel: "Request a Phone Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "Phone Repair Services",
        items: {
          screen: "iPhone screen & LCD repair",
          chargingPort: "Charging port repair",
          noPower: "Phone won't power on",
          bootLoop: "Boot loop diagnostics",
          waterDamage: "Water or liquid damage assessment",
          motherboard: "Motherboard and board-level repair",
          microsoldering: "Microsoldering",
          dataRecovery: "Data recovery assessment",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common Phone Problems We Diagnose",
        items: {
          crackedScreen: "Cracked or unresponsive screen",
          wontCharge: "Phone won't charge",
          wontTurnOn: "Phone won't turn on",
          liquidExposure: "Exposed to water or liquid",
          complexDiagnosis: "Complex or unclear issue — needs diagnosis",
        },
      },
      faq: {
        title: "Phone Repair FAQ",
        wontTurnOn: {
          question: "Do you repair phones that will not turn on?",
          answer:
            "Yes. A phone that won't power on can have several causes — we start with diagnostics to identify the issue before recommending a repair.",
        },
        chargingPort: {
          question: "Can you repair an iPhone charging port?",
          answer: "Yes, charging port repair is one of our common phone repairs.",
        },
        microsoldering: {
          question: "Do you offer board-level and microsoldering repairs?",
          answer:
            "Yes. Board-level and microsoldering repair is one of our core services for phones with complex internal damage.",
        },
        estimateCommitment: {
          question: "Is the estimate a commitment to repair?",
          answer:
            "No. Requesting an estimate is free and doesn't authorize any repair or charge — it's only a first step.",
        },
        approval: {
          question: "Do I need to approve the repair first?",
          answer: "Yes. We never begin a repair or charge you without your approval first.",
        },
      },
      related: { title: "Related Services" },
      finalCta: {
        title: "Ready to Get Your Phone Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
    ps5RepairPage: {
      seo: {
        title: "PS5 Repair Miami | HDMI, No Power & Overheating",
        description:
          "Professional PS5 repair in Miami and Kendall. HDMI port, no display, unexpected shutdown, overheating, no power and board-level diagnostics. Request an estimate.",
      },
      breadcrumbLabel: "PS5 Repair Miami",
      hero: {
        eyebrow: "PS5 Repair — Miami & Kendall",
        h1: "PS5 Repair in Miami",
        summary:
          "HDMI port repair, no display, unexpected shutdowns, overheating, no power, and full board-level diagnostics for the PlayStation 5 — serving Miami and Kendall.",
        ctaLabel: "Request a PS5 Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "PS5 Repair Services",
        items: {
          hdmiPort: "HDMI port repair",
          noDisplay: "No display / no image",
          hdmiCircuit: "Damaged HDMI circuit",
          unexpectedShutdown: "Console turns off unexpectedly",
          overheating: "Overheating diagnostics",
          fanCleaning: "Fan inspection and cleaning",
          noPower: "No power",
          motherboardDiagnostics: "Motherboard and board-level diagnostics",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common PS5 Problems We Diagnose",
        items: {
          noImage: "No image on the TV",
          shutsOffRandomly: "Shuts off unexpectedly",
          wontPowerOn: "Won't power on",
          runsHot: "Runs hot / overheats",
        },
      },
      faq: {
        title: "PS5 Repair FAQ",
        hdmiPort: {
          question: "Can you repair a damaged PS5 HDMI port?",
          answer: "Yes, HDMI port repair is one of our core PS5 services.",
        },
        unexpectedShutdown: {
          question: "Why does my PS5 turn off unexpectedly?",
          answer:
            "Unexpected shutdowns can come from several causes, including overheating or power issues — we diagnose the console to find the specific cause.",
        },
        noDisplay: {
          question: "Do you repair PS5 consoles with no display?",
          answer: "Yes, no-display issues are one of the console problems we diagnose and repair.",
        },
        wontPowerOn: {
          question: "Can you diagnose a PS5 that will not power on?",
          answer: "Yes, we run full board-level diagnostics on consoles that won't power on.",
        },
        estimateAuthorization: {
          question: "Does requesting an estimate authorize the repair?",
          answer:
            "No. Requesting an estimate is free and no-obligation — it does not authorize any repair or charge.",
        },
      },
      related: { title: "Related Services" },
      relatedControllerNote: "Need help with a DualSense controller or stick drift?",
      finalCta: {
        title: "Ready to Get Your PS5 Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
    ps5ControllerRepairPage: {
      seo: {
        title: "PS5 Controller Repair Miami | DualSense Drift & TMR",
        description:
          "DualSense and PS5 controller repair in Miami and Kendall. Stick drift, TMR joysticks, buttons, charging, batteries and trigger problems. Request an estimate.",
      },
      breadcrumbLabel: "PS5 Controller Repair Miami",
      hero: {
        eyebrow: "Controller Repair — Miami & Kendall",
        h1: "PS5 Controller Repair in Miami",
        summary:
          "Stick drift repair, TMR joystick installation, DualSense and DualSense Edge repair, unresponsive buttons, charging problems, and battery replacement — serving Miami and Kendall.",
        ctaLabel: "Request a PS5 Controller Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "PS5 Controller Repair Services",
        items: {
          stickDrift: "Stick drift repair",
          joystickReplacement: "Joystick replacement",
          tmrJoystick: "TMR joystick installation",
          dualSenseRepair: "DualSense repair",
          dualSenseEdge: "DualSense Edge repair",
          buttonsNotResponding: "Buttons not responding",
          chargingProblems: "Charging problems",
          batteryReplacement: "Battery replacement",
          damagedTriggers: "Damaged triggers",
          boardDiagnostics: "Controller board diagnostics",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common Controller Problems We Diagnose",
        items: {
          sticksDriftOnTheirOwn: "Stick moves on its own (drift)",
          buttonsUnresponsive: "Buttons unresponsive or sticky",
          wontHoldCharge: "Won't hold a charge",
          loosePulls: "Loose or damaged triggers",
        },
      },
      faq: {
        title: "Controller Repair FAQ",
        stickDrift: {
          question: "Can you repair DualSense stick drift?",
          answer: "Yes, stick drift repair is one of our most requested controller services.",
        },
        tmrJoystick: {
          question: "What is a TMR joystick?",
          answer:
            "TMR (Tunneling Magnetoresistance) joysticks are a magnetic-sensor replacement for the original stick module, built to resist the wear that causes drift.",
        },
        dualSenseEdge: {
          question: "Do you repair DualSense Edge controllers?",
          answer: "Yes, we repair the DualSense Edge in addition to the standard DualSense controller.",
        },
        driftWarranty: {
          question: "Is the drift repair covered by a warranty?",
          answer: "Stick drift repairs include a 60-day warranty.",
        },
        estimateAuthorization: {
          question: "Does requesting an estimate authorize the repair?",
          answer:
            "No. Requesting an estimate is free and no-obligation — it does not authorize any repair or charge.",
        },
      },
      related: { title: "Related Services" },
      finalCta: {
        title: "Ready to Get Your Controller Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
    iphoneRepairPage: {
      seo: {
        title: "iPhone Repair Miami | Screen, Charging & No Power",
        description:
          "Professional iPhone repair in Miami and Kendall. Screen and LCD, charging port, no power, boot loop, liquid damage and board-level microsoldering. Request an estimate.",
      },
      breadcrumbLabel: "iPhone Repair Miami",
      hero: {
        eyebrow: "iPhone Repair — Miami & Kendall",
        h1: "iPhone Repair in Miami",
        summary:
          "Dedicated iPhone diagnostics and repair — screen and LCD replacement, charging port service, boot loop and no-power troubleshooting, and board-level microsoldering for logic board issues — serving Miami and Kendall.",
        ctaLabel: "Request an iPhone Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "iPhone Repair Services",
        items: {
          screenLcd: "Screen and LCD replacement",
          chargingPort: "Charging port repair",
          notCharging: "iPhone not charging",
          noPower: "No power",
          bootLoop: "Boot loop troubleshooting",
          liquidDamage: "Liquid damage assessment",
          motherboard: "Motherboard and board-level repair",
          microsoldering: "Microsoldering",
          dataRecovery: "Data recovery assessment",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common iPhone Problems We Diagnose",
        items: {
          crackedOrDeadScreen: "Cracked or unresponsive screen",
          wontChargeOrDetectCable: "Won't charge or doesn't detect the cable",
          stuckOnLogo: "Stuck on the Apple logo",
          exposedToLiquid: "Exposed to water or liquid",
          complexBoardIssue: "Complex board-level issue — needs diagnosis",
        },
      },
      faq: {
        title: "iPhone Repair FAQ",
        screenRepair: {
          question: "Do you repair cracked or unresponsive iPhone screens?",
          answer: "Yes, screen and LCD replacement is one of our most common iPhone repairs.",
        },
        chargingPort: {
          question: "Can you repair an iPhone that won't charge?",
          answer: "Yes — charging port issues are diagnosed and repaired as part of our iPhone service.",
        },
        noPower: {
          question: "Do you work on iPhones that show no signs of power at all?",
          answer:
            "Yes. A completely dead iPhone can have several causes — we diagnose the board before recommending a repair.",
        },
        microsoldering: {
          question: "Do you offer board-level microsoldering for iPhone?",
          answer: "Yes, microsoldering is one of our core services for iPhones with internal board damage.",
        },
        estimateAuthorization: {
          question: "Does requesting an estimate authorize the repair?",
          answer:
            "No. Requesting an estimate is free and no-obligation — it does not authorize any repair or charge.",
        },
      },
      related: { title: "Related Services" },
      finalCta: {
        title: "Ready to Get Your iPhone Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
    ipadRepairPage: {
      seo: {
        title: "iPad Repair Miami | Screen, Charging Port & No Power",
        description:
          "Professional iPad repair in Miami and Kendall. Screens, digitizers, charging ports, no power, backlight and board-level microsoldering. Request an estimate.",
      },
      breadcrumbLabel: "iPad Repair Miami",
      hero: {
        eyebrow: "iPad Repair — Miami & Kendall",
        h1: "iPad Repair in Miami",
        summary:
          "Screen and digitizer replacement, charging port repair, backlight and charging IC diagnostics, and board-level microsoldering for iPad — serving Miami and Kendall.",
        ctaLabel: "Request an iPad Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "iPad Repair Services",
        items: {
          screenLcd: "Screen and LCD repair",
          digitizer: "Digitizer replacement",
          crackedGlass: "Cracked glass repair",
          chargingPort: "Charging port repair",
          notCharging: "iPad not charging",
          noPower: "No power",
          backlight: "Backlight repair",
          chargingIcDiagnostics: "Charging IC diagnostics",
          motherboard: "Motherboard and board-level repair",
          microsoldering: "Microsoldering",
          liquidDamage: "Liquid damage assessment",
          dataRecovery: "Data recovery assessment",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common iPad Problems We Diagnose",
        items: {
          crackedScreenOrGlass: "Cracked screen or glass",
          wontCharge: "Won't charge",
          wontTurnOn: "Won't turn on",
          dimOrNoDisplay: "Dim, flickering, or no display",
          exposedToLiquid: "Exposed to water or liquid",
        },
      },
      faq: {
        title: "iPad Repair FAQ",
        lcdVsDigitizer: {
          question: "What's the difference between a cracked digitizer and a damaged LCD?",
          answer:
            "The digitizer is the glass touch layer on top of the screen; the LCD is the display underneath it. A cracked digitizer alone can sometimes be replaced separately, but if the LCD is also damaged, both need to be replaced together — we confirm which applies to your iPad during inspection.",
        },
        chargingPort: {
          question: "Can you repair an iPad charging port?",
          answer: "Yes, charging port repair is one of our common iPad services.",
        },
        backlight: {
          question: "Do you repair iPad backlight issues?",
          answer: "Yes — a dim, flickering, or missing backlight is diagnosed and repaired as part of our iPad service.",
        },
        noPower: {
          question: "Do you work on iPads that won't power on at all?",
          answer:
            "Yes. We diagnose the board and charging circuitry to determine the cause before recommending a repair.",
        },
        approval: {
          question: "Do I need to approve the repair first?",
          answer: "Yes. We never begin a repair or charge you without your approval first.",
        },
      },
      related: { title: "Related Services" },
      finalCta: {
        title: "Ready to Get Your iPad Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
    xboxRepairPage: {
      seo: {
        title: "Xbox Repair Miami | Series X/S HDMI & No Power",
        description:
          "Professional Xbox Series X and Series S repair in Miami and Kendall. HDMI, no display, unexpected shutdown, overheating and no-power diagnostics.",
      },
      breadcrumbLabel: "Xbox Repair Miami",
      hero: {
        eyebrow: "Xbox Repair — Miami & Kendall",
        h1: "Xbox Repair in Miami",
        summary:
          "HDMI port repair, no display, unexpected shutdowns, overheating, and no-power diagnostics for Xbox Series X and Series S — serving Miami and Kendall.",
        ctaLabel: "Request an Xbox Repair Estimate",
        note: "Free, no-obligation estimate — some issues need a physical inspection before a final price is confirmed.",
      },
      services: {
        eyebrow: "Services",
        title: "Xbox Repair Services",
        items: {
          hdmiPort: "HDMI port repair",
          noDisplay: "No display / no image",
          hdmiCircuit: "Damaged HDMI circuit",
          unexpectedShutdown: "Console turns off unexpectedly",
          overheatingCleaning: "Overheating diagnostics and internal cleaning",
          noPower: "No power",
          motherboardDiagnostics: "Motherboard diagnostics",
          boardLevelRepair: "Board-level repair",
        },
      },
      issues: {
        eyebrow: "Common Problems",
        title: "Common Xbox Problems We Diagnose",
        items: {
          noImageOnScreen: "No image on the TV",
          shutsOffUnexpectedly: "Shuts off unexpectedly",
          wontPowerOn: "Won't power on",
          overheatsQuickly: "Overheats quickly",
        },
      },
      faq: {
        title: "Xbox Repair FAQ",
        seriesXAndS: {
          question: "Do you repair both Xbox Series X and Series S?",
          answer: "Yes, we work on both Xbox Series X and Xbox Series S.",
        },
        hdmiPort: {
          question: "Can you repair a damaged Xbox HDMI port?",
          answer: "Yes, HDMI port repair is one of our core Xbox services.",
        },
        noDisplay: {
          question: "Do you repair an Xbox with no display?",
          answer: "Yes, no-display issues are one of the console problems we diagnose and repair.",
        },
        unexpectedShutdown: {
          question: "Why does my Xbox turn off unexpectedly?",
          answer:
            "Unexpected shutdowns can come from several causes, including overheating or power issues — we diagnose the console to find the specific cause.",
        },
        noPower: {
          question: "Can you diagnose an Xbox that will not power on?",
          answer: "Yes, we run full board-level diagnostics on consoles that won't power on.",
        },
        estimateAuthorization: {
          question: "Does requesting an estimate authorize the repair?",
          answer:
            "No. Requesting an estimate is free and no-obligation — it does not authorize any repair or charge.",
        },
      },
      related: { title: "Related Services" },
      finalCta: {
        title: "Ready to Get Your Xbox Fixed?",
        body: "Request a free, no-obligation estimate and we'll follow up with the next steps.",
      },
    },
  },
  es: {
    localSeo: {
      breadcrumbHome: "Inicio",
      estimateExplainer: {
        eyebrow: "Sin Compromiso",
        title: "Qué Significa Solicitar un Estimado",
        body: "Solicitar un estimado es gratis y no te compromete a nada. Revisamos los detalles que nos compartes, y para algunos problemas — como daño por líquido o un equipo que no enciende — se necesita una inspección física antes de confirmar un precio final. Nada se repara ni se cobra hasta que apruebes el trabajo.",
      },
      serviceArea: {
        title: "Servimos a Kendall y Miami",
        body: "Torays Boost repara dispositivos para clientes en todo Kendall y el área metropolitana de Miami.",
      },
      pages: {
        phoneRepairMiami: { relatedLinkLabel: "Reparación de teléfonos en Miami" },
        ps5RepairMiami: { relatedLinkLabel: "Reparación de PS5 en Miami" },
        ps5ControllerRepairMiami: { relatedLinkLabel: "Reparación de control de PS5 en Miami" },
        iphoneRepairMiami: { relatedLinkLabel: "Reparación de iPhone en Miami" },
        ipadRepairMiami: { relatedLinkLabel: "Reparación de iPad en Miami" },
        xboxRepairMiami: { relatedLinkLabel: "Reparación de Xbox en Miami" },
      },
    },
    phoneRepairPage: {
      seo: {
        title: "Reparación de Teléfonos en Miami | iPhone y Placa",
        description:
          "Reparación profesional de teléfonos y iPhone en Miami y Kendall. Pantallas, puertos de carga, no enciende, daño por líquido y microsoldadura a nivel de placa. Solicita un estimado.",
      },
      breadcrumbLabel: "Reparación de Teléfonos Miami",
      hero: {
        eyebrow: "Reparación de Teléfonos — Miami y Kendall",
        h1: "Reparación de Teléfonos en Miami",
        summary:
          "Cambio de pantalla, reparación de puerto de carga, boot loop, evaluación de daño por agua y microsoldadura a nivel de placa para iPhone y otros smartphones — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para teléfono",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de Teléfonos",
        items: {
          screen: "Reparación de pantalla y LCD de iPhone",
          chargingPort: "Reparación de puerto de carga",
          noPower: "El teléfono no enciende",
          bootLoop: "Diagnóstico de boot loop",
          waterDamage: "Evaluación de daño por agua o líquido",
          motherboard: "Reparación de placa base y a nivel de placa",
          microsoldering: "Microsoldadura",
          dataRecovery: "Evaluación de recuperación de datos",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de Teléfonos que Diagnosticamos",
        items: {
          crackedScreen: "Pantalla rota o que no responde",
          wontCharge: "El teléfono no carga",
          wontTurnOn: "El teléfono no enciende",
          liquidExposure: "Expuesto a agua o líquido",
          complexDiagnosis: "Problema complejo o poco claro — requiere diagnóstico",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — Teléfonos",
        wontTurnOn: {
          question: "¿Reparan teléfonos que no encienden?",
          answer:
            "Sí. Un teléfono que no enciende puede tener varias causas — comenzamos con un diagnóstico para identificar el problema antes de recomendar una reparación.",
        },
        chargingPort: {
          question: "¿Pueden reparar el puerto de carga de un iPhone?",
          answer: "Sí, la reparación de puerto de carga es una de nuestras reparaciones más comunes.",
        },
        microsoldering: {
          question: "¿Ofrecen reparaciones a nivel de placa y microsoldadura?",
          answer:
            "Sí. La reparación a nivel de placa y microsoldadura es uno de nuestros servicios principales para teléfonos con daño interno complejo.",
        },
        estimateCommitment: {
          question: "¿El estimado me compromete a hacer la reparación?",
          answer:
            "No. Solicitar un estimado es gratis y no autoriza ninguna reparación ni cargo — es solamente un primer paso.",
        },
        approval: {
          question: "¿Necesito aprobar la reparación primero?",
          answer: "Sí. Nunca comenzamos una reparación ni cobramos sin tu aprobación primero.",
        },
      },
      related: { title: "Servicios Relacionados" },
      finalCta: {
        title: "¿Listo para Reparar tu Teléfono?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
    ps5RepairPage: {
      seo: {
        title: "Reparación de PS5 en Miami | HDMI, No Enciende y Sobrecalentamiento",
        description:
          "Reparación profesional de PS5 en Miami y Kendall. Puerto HDMI, sin imagen, apagado inesperado, sobrecalentamiento, no enciende y diagnóstico a nivel de placa. Solicita un estimado.",
      },
      breadcrumbLabel: "Reparación de PS5 Miami",
      hero: {
        eyebrow: "Reparación de PS5 — Miami y Kendall",
        h1: "Reparación de PS5 en Miami",
        summary:
          "Reparación de puerto HDMI, sin imagen, apagados inesperados, sobrecalentamiento, no enciende y diagnóstico completo a nivel de placa para la PlayStation 5 — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para PS5",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de PS5",
        items: {
          hdmiPort: "Reparación de puerto HDMI",
          noDisplay: "Sin imagen / no muestra video",
          hdmiCircuit: "Circuito HDMI dañado",
          unexpectedShutdown: "La consola se apaga inesperadamente",
          overheating: "Diagnóstico de sobrecalentamiento",
          fanCleaning: "Inspección y limpieza del ventilador",
          noPower: "No enciende",
          motherboardDiagnostics: "Diagnóstico de placa base y a nivel de placa",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de PS5 que Diagnosticamos",
        items: {
          noImage: "Sin imagen en el televisor",
          shutsOffRandomly: "Se apaga inesperadamente",
          wontPowerOn: "No enciende",
          runsHot: "Se calienta demasiado",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — PS5",
        hdmiPort: {
          question: "¿Pueden reparar un puerto HDMI dañado de PS5?",
          answer: "Sí, la reparación de puerto HDMI es uno de nuestros servicios principales para PS5.",
        },
        unexpectedShutdown: {
          question: "¿Por qué mi PS5 se apaga inesperadamente?",
          answer:
            "Un apagado inesperado puede tener varias causas, incluyendo sobrecalentamiento o problemas de alimentación — diagnosticamos la consola para encontrar la causa específica.",
        },
        noDisplay: {
          question: "¿Reparan consolas PS5 sin imagen?",
          answer: "Sí, los problemas de sin imagen son uno de los problemas de consola que diagnosticamos y reparamos.",
        },
        wontPowerOn: {
          question: "¿Pueden diagnosticar una PS5 que no enciende?",
          answer: "Sí, hacemos un diagnóstico completo a nivel de placa en consolas que no encienden.",
        },
        estimateAuthorization: {
          question: "¿Solicitar un estimado autoriza la reparación?",
          answer: "No. Solicitar un estimado es gratis y sin compromiso — no autoriza ninguna reparación ni cargo.",
        },
      },
      related: { title: "Servicios Relacionados" },
      relatedControllerNote: "¿Necesitas ayuda con un control DualSense o stick drift?",
      finalCta: {
        title: "¿Listo para Reparar tu PS5?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
    ps5ControllerRepairPage: {
      seo: {
        title: "Reparación de Control PS5 en Miami | Drift DualSense y TMR",
        description:
          "Reparación de controles DualSense y PS5 en Miami y Kendall. Stick drift, joysticks TMR, botones, carga, baterías y gatillos. Solicita un estimado.",
      },
      breadcrumbLabel: "Reparación de Control PS5 Miami",
      hero: {
        eyebrow: "Reparación de Controles — Miami y Kendall",
        h1: "Reparación de Control PS5 en Miami",
        summary:
          "Reparación de stick drift, instalación de joystick TMR, reparación de DualSense y DualSense Edge, botones que no responden, problemas de carga y cambio de batería — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para control PS5",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de Control PS5",
        items: {
          stickDrift: "Reparación de stick drift",
          joystickReplacement: "Cambio de joystick",
          tmrJoystick: "Instalación de joystick TMR",
          dualSenseRepair: "Reparación de DualSense",
          dualSenseEdge: "Reparación de DualSense Edge",
          buttonsNotResponding: "Botones que no responden",
          chargingProblems: "Problemas de carga",
          batteryReplacement: "Cambio de batería",
          damagedTriggers: "Gatillos dañados",
          boardDiagnostics: "Diagnóstico de la placa del control",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de Controles que Diagnosticamos",
        items: {
          sticksDriftOnTheirOwn: "El stick se mueve solo (drift)",
          buttonsUnresponsive: "Botones que no responden o se pegan",
          wontHoldCharge: "No mantiene la carga",
          loosePulls: "Gatillos sueltos o dañados",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — Controles",
        stickDrift: {
          question: "¿Pueden reparar el stick drift del DualSense?",
          answer: "Sí, la reparación de stick drift es uno de nuestros servicios de controles más solicitados.",
        },
        tmrJoystick: {
          question: "¿Qué es un joystick TMR?",
          answer:
            "Los joysticks TMR (Magnetorresistencia Túnel) son un reemplazo con sensor magnético para el módulo del stick original, diseñado para resistir el desgaste que causa el drift.",
        },
        dualSenseEdge: {
          question: "¿Reparan controles DualSense Edge?",
          answer: "Sí, reparamos el DualSense Edge además del control DualSense estándar.",
        },
        driftWarranty: {
          question: "¿La reparación de drift tiene garantía?",
          answer: "Las reparaciones de stick drift incluyen una garantía de 60 días.",
        },
        estimateAuthorization: {
          question: "¿Solicitar un estimado autoriza la reparación?",
          answer: "No. Solicitar un estimado es gratis y sin compromiso — no autoriza ninguna reparación ni cargo.",
        },
      },
      related: { title: "Servicios Relacionados" },
      finalCta: {
        title: "¿Listo para Reparar tu Control?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
    iphoneRepairPage: {
      seo: {
        title: "Reparación de iPhone en Miami | Pantalla, Carga y No Enciende",
        description:
          "Reparación profesional de iPhone en Miami y Kendall. Pantalla y LCD, puerto de carga, no enciende, boot loop, daño por líquido y microsoldadura a nivel de placa. Solicita un estimado.",
      },
      breadcrumbLabel: "Reparación de iPhone Miami",
      hero: {
        eyebrow: "Reparación de iPhone — Miami y Kendall",
        h1: "Reparación de iPhone en Miami",
        summary:
          "Diagnóstico y reparación especializada de iPhone — reemplazo de pantalla y LCD, servicio de puerto de carga, diagnóstico de boot loop y no enciende, y microsoldadura a nivel de placa para problemas de placa lógica — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para iPhone",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de iPhone",
        items: {
          screenLcd: "Reemplazo de pantalla y LCD",
          chargingPort: "Reparación de puerto de carga",
          notCharging: "El iPhone no carga",
          noPower: "No enciende",
          bootLoop: "Diagnóstico de boot loop",
          liquidDamage: "Evaluación de daño por líquido",
          motherboard: "Reparación de placa base y a nivel de placa",
          microsoldering: "Microsoldadura",
          dataRecovery: "Evaluación de recuperación de datos",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de iPhone que Diagnosticamos",
        items: {
          crackedOrDeadScreen: "Pantalla rota o que no responde",
          wontChargeOrDetectCable: "No carga o no detecta el cable",
          stuckOnLogo: "Se queda en el logo de Apple",
          exposedToLiquid: "Expuesto a agua o líquido",
          complexBoardIssue: "Problema complejo de placa — requiere diagnóstico",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — iPhone",
        screenRepair: {
          question: "¿Reparan pantallas de iPhone rotas o que no responden?",
          answer: "Sí, el reemplazo de pantalla y LCD es una de nuestras reparaciones de iPhone más comunes.",
        },
        chargingPort: {
          question: "¿Pueden reparar un iPhone que no carga?",
          answer: "Sí — los problemas de puerto de carga se diagnostican y reparan como parte de nuestro servicio de iPhone.",
        },
        noPower: {
          question: "¿Trabajan con iPhones que no muestran ninguna señal de encendido?",
          answer:
            "Sí. Un iPhone completamente sin señales de vida puede tener varias causas — diagnosticamos la placa antes de recomendar una reparación.",
        },
        microsoldering: {
          question: "¿Ofrecen microsoldadura a nivel de placa para iPhone?",
          answer: "Sí, la microsoldadura es uno de nuestros servicios principales para iPhones con daño interno de placa.",
        },
        estimateAuthorization: {
          question: "¿Solicitar un estimado autoriza la reparación?",
          answer: "No. Solicitar un estimado es gratis y sin compromiso — no autoriza ninguna reparación ni cargo.",
        },
      },
      related: { title: "Servicios Relacionados" },
      finalCta: {
        title: "¿Listo para Reparar tu iPhone?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
    ipadRepairPage: {
      seo: {
        title: "Reparación de iPad en Miami | Pantalla, Puerto de Carga y No Enciende",
        description:
          "Reparación profesional de iPad en Miami y Kendall. Pantallas, digitalizadores, puertos de carga, no enciende, backlight y microsoldadura a nivel de placa. Solicita un estimado.",
      },
      breadcrumbLabel: "Reparación de iPad Miami",
      hero: {
        eyebrow: "Reparación de iPad — Miami y Kendall",
        h1: "Reparación de iPad en Miami",
        summary:
          "Reemplazo de pantalla y digitalizador, reparación de puerto de carga, diagnóstico de backlight y del IC de carga, y microsoldadura a nivel de placa para iPad — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para iPad",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de iPad",
        items: {
          screenLcd: "Reparación de pantalla y LCD",
          digitizer: "Cambio de digitalizador",
          crackedGlass: "Reparación de vidrio roto",
          chargingPort: "Reparación de puerto de carga",
          notCharging: "El iPad no carga",
          noPower: "No enciende",
          backlight: "Reparación de backlight",
          chargingIcDiagnostics: "Diagnóstico del IC de carga",
          motherboard: "Reparación de placa base y a nivel de placa",
          microsoldering: "Microsoldadura",
          liquidDamage: "Evaluación de daño por líquido",
          dataRecovery: "Evaluación de recuperación de datos",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de iPad que Diagnosticamos",
        items: {
          crackedScreenOrGlass: "Pantalla o vidrio roto",
          wontCharge: "No carga",
          wontTurnOn: "No enciende",
          dimOrNoDisplay: "Pantalla tenue, parpadeante o sin imagen",
          exposedToLiquid: "Expuesto a agua o líquido",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — iPad",
        lcdVsDigitizer: {
          question: "¿Cuál es la diferencia entre un digitalizador roto y un LCD dañado?",
          answer:
            "El digitalizador es la capa de vidrio táctil sobre la pantalla; el LCD es la pantalla debajo de esa capa. A veces un digitalizador roto se puede reemplazar por separado, pero si el LCD también está dañado, ambos deben reemplazarse juntos — confirmamos cuál aplica a tu iPad durante la inspección.",
        },
        chargingPort: {
          question: "¿Pueden reparar el puerto de carga de un iPad?",
          answer: "Sí, la reparación de puerto de carga es uno de nuestros servicios de iPad más comunes.",
        },
        backlight: {
          question: "¿Reparan problemas de backlight en iPad?",
          answer: "Sí — un backlight tenue, parpadeante o ausente se diagnostica y repara como parte de nuestro servicio de iPad.",
        },
        noPower: {
          question: "¿Trabajan con iPads que no encienden en absoluto?",
          answer: "Sí. Diagnosticamos la placa y el circuito de carga para determinar la causa antes de recomendar una reparación.",
        },
        approval: {
          question: "¿Necesito aprobar la reparación primero?",
          answer: "Sí. Nunca comenzamos una reparación ni cobramos sin tu aprobación primero.",
        },
      },
      related: { title: "Servicios Relacionados" },
      finalCta: {
        title: "¿Listo para Reparar tu iPad?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
    xboxRepairPage: {
      seo: {
        title: "Reparación de Xbox en Miami | HDMI y No Enciende (Series X/S)",
        description:
          "Reparación profesional de Xbox Series X y Series S en Miami y Kendall. HDMI, sin imagen, apagado inesperado, sobrecalentamiento y diagnóstico de no enciende.",
      },
      breadcrumbLabel: "Reparación de Xbox Miami",
      hero: {
        eyebrow: "Reparación de Xbox — Miami y Kendall",
        h1: "Reparación de Xbox en Miami",
        summary:
          "Reparación de puerto HDMI, sin imagen, apagados inesperados, sobrecalentamiento y diagnóstico de no enciende para Xbox Series X y Series S — servimos Miami y Kendall.",
        ctaLabel: "Solicitar estimado para Xbox",
        note: "Estimado gratis y sin compromiso — algunos daños requieren inspección física antes de confirmar el precio final.",
      },
      services: {
        eyebrow: "Servicios",
        title: "Servicios de Reparación de Xbox",
        items: {
          hdmiPort: "Reparación de puerto HDMI",
          noDisplay: "Sin imagen / no muestra video",
          hdmiCircuit: "Circuito HDMI dañado",
          unexpectedShutdown: "La consola se apaga inesperadamente",
          overheatingCleaning: "Diagnóstico de sobrecalentamiento y limpieza interna",
          noPower: "No enciende",
          motherboardDiagnostics: "Diagnóstico de placa base",
          boardLevelRepair: "Reparación a nivel de placa",
        },
      },
      issues: {
        eyebrow: "Problemas Comunes",
        title: "Problemas Comunes de Xbox que Diagnosticamos",
        items: {
          noImageOnScreen: "Sin imagen en el televisor",
          shutsOffUnexpectedly: "Se apaga inesperadamente",
          wontPowerOn: "No enciende",
          overheatsQuickly: "Se sobrecalienta rápidamente",
        },
      },
      faq: {
        title: "Preguntas Frecuentes — Xbox",
        seriesXAndS: {
          question: "¿Reparan tanto Xbox Series X como Series S?",
          answer: "Sí, trabajamos tanto con Xbox Series X como con Xbox Series S.",
        },
        hdmiPort: {
          question: "¿Pueden reparar un puerto HDMI dañado de Xbox?",
          answer: "Sí, la reparación de puerto HDMI es uno de nuestros servicios principales para Xbox.",
        },
        noDisplay: {
          question: "¿Reparan una Xbox sin imagen?",
          answer: "Sí, los problemas de sin imagen son uno de los problemas de consola que diagnosticamos y reparamos.",
        },
        unexpectedShutdown: {
          question: "¿Por qué mi Xbox se apaga inesperadamente?",
          answer:
            "Un apagado inesperado puede tener varias causas, incluyendo sobrecalentamiento o problemas de alimentación — diagnosticamos la consola para encontrar la causa específica.",
        },
        noPower: {
          question: "¿Pueden diagnosticar una Xbox que no enciende?",
          answer: "Sí, hacemos un diagnóstico completo a nivel de placa en consolas que no encienden.",
        },
        estimateAuthorization: {
          question: "¿Solicitar un estimado autoriza la reparación?",
          answer: "No. Solicitar un estimado es gratis y sin compromiso — no autoriza ninguna reparación ni cargo.",
        },
      },
      related: { title: "Servicios Relacionados" },
      finalCta: {
        title: "¿Listo para Reparar tu Xbox?",
        body: "Solicita un estimado gratis y sin compromiso, y te contactaremos con los próximos pasos.",
      },
    },
  },
};
