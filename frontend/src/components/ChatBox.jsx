import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';

const COST_CENTERS = [
  'Operating Room/Delivery Room',
  'Pulmonary Department (MSA)',
  'Hemodialysis Unit',
  'Newborn Screening',
  'Newborn Hearing Test',
  'Radiology',
  'Laboratory',
  'Bloodbank',
  'Pharmacy',
  'Billing - Window 1',
  'Billing - Window 2',
  'Benefits - Window 3A',
  'Benefits - Window 3B',
  'Benefits - Window 6',
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

  // Poll unread counts
  const fetchUnread = useCallback(() => {
    api.get(`/chat_messages.php?action=unread&me=${encodeURIComponent(sender)}`)
      .then(res => setUnread(res.data || {}))
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
    api.get(`/chat_messages.php?action=list&me=${encodeURIComponent(sender)}&other=${encodeURIComponent(selectedUser.username)}`)
      .then(res => setMessages(res.data || []))
      .catch(() => {});
  }, [sender, selectedUser]);

  useEffect(() => {
    if (view !== 'chat' || !selectedUser) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    // Mark read
    api.post('/chat_messages.php?action=read', { me: sender, other: selectedUser.username }).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, [view, selectedUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openCC = async (cc) => {
    setSelectedCC(cc);
    setCcUsers([]);
    setView('cc');
    try {
      const res = await api.get(`/manage_users.php?action=list&cost_center=${encodeURIComponent(cc)}`);
      setCcUsers(res.data || []);
    } catch { setCcUsers([]); }
  };

  const openChat = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setView('chat');
    setUnread(prev => {
      const next = { ...prev };
      delete next[user.username];
      return next;
    });
  };

  const sendMessage = async (recipientUsername, msg) => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post('/chat_messages.php?action=send', {
        sender,
        recipient: recipientUsername,
        message: msg.trim(),
      });
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedUser) return;
    const msg = input;
    setInput('');
    await sendMessage(selectedUser.username, msg);
    fetchMessages();
  };

  const handleBroadcastCC = async () => {
    if (!broadcastCC || !input.trim()) return;
    const msg = input;
    setInput('');
    setSending(true);
    try {
      await Promise.all(ccUsers.map(u =>
        api.post('/chat_messages.php?action=send', { sender, recipient: u.username, message: msg }).catch(() => {})
      ));
    } finally { setSending(false); }
  };

  const handleBroadcastAll = async (msg) => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const res = await api.get('/manage_users.php?action=list_all');
      const users = (res.data || []).filter(u => u.cost_center && u.role === 'staff');
      await Promise.all(users.map(u =>
        api.post('/chat_messages.php?action=send', { sender, recipient: u.username, message: msg }).catch(() => {})
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
              <button onClick={() => { setView(view === 'chat' ? 'cc' : 'list'); setSelectedUser(null); }}
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
                  <button onClick={() => { setSelectedUser({ username: 'Admin', full_name: 'Admin', cost_center: 'System' }); setMessages([]); setView('chat'); }}
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
              {COST_CENTERS.map(cc => {
                const ccUnread = 0; // aggregate per CC not tracked at this level
                return (
                  <button key={cc} onClick={() => openCC(cc)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-emerald-700">{cc[0]}</span>
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
                {messages.map(m => {
                  const isMine = m.sender === sender;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>
                        <p>{m.message}</p>
                        <p className={`text-[10px] mt-0.5 ${isMine ? 'text-emerald-200' : 'text-gray-400'} text-right`}>{fmt(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              {selectedUser?.username !== 'Admin' ? (
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
