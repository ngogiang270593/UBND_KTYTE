import axios from "axios";

const defaultApiBaseUrl = import.meta.env.MODE === "web"
  ? "http://127.0.0.1:5023/api"
  : (import.meta.env.DEV ? "/api" : "http://127.0.0.1:5022/api");

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
