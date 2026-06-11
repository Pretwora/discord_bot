import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function useSocket(onEvent) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!socket) {
      socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
        withCredentials: true,
      });
    }

    const handler = (event, data) => cbRef.current?.(event, data);
    socket.onAny(handler);
    return () => socket.offAny(handler);
  }, []);

  return socket;
}
