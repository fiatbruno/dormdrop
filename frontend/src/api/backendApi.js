import axios from 'axios'

// Create a new Axios API client object. Points to localhost:8080,
// which is where you backend will live by default if you are running
// it locally. Also sets request headers to specify JSON content,
// which is what we will be sending and receiving.
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  }
});

// Whenever we have an authentication token in our local storage,
// attach it to the request header.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
