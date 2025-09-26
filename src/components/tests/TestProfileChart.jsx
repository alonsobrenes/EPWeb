import React, { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

/**
 * Etiqueta del eje X con rotación y tamaño reducido.
 * También corta visualmente las muy largas; el texto completo
 * se ve en el Tooltip del gráfico.
 */
function RotatedTick(props) {
  const { x = 0, y = 0, payload } = props
  const label = String(payload?.value ?? "")

  
  // Truncado visual (el tooltip muestra el nombre completo)
  const MAX_CHARS = 18
  const short =
    label.length > MAX_CHARS ? label.slice(0, MAX_CHARS - 1) + "…" : label

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor="end"
        transform="rotate(-35)"
        fontSize={11}
        fill="#334155" // slate-700
      >
        {short}
      </text>
    </g>
  )
}

/**
 * Tooltip con el nombre completo y el valor ya formateado.
 */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]
  const value = typeof p.value === "number" ? p.value.toFixed(2) : p.value
  const fullName = p.payload?.fullName || label

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: "8px 10px",
        boxShadow:
          "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
        {fullName}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}%</div>
    </div>
  )
}

/**
 * TestProfileChart
 * Espera `scales` con objetos del tipo:
 * { code, name, raw, min, max, percent }
 * Si `percent` no viene, se calcula (raw - min) / (max - min) * 100 con clamps.
 */
export default function TestProfileChart({ scales }) {
  if (!Array.isArray(scales) || scales.length === 0) return null

  const data = useMemo(() => {
    return (scales || []).map((s) => {
      // Valor de 0 a 100: usa percent si viene, si no lo calcula.
      let value = typeof s.percent === "number"
        ? s.percent
        : (() => {
            const raw = Number(s.raw ?? 0)
            const min = Number(s.min ?? 0)
            const max = Number(s.max ?? 0)
            const denom = Math.max(max - min, 0)
            if (denom <= 0) return 0
            const pct = ((raw - min) / denom) * 100
            return Math.max(0, Math.min(100, pct))
          })()

      // Etiqueta base: code si existe; si no, name
      const label = s.scaleCode || s.scaleName || ""

      return {
        label,
        fullName: s.scaleName || label,
        value,
      }
    })
  }, [scales])

  
  // Paleta discreta simple; puedes cambiarla si lo prefieres
  const barColor = "#0ea5e9" // sky-500

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 16,
            left: 8,
            bottom: 60, // espacio extra para las etiquetas rotadas
          }}
        >
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            interval={0}          // muestra todas las etiquetas
            height={60}           // espacio para la rotación
            tick={<RotatedTick />} // tick custom rotado
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "#94a3b8" }}
            tickLine={{ stroke: "#cbd5e1" }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            dataKey="value"
            fill={barColor}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
