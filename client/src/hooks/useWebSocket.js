import { useState, useEffect, useCallback, useRef } from "react";

export function useWebSocket(url) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try { const d = JSON.parse(e.data); setMessages(prev => [d, ...prev].slice(0, 200)); } catch {}
      };
      ws.onclose = () => { setConnected(false); reconnectTimer.current = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    } catch { reconnectTimer.current = setTimeout(connect, 3000); }
  }, [url]);

  useEffect(() => { connect(); return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); }; }, [connect]);
  return { connected, messages };
}
