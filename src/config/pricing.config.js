// src/config/pricing.config.js
// Config estático de planes (sin llamadas a backend)
// Editá los valores aquí y la página /pricing se actualizará automáticamente.

const pricingConfig = {
  currency: "$",
  // Multiplicador anual (10 = 2 meses de ahorro como ejemplo)
  yearlyMultiplier: 10,
  monthly: [
    {
      name: "Starter",
      highlight: "Ideal para iniciar",
      price: 0, // si definís 0, el CTA debe invitar a crear cuenta (no "prueba gratis")
      features: [
        "X tests/mes",
        "Y entrevistas",
        "Z opiniones IA",
        "PDFs ilimitados",
        "1 usuario",
      ],
      ctaLabel: "Crear cuenta",
      ctaVariant: "solid",
      ctaTo: "/signup",
    },
    {
      name: "Clínica",
      highlight: "El más elegido",
      price: 29,
      features: [
        "2X tests/mes",
        "2Y entrevistas",
        "2Z opiniones IA",
        "PDFs ilimitados",
        "Hasta 5 usuarios",
        "Soporte priorizado",
      ],
      ctaLabel: "Hablar por WhatsApp",
      ctaVariant: "outline",
      ctaTo: "https://wa.me/###########",
      popular: true,
    },
    {
      name: "Institucional",
      highlight: "Centros educativos",
      price: 99,
      features: [
        "Límites altos",
        "Múltiples usuarios",
        "Acompañamiento",
        "Capacitaciones",
        "Soporte dedicado",
      ],
      ctaLabel: "Agendar demo",
      ctaVariant: "outline",
      ctaTo: "https://wa.me/###########",
    },
  ],
  // Comparativa simple (tabla)
  compare: [
    { label: "Tests por mes", values: ["X", "2X", "Alto"] },
    { label: "Entrevistas", values: ["Y", "2Y", "Alto"] },
    { label: "Opiniones IA", values: ["Z", "2Z", "Alto"] },
    { label: "PDFs", values: ["Ilimitados", "Ilimitados", "Ilimitados"] },
    { label: "Usuarios", values: ["1", "5", "Multiusuario"] },
    { label: "Soporte", values: ["Base", "Prioritario", "Dedicado"] },
  ],
}

export default pricingConfig
