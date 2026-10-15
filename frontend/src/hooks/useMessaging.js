import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/messagingApi';
import useMessageSocket from './useMessageSocket';

export function uniqueMessages(messages) {
  return [...new Map(messages.map(message => [message.id, message])).values()]
    .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
}

export default function useMessaging(id) {
  const [conversations, setConversations] = useState([]);
  const [thread, setThread] = useState({ id: null, conversation: null, messages: [] });
  const [drafts, setDrafts] = useState({});
  const [listLoading, setListLoading] = useState(true);
  const [loading, setLoading] = useState(Boolean(id));
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentVersion, setSentVersion] = useState(0);
  const mounted = useRef(false);
  const selected = useRef(id);
  selected.current = id;
  const revision = useRef(0);
  const sendingRef = useRef(false);
  const listWork = useRef(null);
  const queued = useRef(false);

  const refreshList = useCallback(() => {
    if (listWork.current) { queued.current = true; return listWork.current; }
    const work = (async () => {
      do {
        queued.current = false;
        try {
          const data = await api.getConversations();
          if (mounted.current) { setConversations(data); setListError(''); }
        } catch { if (mounted.current) setListError('Could not load conversations. Try refreshing.'); }
        finally { if (mounted.current) setListLoading(false); }
      } while (queued.current && mounted.current);
    })();
    listWork.current = work;
    void work.finally(() => { listWork.current = null; });
    return work;
  }, []);

  // Serialize event refreshes; a queued refresh recovers events received mid-request.
  const threadWork = useRef(null);
  const threadQueued = useRef(false);
  const refreshThread = useCallback(async () => {
    if (threadWork.current) { threadQueued.current = true; return threadWork.current; }
    const work = (async () => {
      do {
        threadQueued.current = false;
        const current = selected.current;
        if (!current) break;
        const version = revision.current;
        try {
          const [conversation, messages] = await Promise.all([api.getConversation(current), api.getMessages(current)]);
          if (mounted.current && version === revision.current && selected.current === current) {
            setThread({ id: current, conversation, messages: uniqueMessages(messages) });
            setError('');
          }
        } catch (err) {
          if (mounted.current && version === revision.current) setError(
            err.response?.status === 403 ? 'You cannot access this conversation.' :
              err.response?.status === 404 ? 'Conversation not found.' : 'Could not load this conversation. Try refreshing.');
        } finally {
          if (mounted.current && version === revision.current) setLoading(false);
        }
      } while (threadQueued.current && mounted.current);
    })();
    threadWork.current = work;
    try { await work; } finally { threadWork.current = null; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshList();
    return () => { mounted.current = false; revision.current++; };
  }, [refreshList]);

  useEffect(() => {
    revision.current++;
    setLoading(Boolean(id)); setError(''); setSendError('');
    if (id) void refreshThread();
  }, [id, refreshThread]);

  const refresh = useCallback(() => { void refreshList(); void refreshThread(); }, [refreshList, refreshThread]);
  const connection = useMessageSocket(event => {
    void refreshList();
    if (event.conversationId === selected.current) void refreshThread();
  }, refresh);

  const visibleThread = thread.id === id ? thread : { conversation: null, messages: [] };
  // Effects run after the thread is committed to the page. Never mark a hidden page read.
  useEffect(() => {
    if (thread.id !== id || !id || !thread.conversation) return;
    let cancelled = false;
    const read = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!thread.messages.some(message => message.senderId !== thread.conversation.currentUserId && !message.readAt)) return;
      const unreadIds = new Set(thread.messages.filter(message => message.senderId !== thread.conversation.currentUserId && !message.readAt).map(message => message.id));
      try {
        await api.markRead(id);
        if (!cancelled && mounted.current) {
          setThread(previous => previous.id !== id ? previous : { ...previous, messages: previous.messages.map(message =>
            unreadIds.has(message.id) ? { ...message, readAt: new Date().toISOString() } : message) });
          void refreshList();
        }
      } catch { /* A later refresh can retry read acknowledgement. */ }
    };
    void read();
    document.addEventListener('visibilitychange', read);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', read); };
  }, [id, thread, refreshList]);

  async function send() {
    const content = (drafts[id] || '').trim();
    if (!content || content.length > 5000 || sendingRef.current || !id) return;
    const current = id;
    const version = revision.current;
    sendingRef.current = true; setSending(true); setSendError('');
    try {
      const message = await api.sendMessage(current, content);
      if (!mounted.current) return;
      setDrafts(previous => ({ ...previous, [current]: '' }));
      if (version === revision.current) {
        setThread(previous => previous.id !== current ? previous : { ...previous, messages: uniqueMessages([...previous.messages, message]) });
        setSentVersion(previous => previous + 1);
      }
      void refreshList();
    } catch (err) {
      if (!mounted.current) return;
      if (!err.response || err.response.status >= 500) {
        await refreshThread();
        if (version === revision.current) setSendError('Delivery is uncertain. History has been refreshed; check for your message before sending again.');
      } else if (version === revision.current) setSendError('Message not sent. Your draft is still here. Please try again.');
    } finally { sendingRef.current = false; if (mounted.current) setSending(false); }
  }

  return { conversations, ...visibleThread, loading, listLoading, error, listError, sendError,
    draft: drafts[id] || '', setDraft: value => setDrafts(previous => ({ ...previous, [id]: value })),
    sending, sentVersion, send, refresh, connection };
}
