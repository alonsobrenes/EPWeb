export function tryGetOrgId() {
  try {
    const fromWindow = (typeof window !== 'undefined' && window.EP_ORG_ID) ? String(window.EP_ORG_ID) : null
    const fromLS = (typeof window !== 'undefined') ? (localStorage.getItem('orgId') || localStorage.getItem('ORG_ID')) : null
    const fromSS = (typeof window !== 'undefined') ? (sessionStorage.getItem('orgId') || sessionStorage.getItem('ORG_ID')) : null
    const val = fromWindow || fromLS || fromSS
    return (val && /^[0-9a-fA-F-]{36}$/.test(val)) ? val : null
  } catch { return null }
}