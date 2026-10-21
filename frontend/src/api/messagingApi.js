import api from "./client";
const path = id => `/conversations/${encodeURIComponent(id)}`;
export const startConversation = async listingId => (await api.post('/conversations', { listingId })).data;
export const getConversations = async () => (await api.get('/conversations')).data;
export const getConversation = async id => (await api.get(path(id))).data;
export const getMessages = async id => (await api.get(`${path(id)}/messages`)).data;
export const sendMessage = async (id, content) => (await api.post(`${path(id)}/messages`, { content })).data;
export const markRead = async id => { await api.patch(`${path(id)}/read`); };
export function websocketUrl(base = api.defaults.baseURL) {
  const url = new URL(base, window.location.origin);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  url.search = '';
  url.hash = '';
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
