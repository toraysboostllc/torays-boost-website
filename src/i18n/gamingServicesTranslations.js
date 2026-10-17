/**
 * Copy for Home's "Consoles & Controllers" section (GamingServices.jsx),
 * merged into translations.js as `gamingServices`. Both languages must keep
 * the exact same key shape — gamingServices.test.js checks it.
 *
 * Content rules (approved 2026-10-17):
 *  - no prices anywhere: "Estimate after diagnosis" only;
 *  - thermal paste / liquid metal are "when needed" / "per diagnosis", never
 *    presented as required for every console;
 *  - maintenance never promises to fix every fault and sets no mandatory
 *    interval;
 *  - no testimonials, certifications or warranties;
 *  - no postal address and no free-shipping promise in the mail-in block.
 */
export const gamingServicesTranslations = {
  en: {
    eyebrow: "Consoles & Controllers",
    title: "Gaming Repair & Maintenance",
    subtitle:
      "PlayStation and Xbox consoles and controllers, repaired and maintained on our bench. Model compatibility and the repair itself are always confirmed after we inspect and diagnose your device.",
    estimateBadge: "Estimate after diagnosis",
    ctaRepair: "Request a repair quote",
    ctaMaintenance: "Request a maintenance quote",
    illustrative: "Illustrative image",
    controllers: {
      title: "PS5, PS4 & Xbox Controllers",
      intro: "From worn batteries to stick drift, we repair the parts of your controller that wear out the most.",
      mediaAlt: "Illustrative animation of a white wireless game controller on a light studio surface.",
      note: "Compatibility and the repair are confirmed after we check your controller's model and diagnose it.",
      items: {
        battery: {
          title: "Battery replacement",
          description: "For controllers that drain fast, won't hold a charge or shut off on their own.",
        },
        drift: {
          title: "Stick drift repair",
          description: "When your character or camera moves without you touching the stick.",
        },
        joysticks: {
          title: "Joystick replacement & TMR upgrade",
          description:
            "We replace worn joysticks and, on compatible models, install TMR joysticks — magnetic, contactless sensors without the resistive tracks that wear out in traditional sticks.",
        },
        buttons: {
          title: "Buttons & triggers",
          description: "Sticky, unresponsive or broken buttons, bumpers and triggers.",
        },
        chargingPort: {
          title: "Charging port & connection",
          description: "Loose or damaged charging ports, controllers that won't charge, and pairing or connection problems.",
        },
      },
    },
    consoles: {
      title: "PlayStation & Xbox Console Repair",
      intro: "Diagnosis and repair for the most common console faults, down to the board level.",
      mediaAlt: "Illustrative animation of a white PlayStation-style console and a black Xbox-style console on a repair bench.",
      note: "Every console is diagnosed first; we confirm the repair before doing any work.",
      items: {
        power: {
          title: "Power problems",
          description: "Consoles that won't turn on, turn off by themselves or get stuck on startup.",
        },
        hdmi: {
          title: "No image / HDMI",
          description: "No video on the TV, flickering picture or a damaged HDMI port.",
        },
        charging: {
          title: "Power supply & charging",
          description: "Internal power supply faults and USB ports that no longer charge your controllers.",
        },
        performance: {
          title: "General operation",
          description: "Overheating, unusual noises, disc drive faults and errors during use.",
        },
      },
    },
    maintenance: {
      title: "Preventive Maintenance — Deep Cleaning",
      intro: "A deep internal cleaning and a check of the cooling system for your PlayStation or Xbox.",
      mediaAlt: "Gloved technician brushing dust off the fan of an opened game console.",
      whyTitle: "Why preventive maintenance?",
      why:
        "Built-up dust makes ventilation harder and can raise your console's temperature and noise. A deep cleaning and a check of the cooling system help keep it running properly and help spot early signs of wear. If you notice very loud fans, excessive heat or unexpected shutdowns, contact us for an evaluation.",
      note: "Thermal paste and liquid metal are only serviced when the diagnosis calls for it — not every console needs them.",
      quoteDetails: "Preventive maintenance / Deep Cleaning",
      items: {
        dust: {
          title: "Internal dust & dirt cleaning",
          description: "We open the console and remove the dust and dirt built up inside.",
        },
        fans: {
          title: "Fans, heatsinks & air ducts",
          description: "Cleaning of the fan, heatsink fins and ventilation paths so air can flow freely.",
        },
        cooling: {
          title: "Cooling system check",
          description: "We check that the cooling system is working properly and look for signs of wear.",
        },
        thermalPaste: {
          title: "Thermal paste replacement, when needed",
          description: "Applied only when the diagnosis shows the existing paste needs renewing.",
        },
        liquidMetal: {
          title: "Liquid metal service, on models that use it",
          description: "Inspection and maintenance of the liquid metal on consoles that ship with it, based on diagnosis.",
        },
      },
      liquidMetal: {
        title: "Professional liquid metal, 130 W/m·K*",
        body:
          "Some consoles, like the PS5, ship with liquid metal between the processor and the heatsink. When diagnosis shows it needs renewing, we use professional liquid metal rated up to 130 W/m·K of thermal conductivity — compared with roughly 5–15 W/m·K for typical thermal paste. It's applied with proper protection around the chip, because liquid metal is electrically conductive and demands precise work.",
        footnote: "*Manufacturer-rated value. Results depend on the console model and its condition.",
      },
    },
    mailIn: {
      eyebrow: "Mail-in service",
      title: "We accept devices by mail",
      body:
        "Can't come to the shop? We accept controllers and consoles by mail for repair and maintenance. Contact us before shipping your device to coordinate the service and receive the shipping instructions.",
      cta: "Coordinate shipping on WhatsApp",
      whatsappMessage:
        "Hi! I'd like to send my device by mail for repair or maintenance. Device and model: ___ . Problem or service: ___ .",
      stepsTitle: "How it works",
      steps: {
        contact: {
          title: "Message us on WhatsApp",
          description: "Tell us the device, its model and the problem or service you need.",
        },
        address: {
          title: "Get the shipping address",
          description: "We reply with our address and the instructions to ship your device.",
        },
        ship: {
          title: "Ship your device",
          description: "Pack it well and send it with the carrier of your choice. Share the tracking number with us.",
        },
        repair: {
          title: "Diagnosis and estimate",
          description: "We diagnose it and send you the estimate. Once you approve it, we do the work and ship it back to you.",
        },
      },
    },
  },
  es: {
    eyebrow: "Consolas y controles",
    title: "Reparación y mantenimiento gamer",
    subtitle:
      "Consolas y controles PlayStation y Xbox, reparados y mantenidos en nuestro taller. La compatibilidad del modelo y la reparación siempre se confirman después de revisar y diagnosticar tu equipo.",
    estimateBadge: "Presupuesto tras diagnóstico",
    ctaRepair: "Cotizar reparación",
    ctaMaintenance: "Cotizar mantenimiento",
    illustrative: "Imagen ilustrativa",
    controllers: {
      title: "Controles PS5, PS4 y Xbox",
      intro: "Desde baterías gastadas hasta drift, reparamos las piezas del control que más se desgastan.",
      mediaAlt: "Animación ilustrativa de un control inalámbrico blanco sobre una superficie clara de estudio.",
      note: "La compatibilidad y la reparación se confirman después de revisar el modelo y diagnosticar tu control.",
      items: {
        battery: {
          title: "Cambio de batería",
          description: "Para controles que se descargan rápido, no mantienen la carga o se apagan solos.",
        },
        drift: {
          title: "Reparación de drift",
          description: "Cuando el personaje o la cámara se mueven sin que toques el joystick.",
        },
        joysticks: {
          title: "Reemplazo de joysticks y joysticks TMR",
          description:
            "Reemplazamos joysticks desgastados y, en modelos compatibles, instalamos joysticks TMR: sensores magnéticos sin contacto, sin las pistas resistivas que se desgastan en los joysticks tradicionales.",
        },
        buttons: {
          title: "Botones y gatillos",
          description: "Botones, bumpers y gatillos pegajosos, que no responden o están rotos.",
        },
        chargingPort: {
          title: "Puerto de carga y conexión",
          description: "Puertos de carga flojos o dañados, controles que no cargan y problemas de conexión o emparejamiento.",
        },
      },
    },
    consoles: {
      title: "Reparación de consolas PlayStation y Xbox",
      intro: "Diagnóstico y reparación de las fallas más comunes en consolas, hasta nivel de placa.",
      mediaAlt: "Animación ilustrativa de una consola blanca estilo PlayStation y una negra estilo Xbox sobre un banco de reparación.",
      note: "Primero diagnosticamos cada consola y confirmamos la reparación antes de hacer cualquier trabajo.",
      items: {
        power: {
          title: "Problemas de encendido",
          description: "Consolas que no encienden, se apagan solas o se quedan trabadas al arrancar.",
        },
        hdmi: {
          title: "Sin imagen / HDMI",
          description: "Sin video en el TV, imagen que parpadea o puerto HDMI dañado.",
        },
        charging: {
          title: "Fuente de poder y carga",
          description: "Fallas de la fuente interna y puertos USB que ya no cargan tus controles.",
        },
        performance: {
          title: "Funcionamiento general",
          description: "Sobrecalentamiento, ruidos extraños, fallas del lector de discos y errores durante el uso.",
        },
      },
    },
    maintenance: {
      title: "Mantenimiento preventivo — Deep Cleaning",
      intro: "Limpieza interna profunda y revisión del sistema de refrigeración de tu PlayStation o Xbox.",
      mediaAlt: "Técnico con guantes limpiando con un pincel el ventilador de una consola abierta.",
      whyTitle: "¿Por qué hacer mantenimiento preventivo?",
      why:
        "El polvo acumulado dificulta la ventilación y puede aumentar la temperatura y el ruido de tu consola. Una limpieza profunda y la revisión del sistema de refrigeración ayudan a mantener su funcionamiento adecuado y a detectar señales de desgaste. Si notas ventiladores muy ruidosos, exceso de calor o apagados inesperados, contáctanos para una evaluación.",
      note: "La pasta térmica y el metal líquido solo se cambian cuando el diagnóstico lo indica; no todas las consolas los necesitan.",
      quoteDetails: "Mantenimiento preventivo / Deep Cleaning",
      items: {
        dust: {
          title: "Limpieza interna de polvo y suciedad",
          description: "Abrimos la consola y retiramos el polvo y la suciedad acumulados por dentro.",
        },
        fans: {
          title: "Ventiladores, disipadores y conductos",
          description: "Limpieza del ventilador, las aletas del disipador y los conductos de ventilación para que el aire circule bien.",
        },
        cooling: {
          title: "Revisión del sistema de refrigeración",
          description: "Comprobamos que la refrigeración funcione correctamente y buscamos señales de desgaste.",
        },
        thermalPaste: {
          title: "Cambio de pasta térmica, cuando corresponda",
          description: "Solo cuando el diagnóstico muestra que la pasta existente necesita renovarse.",
        },
        liquidMetal: {
          title: "Metal líquido, en los modelos que lo usan",
          description: "Revisión y mantenimiento del metal líquido en las consolas que lo traen de fábrica, según diagnóstico.",
        },
      },
      liquidMetal: {
        title: "Metal líquido profesional de 130 W/m·K*",
        body:
          "Algunas consolas, como la PS5, usan metal líquido de fábrica entre el procesador y el disipador. Cuando el diagnóstico indica que hace falta renovarlo, usamos metal líquido profesional con una conductividad térmica de hasta 130 W/m·K; una pasta térmica común suele estar entre 5 y 15 W/m·K. Lo aplicamos con la protección adecuada alrededor del chip, porque el metal líquido conduce electricidad y requiere una aplicación precisa.",
        footnote: "*Valor indicado por el fabricante. El resultado depende del modelo y del estado de la consola.",
      },
    },
    mailIn: {
      eyebrow: "Servicio por correo",
      title: "Recibimos equipos por correo postal",
      body:
        "¿No puedes venir al local? Recibimos controles y consolas por correo para reparación y mantenimiento. Contáctanos antes de enviar tu equipo para coordinar el servicio y recibir las instrucciones de envío.",
      cta: "Coordinar envío por WhatsApp",
      whatsappMessage:
        "¡Hola! Quiero enviar mi equipo por correo para reparación o mantenimiento. Equipo y modelo: ___ . Problema o servicio: ___ .",
      stepsTitle: "Cómo funciona",
      steps: {
        contact: {
          title: "Escríbenos por WhatsApp",
          description: "Cuéntanos qué equipo es, el modelo y la falla o el servicio que necesitas.",
        },
        address: {
          title: "Recibe la dirección de envío",
          description: "Te respondemos con nuestra dirección y las instrucciones para enviar tu equipo.",
        },
        ship: {
          title: "Envía tu equipo",
          description: "Empácalo bien y envíalo con la transportadora que prefieras. Compártenos el número de rastreo.",
        },
        repair: {
          title: "Diagnóstico y presupuesto",
          description: "Lo diagnosticamos y te enviamos el presupuesto. Cuando lo apruebas, hacemos el trabajo y te lo enviamos de vuelta.",
        },
      },
    },
  },
};
