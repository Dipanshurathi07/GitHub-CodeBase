const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL
const productionBackendUrl = 'https://githubcodebasebackend-web11whb.b4a.run'

export const API_BASE_URL = (configuredBackendUrl || (import.meta.env.PROD ? productionBackendUrl : '')).replace(/\/$/, '')

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
