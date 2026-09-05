const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL
const productionBackendUrl = 'https://github-codebase.onrender.com/'

export const API_BASE_URL = (configuredBackendUrl || productionBackendUrl).replace(/\/$/, '')

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}
