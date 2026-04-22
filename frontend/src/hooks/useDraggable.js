import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_RIGHT = 65;
const DEFAULT_BOTTOM = 20;
const FAB_SIZE = 56;
const CHAT_W = 320;
const CHAT_H = 460;
const Z = 99999;

export default function useDraggable() {
  // pos stores the FAB's top-left corner; null = use default bottom-right
  const [pos, setPos] = useState({ x: null, y: null });
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: null, y: null });

  const getFabPos = () => {
    if (posRef.current.x !== null) return posRef.current;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    return {
      x: vw - DEFAULT_RIGHT - FAB_SIZE,
      y: vh - DEFAULT_BOTTOM - FAB_SIZE,
    };
  };

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    moved.current = false;
    const cur = getFabPos();
    offset.current = { x: e.clientX - cur.x, y: e.clientY - cur.y };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      moved.current = true;
      const nx = e.clientX - offset.current.x;
      const ny = e.clientY - offset.current.y;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const maxX = vw - FAB_SIZE - 8;
      const maxY = vh - FAB_SIZE - 8;
      const clamped = { x: Math.max(8, Math.min(nx, maxX)), y: Math.max(8, Math.min(ny, maxY)) };
      posRef.current = clamped;
      setPos({ ...clamped });
    };

    const onUp = () => {
      dragging.current = false;
      if (moved.current) {
        const blockClick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          window.removeEventListener('click', blockClick, true);
        };
        window.addEventListener('click', blockClick, true);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // FAB style — fixed position
  const fabStyle = pos.x !== null
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto', zIndex: Z }
    : { position: 'fixed', bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT, zIndex: Z };

  // Chat window style — opens above and aligned to FAB
  const chatStyle = () => {
    const fab = getFabPos();
    const vw = document.documentElement.clientWidth;
    let left = fab.x + FAB_SIZE - CHAT_W;
    let top = fab.y - CHAT_H - 8;
    left = Math.max(8, Math.min(left, vw - CHAT_W - 8));
    top = Math.max(8, top);
    return { position: 'fixed', left, top, bottom: 'auto', right: 'auto', zIndex: Z };
  };

  return { fabStyle, chatStyle, onMouseDown };
}
