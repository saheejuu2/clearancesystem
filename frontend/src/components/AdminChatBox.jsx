import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import useDraggable from '../hooks/useDraggable';

const COST_CENTERS = [
  'Nurse',
  'ER Nurse',
  'OB Nurse',
  'Pediatrics Nurse',
  'Medical Nurse',
  'Surgery Nurse',
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

export default function AdminChatBox() {
  const [open, setOpen]             = useState(false);
  const [view, setView]             = useState('list');
  const [selectedCC, setSelectedCC] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [ccUsers, setCcUsers]       = useState([]);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const messagesEndRef              = useRef(null);
  const pollRef                     = useRef(null);
  const containerRef                = useRef(null);
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

  const fetchMessages = useCallback(() => {
    if (!selectedUser) return;
    api.get(`/chat_messages.php?action=list&me=Admin&other=${encodeURIComponent(selectedUser.cost_center)}`)
      .then(res => setMessages(res.data || []))
      .catch(() => {});
  }, [selectedUser]);

  useEffect(() => {
    if (view !== 'chat' || !selectedUser) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    // Mark messages from this CC as read
    api.post('/chat_messages.php?action=read', { me: 'Admin', other: selectedUser.cost_center }).catch(() => {});
    return () => clearInterval(pollRef.current);
  }, [view, selectedUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openCC = (cc) => {
    // Open chat directly with the cost center (no need to pick individual user)
    setSelectedUser({ cost_center: cc, full_name: cc });
    setMessages([]);
    setView('chat');
  };

  const send = async (recipientCC, msg) => {
    if (!msg.trim()) return;
    await api.post('/chat_messages.php?action=send', {
      sender: 'Admin',
      recipient: recipientCC,
      message: msg.trim(),
    }).catch(() => {});
  };

  const deleteMsg = async (id) => {
    await api.post('/chat_messages.php?action=delete', { id }).catch(() => {});
    setMessages(prev => prev.filter(m => m.id !== id));
    setDeleteConfirm(null);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedUser) return;
    const msg = input;
    setInput('');
    setSending(true);
    try {
      await send(selectedUser.cost_center, msg);
      fetchMessages();
    } finally { setSending(false); }
  };

  const broadcastCC = async (msg) => {
    if (!msg.trim() || !selectedCC) return;
    setSending(true);
    try {
      await send(selectedCC, msg);
    } finally { setSending(false); }
  };

  const broadcastAll = async (msg) => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await Promise.all(COST_CENTERS.map(cc => send(cc, msg)));
    } finally { setSending(false); }
  };

  const fmt = (dt) => new Date(dt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const portal = createPortal(
    <div ref={containerRef} className="z-[99999]">
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '460px', ...chatStyle() }}>
          {/* Header */}
          <div className="bg-emerald-800 px-4 py-3 flex items-center gap-2 cursor-move select-none" data-drag="1" onMouseDown={onMouseDown}>
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
                {view === 'list' ? 'Admin Broadcast' : view === 'cc' ? selectedCC : selectedUser?.full_name}
              </p>
              {view === 'chat' && (
                <p className="text-emerald-300 text-xs">One-way message</p>
              )}
              {view === 'list' && (
                <p className="text-emerald-300 text-xs">Send messages to staff</p>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* List view — cost centers */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              <BroadcastRow label="📢 Broadcast to ALL staff" color="amber" onSend={broadcastAll} sending={sending} />
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Departments</div>
              {COST_CENTERS.map(cc => (
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
              ))}
            </div>
          )}

          {/* CC users view */}
          {view === 'cc' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100">
                <BroadcastRow label="📢 Send to all in this department" color="violet" onSend={broadcastCC} sending={sending} />
              </div>
              {ccUsers.length === 0 ? (
                <p className="text-center py-8 text-gray-300 text-sm">No accounts found.</p>
              ) : ccUsers.map(u => (
                <button key={u.id} onClick={() => openChat(u)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-blue-700">{u.full_name?.[0] || '?'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-400">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Chat view — one way, admin sends only */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 bg-gray-50">
                <div className="text-center mb-2">
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    One-way — recipient cannot reply
                  </span>
                </div>
                {messages.length === 0 && (
                  <p className="text-center text-gray-300 text-xs mt-4">No messages sent yet.</p>
                )}
                {messages.map((m, idx) => {
                  const isMine = m.sender === 'Admin';
                  const isLastMine = isMine && messages.slice(idx + 1).every(x => x.sender !== 'Admin');
                  return (
                    <div key={m.id} className={`flex flex-col group ${isMine ? 'items-end' : 'items-start'}`}>
                      <div className={`flex ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-1`}>
                        {isMine && (
                          <button onClick={() => setDeleteConfirm(m.id)}
                            className="opacity-0 group-hover:opacity-100 self-center mr-1 text-gray-300 hover:text-red-400 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${isMine ? 'bg-emerald-700 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'}`}>
                          <p>{m.message}</p>
                          <p className={`text-[10px] mt-0.5 text-right ${isMine ? 'text-emerald-200' : 'text-gray-400'}`}>{fmt(m.created_at)}</p>
                        </div>
                        {!isMine && (
                          <button onClick={() => setDeleteConfirm(m.id)}
                            className="opacity-0 group-hover:opacity-100 self-center ml-1 text-gray-300 hover:text-red-400 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {isMine && isLastMine && (
                        <MessageStatus delivered={m.is_delivered} seen={m.is_seen} />
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div className="px-3 py-2 border-t border-gray-100 flex gap-2 bg-white">
                <input type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button onClick={handleSend} disabled={sending || !input.trim()}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white p-2 rounded-xl transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(v => !v)} onMouseDown={onMouseDown}
        style={fabStyle}
        className="w-14 h-14 bg-emerald-800 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 relative cursor-grab active:cursor-grabbing">
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
      </button>
    </div>,
    document.body
  );
  return (
    <>
      {portal}
      {deleteConfirm && <DeleteConfirmModal onConfirm={() => deleteMsg(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />}
    </>
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

function DeleteConfirmModal({ onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Delete this message?</p>
        <p className="text-xs text-gray-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors">Delete</button>
          <button onClick={onCancel} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BroadcastRow({ label, color, onSend, sending }) {
  const [msg, setMsg] = useState('');
  const colors = {
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'focus:ring-amber-400',  btn: 'bg-amber-500 hover:bg-amber-600',  text: 'text-amber-700'  },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', ring: 'focus:ring-violet-400', btn: 'bg-violet-600 hover:bg-violet-700', text: 'text-violet-700' },
  };
  const c = colors[color] || colors.amber;
  return (
    <div className={`${c.bg} rounded-xl p-3`}>
      <p className={`text-xs font-semibold ${c.text} mb-1.5`}>{label}</p>
      <div className="flex gap-2">
        <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && msg.trim()) { onSend(msg); setMsg(''); } }}
          placeholder="Type message..."
          className={`flex-1 px-2 py-1.5 text-xs border ${c.border} rounded-lg focus:outline-none focus:ring-1 ${c.ring} bg-white`} />
        <button onClick={() => { if (msg.trim()) { onSend(msg); setMsg(''); } }}
          disabled={sending || !msg.trim()}
          className={`${c.btn} disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors`}>
          Send
        </button>
      </div>
    </div>
  );
}
