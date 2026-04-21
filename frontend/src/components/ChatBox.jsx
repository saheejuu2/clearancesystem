import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { playMessageSound } from '../utils/sounds';

const COST_CENTERS = [
  'Nurse',
  'Billing',
  'Operating Room/Delivery Room',
  'Pulmonary Department (MSA)',
  'Hemodialysis Unit',
  'Newborn Screening',
  'Newborn Hearing Test',
  'Radiology',
  'Laboratory',
  'Bloodbank',
  'Pharmacy',
];

export default function ChatBox({ sender }) {
  const [open, setOpen]               = useState(false);
  const [view, setView]               = useState('list');   // 'list' | 'cc' | 'chat'
  const [selectedCC, setSelectedCC]   = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);  // { username, full_name, cost_center }
  const [ccUsers, setCcUsers]         = useState([]);
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [sending, setSending]         = useState(false);
  const [unread, setUnread]           = useState({});       // { sender: count }
  const [broadcastCC, setBroadcastCC] = useState(null);     // cost_center for broadcast
  const messagesEndRef                = useRef(null);
  const pollRef                       = useRef(null);

  const prevTotalRef = useRef(0);
  const prevUnreadRef = useRef({});
  const [recentOrder, setRecentOrder] = useState([]); // CCs with recent activity, most recent first

  // Poll unread counts
  const fetchUnread = useCallback(() => {
    api.get(`/chat_messages.php?action=unread&me=${encodeURIComponent(sender)}`)
      .then(res => {
        const data = res.data || {};
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (total > prevTotalRef.current) playMessageSound();
        // Any CC with unread messages gets added to recentOrder (stays there until page refresh)
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
    const t = setInterval(fetchUnread, 4000);
    return () => clearInterval(t);
  }, [fetchUnread]);

  // Poll messages in open conversation
  const fetchMessages = useCallback(() => {
    if (!selectedUser) return;
    api.get(`/chat_messages.php?action=list&me=${encodeURIComponent(sender)}&other=${encodeURIComponent(selectedUser.cost_center)}`)
      .then(res => setMessages(res.data || []))
      .catch(() => {});
  }, [sender, selectedUser]);

  useEffect(() => {
    if (view !== 'chat' || !selectedUser) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    // Mark read and update local unread state immediately
    api.post('/chat_messages.php?action=read', { me: sender, other: selectedUser.cost_center }).catch(() => {});
    setUnread(prev => { const next = { ...prev }; delete next[selectedUser.cost_center]; return next; });
    prevTotalRef.current = Math.max(0, prevTotalRef.current - 1);
    return () => clearInterval(pollRef.current);
  }, [view, selectedUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openCC = (cc) => {
    setSelectedUser({ cost_center: cc, full_name: cc });
    setMessages([]);
    setView('chat');
    setUnread(prev => { const next = { ...prev }; delete next[cc]; return next; });
  };

  const openChat = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setView('chat');
    setUnread(prev => {
      const next = { ...prev };
      delete next[user.cost_center];
      return next;
    });
  };

  const sendMessage = async (recipientCC, msg) => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post('/chat_messages.php?action=send', {
        sender,
        recipient: recipientCC,
        message: msg.trim(),
      });
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedUser) return;
    const msg = input;
    setInput('');
    await sendMessage(selectedUser.cost_center, msg);
    fetchMessages();
  };

  const handleBroadcastCC = async () => {
    if (!broadcastCC || !input.trim()) return;
    const msg = input;
    setInput('');
    setSending(true);
    try {
      // Send to the cost center as a whole (one message to the CC name)
      await api.post('/chat_messages.php?action=send', { sender, recipient: broadcastCC, message: msg }).catch(() => {});
    } finally { setSending(false); }
  };

  const handleBroadcastAll = async (msg) => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      // Broadcast to all cost centers by name
      const allCC = [...COST_CENTERS];
      await Promise.all(allCC.map(cc =>
        api.post('/chat_messages.php?action=send', { sender, recipient: cc, message: msg }).catch(() => {})
      ));
    } finally { setSending(false); }
  };

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const fmt = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-end gap-2">
      {/* Chat window */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '460px' }}>
          {/* Header */}
          <div className="bg-emerald-700 px-4 py-3 flex items-center gap-2">
            {view !== 'list' && (
              <button onClick={() => { setView('list'); setSelectedUser(null); }}
                className="text-white/70 hover:text-white mr-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {view === 'list' ? 'Messages' : view === 'cc' ? selectedCC : selectedUser?.full_name}
              </p>
              {view === 'chat' && (
                <p className="text-emerald-300 text-xs truncate">{selectedUser?.cost_center}</p>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cost center list */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              {/* Broadcast all */}
              <BroadcastAllRow sender={sender} onSend={handleBroadcastAll} sending={sending} />
              {/* Admin announcements — read only */}
              {(() => {
                const adminUnread = unread['Admin'] || 0;
                return (
                  <button onClick={() => { setSelectedUser({ full_name: 'Admin', cost_center: 'Admin' }); setMessages([]); setView('chat'); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-amber-100 bg-amber-50/40">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-800">A</span>
                      </div>
                      {adminUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {adminUnread > 9 ? '9+' : adminUnread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 font-semibold">Admin</span>
                      <p className="text-xs text-amber-600">Announcements</p>
                    </div>
                  </button>
                );
              })()}
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cost Centers</div>
              {COST_CENTERS.filter(cc => cc !== sender).sort((a, b) => {
                const ra = recentOrder.indexOf(a);
                const rb = recentOrder.indexOf(b);
                if (ra !== -1 && rb !== -1) return ra - rb;
                if (ra !== -1) return -1;
                if (rb !== -1) return 1;
                return 0; // keep original order for the rest
              }).map(cc => {
                const ccUnread = unread[cc] || 0;
                return (
                  <button key={cc} onClick={() => openCC(cc)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-emerald-700">{cc[0]}</span>
                      </div>
                      {ccUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {ccUnread > 9 ? '9+' : ccUnread}
                        </span>
                      )}
                    </div>
                    <span className="flex-1 text-sm text-gray-700 truncate">{cc}</span>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}

          {/* Users under a cost center */}
          {view === 'cc' && (
            <div className="flex-1 overflow-y-auto">
              {/* Broadcast to all in this CC */}
              <div className="px-4 py-3 border-b border-gray-100">
                <BroadcastCCRow
                  ccUsers={ccUsers}
                  sender={sender}
                  sending={sending}
                  onSend={async (msg) => {
                    setSending(true);
                    try {
                      await Promise.all(ccUsers.map(u =>
                        api.post('/chat_messages.php?action=send', { sender, recipient: u.username, message: msg }).catch(() => {})
                      ));
                    } finally { setSending(false); }
                  }}
                />
              </div>
              {ccUsers.length === 0 ? (
                <p className="text-center py-8 text-gray-300 text-sm">No accounts found.</p>
              ) : ccUsers.map(u => {
                const uUnread = unread[u.username] || 0;
                return (
                  <button key={u.id} onClick={() => openChat({ ...u })}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-blue-700">{u.full_name?.[0] || '?'}</span>
                      </div>
                      {uUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {uUnread > 9 ? '9+' : uUnread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">@{u.username}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Chat view */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-gray-50">
                {messages.length === 0 && (
                  <p className="text-center text-gray-300 text-xs mt-8">No messages yet. Say hello!</p>
                )}
                {messages.map((m, idx) => {
                  const isMine = m.sender === sender;
                  // Only show status on the last sent message
                  const isLastMine = isMine && messages.slice(idx + 1).every(x => x.sender !== sender);
                  return (
                    <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${isMine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>
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
              {selectedUser?.cost_center !== 'Admin' ? (
                <div className="px-3 py-2 border-t border-gray-100 flex gap-2 bg-white">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button onClick={handleSend} disabled={sending || !input.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2 rounded-xl transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="px-4 py-2 border-t border-gray-100 bg-amber-50 text-center">
                  <span className="text-xs text-amber-600 font-medium">Admin announcements — read only</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* FAB button */}
      <button onClick={() => setOpen(v => !v)}
        className="w-14 h-14 bg-emerald-700 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105">
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

function BroadcastAllRow({ sender, onSend, sending }) {
  const [msg, setMsg] = useState('');
  return (
    <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
      <p className="text-xs font-semibold text-amber-700 mb-1.5">📢 Broadcast to ALL cost centers</p>
      <div className="flex gap-2">
        <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && msg.trim()) { onSend(msg); setMsg(''); } }}
          placeholder="Type message..."
          className="flex-1 px-2 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white" />
        <button onClick={() => { if (msg.trim()) { onSend(msg); setMsg(''); } }} disabled={sending || !msg.trim()}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}

function BroadcastCCRow({ ccUsers, sender, onSend, sending }) {
  const [msg, setMsg] = useState('');
  if (ccUsers.length === 0) return null;
  return (
    <div className="bg-violet-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-violet-700 mb-1.5">📢 Send to all in this department</p>
      <div className="flex gap-2">
        <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && msg.trim()) { onSend(msg); setMsg(''); } }}
          placeholder="Type message..."
          className="flex-1 px-2 py-1.5 text-xs border border-violet-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white" />
        <button onClick={() => { if (msg.trim()) { onSend(msg); setMsg(''); } }} disabled={sending || !msg.trim()}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}
