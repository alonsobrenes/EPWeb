// src/data/countriesIso2.js
// Lista focalizada (LATAM + algunos frecuentes). Si quieres el listado completo, te lo paso en un archivo aparte.
export const countriesIso2 = [
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CR", name: "Costa Rica" },
  { code: "CU", name: "Cuba" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "SV", name: "El Salvador" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Perú" },
  { code: "PR", name: "Puerto Rico" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },

  // Frecuentes fuera de LATAM:
  { code: "US", name: "Estados Unidos" },
  { code: "CA", name: "Canadá" },
  { code: "ES", name: "España" },
  { code: "PT", name: "Portugal" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "GB", name: "Reino Unido" },
  { code: "IE", name: "Irlanda" },

  // Centroamérica adicionales
  { code: "BZ", name: "Belice" },
  { code: "JM", name: "Jamaica" },
  { code: "TT", name: "Trinidad y Tobago" },

  // Otros comunes:
  { code: "NL", name: "Países Bajos" },
  { code: "SE", name: "Suecia" },
  { code: "NO", name: "Noruega" },
  { code: "DK", name: "Dinamarca" },
  { code: "CH", name: "Suiza" },
]

// Pequeña utilidad: convierte ISO2 → bandera emoji
export function flagEmojiFromISO2(code) {
  const c = String(code || "").toUpperCase()
  if (c.length !== 2) return "🏳️"
  const A = 0x1F1E6
  const a = "A".charCodeAt(0)
  const chars = [...c].map(ch => String.fromCodePoint(A + (ch.charCodeAt(0) - a)))
  return chars.join("")
}
