import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, MoreVertical, Phone, Video, Send, Smile, Paperclip, LogOut, MessageCircle } from 'lucide-react';
import './Chat.css';

interface UserProfile {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
}

interface Conversation {
    id: string;
    name: string;
    lastMessage: string;
    time: string;
    unread: number;
    color: string;
}

const DEMO_CONVERSATIONS: Conversation[] = [
    { id: '1', name: 'Engineering Team', lastMessage: 'Sprint standup in 10 mins 🚀', time: '2:05 AM', unread: 3, color: '#6366f1' },
    { id: '2', name: 'Priya Sharma', lastMessage: 'The deployment looks good!', time: '1:48 AM', unread: 1, color: '#ec4899' },
    { id: '3', name: 'Design Review', lastMessage: 'Updated the Figma link', time: '12:30 AM', unread: 0, color: '#f59e0b' },
    { id: '4', name: 'Rahul Verma', lastMessage: 'Can you review my PR?', time: 'Yesterday', unread: 0, color: '#10b981' },
    { id: '5', name: 'HR Announcements', lastMessage: '📢 Holiday schedule updated', time: 'Yesterday', unread: 5, color: '#8b5cf6' },
    { id: '6', name: 'Ananya Patel', lastMessage: 'Thanks for the help!', time: 'Mon', unread: 0, color: '#06b6d4' },
];

const DEMO_MESSAGES = [
    { id: '1', text: 'Hey team! The new auth module is live 🎉', sender: 'other', name: 'Priya', time: '1:42 AM' },
    { id: '2', text: 'Nice work! The login flow feels really smooth.', sender: 'me', time: '1:44 AM' },
    { id: '3', text: 'Did you test it with the GraphQL gateway?', sender: 'other', name: 'Priya', time: '1:45 AM' },
    { id: '4', text: 'Yes, everything is passing! JWT tokens are working correctly with both register and login endpoints.', sender: 'me', time: '1:46 AM' },
    { id: '5', text: 'The deployment looks good!', sender: 'other', name: 'Priya', time: '1:48 AM' },
];

export const Chat = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [activeConv, setActiveConv] = useState<string>('2');
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

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
        }
    }, [navigate]);

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

    const activeConversation = DEMO_CONVERSATIONS.find(c => c.id === activeConv);

    const filteredConversations = DEMO_CONVERSATIONS.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) return null;

    return (
        <div className="chat-layout">
            {/* ─── Sidebar ──────────────────────────────── */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-v">V</span>ELO
                    </div>
                    <div className="sidebar-actions">
                        <button className="icon-btn" title="New chat">
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

                <div className="conversation-list">
                    {filteredConversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`conversation-item ${activeConv === conv.id ? 'active' : ''}`}
                            onClick={() => setActiveConv(conv.id)}
                        >
                            <div className="conv-avatar" style={{ background: conv.color }}>
                                {getInitials(conv.name)}
                            </div>
                            <div className="conv-info">
                                <div className="conv-name">{conv.name}</div>
                                <div className="conv-last-msg">{conv.lastMessage}</div>
                            </div>
                            <div className="conv-meta">
                                <span className="conv-time">{conv.time}</span>
                                {conv.unread > 0 && (
                                    <span className="conv-badge">{conv.unread}</span>
                                )}
                            </div>
                        </div>
                    ))}
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
                {activeConversation ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-left">
                                <div className="chat-header-avatar" style={{ background: activeConversation.color }}>
                                    {getInitials(activeConversation.name)}
                                </div>
                                <div className="chat-header-info">
                                    <h3>{activeConversation.name}</h3>
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
                            {DEMO_MESSAGES.map(msg => (
                                <div key={msg.id} className={`message-row ${msg.sender === 'me' ? 'sent' : 'received'}`}>
                                    <div>
                                        <div className="message-bubble">{msg.text}</div>
                                        <div className="message-time">{msg.time}</div>
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
