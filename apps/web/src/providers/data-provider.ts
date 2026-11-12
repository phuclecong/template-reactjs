import axios from "axios"
import simpleRestDataProvider from "@refinedev/simple-rest"
import { apiUrl } from "@/utils/api-url"
import { getAuthToken } from "./auth-provider"

/**
 * Refine dataProvider (ADR-0002, ADR-0005). The base URL resolves via
 * `@/utils/api-url` — the real backend when `VITE_API_URL` is set, otherwise
 * the `/api` path served by the in-browser MSW worker. A request interceptor
 * attaches the in-memory access token so the backend resolves the caller.
 */
const httpClient = axios.create()

httpClient.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const dataProvider = simpleRestDataProvider(apiUrl, httpClient)
