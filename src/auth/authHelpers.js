// src/utils/authHelpers.js
const MIN_PASSWORD = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getPasswordStrength(pwd) {
  let score = 0
  const lengthOK = pwd.length >= MIN_PASSWORD
  const hasUpper = /[A-Z]/.test(pwd)
  const hasNumber = /\d/.test(pwd)
  if (lengthOK) score++
  if (hasUpper) score++
  if (hasNumber) score++

  const percent = (score / 3) * 100
  const label = score === 0 ? "Muy débil" : score === 1 ? "Débil" : score === 2 ? "Media" : "Fuerte"
  const color = score <= 1 ? "red.500" : score === 2 ? "yellow.500" : "green.500"
  return { score, percent, label, color }
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!email?.trim()) errors.email = "Ingresa tu correo."
  else if (!EMAIL_RE.test(email)) errors.email = "Correo inválido."

  if (!password) errors.password = "Ingresa tu contraseña."

  const firstInvalid = errors.email ? "email" : (errors.password ? "password" : null)
  return { errors, isValid: Object.keys(errors).length === 0, firstInvalid }
}

export function validateSignup({ email, password, confirmPassword, enforceComplexity = true }) {
  const errors = {}
  if (!email?.trim()) errors.email = "Ingresa tu correo."
  else if (!EMAIL_RE.test(email)) errors.email = "Correo inválido."

  if (!password) {
    errors.password = "Ingresa tu contraseña."
  } else if (password.length < MIN_PASSWORD) {
    errors.password = `Mínimo ${MIN_PASSWORD} caracteres.`
  } else if (enforceComplexity) {
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    if (!hasUpper || !hasNumber) {
      errors.password = "Incluye al menos una mayúscula y un número."
    }
  }

  if (!confirmPassword) {
    errors.confirm = "Confirma tu contraseña."
  } else if (confirmPassword !== password) {
    errors.confirm = "Las contraseñas no coinciden."
  }

  const firstInvalid = errors.email ? "email" : errors.password ? "password" : errors.confirm ? "confirm" : null
  return { errors, isValid: Object.keys(errors).length === 0, firstInvalid }
}

// opcional por si quieres reutilizarlo en otras partes
export { MIN_PASSWORD }
