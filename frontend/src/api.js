import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? "/api" : "http://127.0.0.1:5022/api");

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
