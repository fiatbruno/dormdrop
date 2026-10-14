import { logout } from "../auth/session";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.sessionToken = token;
  }
  return config;
});

api.interceptors.response.use(response => response, error => {
  const { config, response } = error;
  if (response?.status === 401 && config?.sessionToken &&
      !/\/auth\/(login|register|verify|resend-verification)(?:[?/#]|$)/.test(config.url)) {
    logout(config.sessionToken);
  }
  return Promise.reject(error);
});

export default api;
