import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { playMessageSound } from '../utils/sounds';
import useDraggable from '../hooks/useDraggable';

// Cost centers can only message Nurse and Billing. Admin is read-only.
const CONTACTS = ['Nurse', 'Billing'];
const ADMIN_CONTACT = 'Admin';

export default function CostCenterChatBox({ sender }) {
  const [open, setOpen]               = useState(false);
  const [view, setView]               = useState('list'); // 'list' | 'chat'
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [unread, setUnread]           = useState({});
  const messagesEndRef                = useRef(null);
  const pollRef                       = useRef(null);
  const containerRef                  = useRef(null);
  const { fabStyle, chatStyle, onMouseDown } = useDraggable();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevTotalRef = useRef(0);
  const prevUnreadRef = useRef({});
  const [recentOrder, setRecentOrder] = useState([]);

  // Poll unread counts
  const fetchUnread = useCallback(() => {
    api.get(`/chat_messages.php?action=unread&me=${encodeURIComponent(sender)}`)
      .then(res => {
        const data = res.data || {};
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (total > prevTotalRef.current) playMessageSound();
        const withUnread = Object.keys(data).filter(k => (data[k] || 0) > 0 && (data[k] || 0) >= (prevUnreadRef.current[k] || 0));
        if (withUnread.length > 0) {
          setRecentOrder(prev => {
            const newOnes = withUnread.filter(s => !prev.includes(s));
            return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
          });
        }
        prevTotalRef.current = total;
        prevUnreadRef.current = data;
        setUnread(data);
      })
      .catch(() => {});
  }, [sender]);

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 5000);
    return () => clearInterval(t);
  }, [fetchUnread]);

  // Poll messages in open conversation
  const fetchMessages = useCallback(() => {
    if (!selectedContact) return;
    api.get(`/chat_messages.php?action=list&me=${encodeURIComponent(sender)}&other=${encodeURIComponent(selectedContact)}`)
      .then(res => setMessages(res.data || []))
      .catch(() => {});
  }, [sender, selectedContact]);

  useEffect(() => {
    if (view !== 'chat' || !selectedContact) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    api.post('/chat_messages.php?action=read', { me: sender, other: selectedContact }).catch(() => {});
    setUnread(prev => { const next = { ...prev }; delete next[selectedContact]; return next; });
    return () => clearInterval(pollRef.current);
  }, [view, selectedContact, fetchMessages, sender]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChat = (contact) => {
    setSelectedContact(contact);
    setMessages([]);
    setView('chat');
    setUnread(prev => { const n = { ...prev }; delete n[contact]; return n; });
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedContact) return;
    const msg = input;
    setInput('');
    setSending(true);
    try {
      await api.post('/chat_messages.php?action=send', {
        sender,
        recipient: selectedContact,
        message: msg.trim(),
      });
      fetchMessages();
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const fmt = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div ref={containerRef} className="z-[99999]">
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '420px', ...chatStyle() }}>
          {/* Header */}
          <div className="bg-emerald-700 px-4 py-3 flex items-center gap-2 cursor-move select-none" data-drag="1" onMouseDown={onMouseDown}>
            {view === 'chat' && (
              <button onClick={() => { setView('list'); setSelectedContact(null); }}
                className="text-white/70 hover:text-white mr-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {view === 'list' ? 'Messages' : selectedContact}
              </p>
              {view === 'list' && (
                <p className="text-emerald-300 text-xs">Nurse & Billing</p>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contact list */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              {/* Admin — read-only */}
              {(() => {
                const adminUnread = unread['Admin'] || 0;
                return (
                  <button onClick={() => openChat('Admin')}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 bg-amber-50/50">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-emerald-800">A</span>
                      </div>
                      {adminUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {adminUnread > 9 ? '9+' : adminUnread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Admin</p>
                      <p className="text-xs text-amber-600 font-medium">Announcements</p>
                    </div>
                    {adminUnread > 0 && (
                      <span className="text-xs font-bold text-red-500">{adminUnread} new</span>
                    )}
                  </button>
                );
              })()}
              {[...CONTACTS].sort((a, b) => {
                const ra = recentOrder.indexOf(a);
                const rb = recentOrder.indexOf(b);
                if (ra !== -1 && rb !== -1) return ra - rb;
                if (ra !== -1) return -1;
                if (rb !== -1) return 1;
                return 0;
              }).map(contact => {
                const uUnread = unread[contact] || 0;
                return (
                  <button key={contact} onClick={() => openChat(contact)}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${contact === 'Nurse' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                        <span className={`text-sm font-bold ${contact === 'Nurse' ? 'text-blue-700' : 'text-amber-700'}`}>
                          {contact[0]}
                        </span>
                      </div>
                      {uUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {uUnread > 9 ? '9+' : uUnread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{contact}</p>
                      <p className="text-xs text-gray-400">Station</p>
                    </div>
                    {uUnread > 0 && (
                      <span className="text-xs font-bold text-red-500">{uUnread} new</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Chat view */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-gray-50">
                {selectedContact === 'Admin' && (
                  <div className="text-center mb-1">
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                      Admin announcements — read only
                    </span>
                  </div>
                )}
                {messages.length === 0 && (
                  <p className="text-center text-gray-300 text-xs mt-8">No messages yet.</p>
                )}
                {messages.map((m, idx) => {
                  const isMine = m.sender === sender;
                  const isLastMine = isMine && messages.slice(idx + 1).every(x => x.sender !== sender);
                  return (
                    <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${isMine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold text-emerald-600 mb-0.5">{m.sender}</p>
                        )}
                        <p>{m.message}</p>
                        <p className={`text-[10px] mt-0.5 ${isMine ? 'text-emerald-200' : 'text-gray-400'} text-right`}>{fmt(m.created_at)}</p>
                      </div>
                      {isMine && isLastMine && (
                        <MessageStatus delivered={m.is_delivered} seen={m.is_seen} />
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {selectedContact !== 'Admin' && (
                <div className="px-3 py-2 border-t border-gray-100 flex gap-2 bg-white">
                  <input type="text" value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={`Message ${selectedContact}...`}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button onClick={handleSend} disabled={sending || !input.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(v => !v)} onMouseDown={onMouseDown}
        style={fabStyle}
        className="w-14 h-14 bg-emerald-700 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 relative cursor-grab active:cursor-grabbing">
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>,
    document.body
  );
}

function MessageStatus({ delivered, seen }) {
  if (seen) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-blue-400 mt-0.5 mr-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>
        Seen
      </span>
    );
  }
  if (delivered) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-gray-400 mt-0.5 mr-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>
        Delivered
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-300 mt-0.5 mr-0.5">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      Sent
    </span>
  );
}
