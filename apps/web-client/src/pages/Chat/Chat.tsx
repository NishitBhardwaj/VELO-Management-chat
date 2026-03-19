import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, MoreVertical, Phone, Video, Send, Smile, Paperclip, LogOut, MessageCircle } from 'lucide-react';
import { AddContactModal } from './AddContactModal';
import './Chat.css';

interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
}

export interface Conversation {
    id: string;
    userId: string;
    name: string;
    avatarUrl?: string;
    lastMessage?: string;
    time?: string;
    unread: number;
    color: string;
}

export interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
}

export const Chat = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const colorCacheRef = useRef<Record<string, string>>({});

    const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ef4444', '#f97316', '#14b8a6', '#a855f7'];
    const getStableColor = (id: string): string => {
        if (!colorCacheRef.current[id]) {
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = id.charCodeAt(i) + ((hash << 5) - hash);
            }
            colorCacheRef.current[id] = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
        }
        return colorCacheRef.current[id];
    };

    useEffect(() => {
        const token = localStorage.getItem('velo_token');
        const userData = localStorage.getItem('velo_user');

        if (!token || !userData) {
            navigate('/auth', { replace: true });
            return;
        }

        try {
            setUser(JSON.parse(userData));
        } catch {
            navigate('/auth', { replace: true });
            return;
        }

        const fetchConnections = async () => {
            try {
                const contactsRes = await fetch('http://localhost:3001/users/contacts', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (contactsRes.ok) {
                    const contactsData = await contactsRes.json();
                    const mappedContacts = contactsData.map((c: any) => ({
                        id: c.id, 
                        userId: c.id,
                        name: c.display_name,
                        avatarUrl: c.avatar_url,
                        unread: 0,
                        color: getStableColor(c.id)
                    }));
                    setConversations(mappedContacts);
                }

                const pendingRes = await fetch('http://localhost:3001/users/connections/pending', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (pendingRes.ok) {
                    const pendingData = await pendingRes.json();
                    setPendingRequests(pendingData);
                }
            } catch (error) {
                console.error('Error fetching connections:', error);
            }
        };

        fetchConnections();
        const interval = setInterval(fetchConnections, 5000);
        return () => clearInterval(interval);

    }, [navigate]);

    const handleRespondRequest = async (connectionId: string, status: 'ACCEPTED' | 'REJECTED') => {
        const token = localStorage.getItem('velo_token');
        try {
            await fetch(`http://localhost:3001/users/connections/${connectionId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ status })
            });
            setPendingRequests(prev => prev.filter(req => req.id !== connectionId));
        } catch (error) {
            console.error('Error responding to request:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('velo_token');
        localStorage.removeItem('velo_user');
        navigate('/auth', { replace: true });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim()) return;
        // TODO: send via WebSocket
        setMessageInput('');
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    const filteredConversations = conversations.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) return null;

    return (
        <div className="chat-layout">
            <AddContactModal 
                isOpen={isAddContactOpen} 
                onClose={() => setIsAddContactOpen(false)} 
                token={localStorage.getItem('velo_token') || ''} 
            />
            {/* ─── Sidebar ──────────────────────────────── */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-v">V</span>ELO
                    </div>
                    <div className="sidebar-actions">
                        <button className="icon-btn" title="New chat" onClick={() => setIsAddContactOpen(true)}>
                            <Edit size={18} />
                        </button>
                        <button className="icon-btn" title="More">
                            <MoreVertical size={18} />
                        </button>
                    </div>
                </div>

                <div className="sidebar-search">
                    <div className="search-input-wrapper">
                        <Search className="search-icon" size={16} />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {pendingRequests.length > 0 && (
                    <div className="pending-requests" style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>
                        <div className="section-title" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                            Connection Requests ({pendingRequests.length})
                        </div>
                        {pendingRequests.map(req => (
                            <div key={req.id} className="pending-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: 'var(--surface-light)', borderRadius: '6px' }}>
                                <div className="pending-info" style={{ overflow: 'hidden' }}>
                                    <div className="pending-name" style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-light)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{req.requester.display_name}</div>
                                    <div className="pending-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.requester.email}</div>
                                </div>
                                <div className="pending-actions" style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button onClick={() => handleRespondRequest(req.id, 'ACCEPTED')} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                                    <button onClick={() => handleRespondRequest(req.id, 'REJECTED')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="conversation-list">
                    {filteredConversations.length === 0 ? (
                        <div className="empty-conversations" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p>No contacts yet.</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Search for a user to start chatting.</p>
                        </div>
                    ) : (
                        filteredConversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                                onClick={() => setActiveConv(conv)}
                            >
                                <div className="conv-avatar" style={{ background: conv.color }}>
                                    {getInitials(conv.name)}
                                </div>
                                <div className="conv-info">
                                    <div className="conv-name">{conv.name}</div>
                                    <div className="conv-last-msg">{conv.lastMessage || 'No messages yet'}</div>
                                </div>
                                <div className="conv-meta">
                                    <span className="conv-time">{conv.time}</span>
                                    {conv.unread > 0 && (
                                        <span className="conv-badge">{conv.unread}</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="sidebar-profile">
                    <div className="profile-avatar">
                        {getInitials(user.display_name)}
                    </div>
                    <div className="profile-info">
                        <div className="profile-name">{user.display_name}</div>
                        <div className="profile-status">Online</div>
                    </div>
                    <button className="icon-btn logout-btn" onClick={handleLogout} title="Sign out">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* ─── Chat Area ────────────────────────────── */}
            <main className="chat-main">
                {activeConv ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-left">
                                <div className="chat-header-avatar" style={{ background: activeConv.color }}>
                                    {getInitials(activeConv.name)}
                                </div>
                                <div className="chat-header-info">
                                    <h3>{activeConv.name}</h3>
                                    <span>Online</span>
                                </div>
                            </div>
                            <div className="chat-header-actions">
                                <button className="icon-btn" title="Voice call"><Phone size={18} /></button>
                                <button className="icon-btn" title="Video call"><Video size={18} /></button>
                                <button className="icon-btn" title="More options"><MoreVertical size={18} /></button>
                            </div>
                        </div>

                        <div className="chat-messages">
                            {messages.map(msg => (
                                <div key={msg.id} className={`message-row ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                                    <div>
                                        <div className="message-bubble">{msg.text}</div>
                                        <div className="message-time">{msg.createdAt}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="chat-input-area">
                            <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
                                <button type="button" className="icon-btn" title="Emoji"><Smile size={20} /></button>
                                <button type="button" className="icon-btn" title="Attach file"><Paperclip size={20} /></button>
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                />
                                <button type="submit" className="send-btn" title="Send message">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div className="empty-icon">
                            <MessageCircle size={36} />
                        </div>
                        <h2>Welcome to VELO</h2>
                        <p>Select a conversation to start messaging or create a new one.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
