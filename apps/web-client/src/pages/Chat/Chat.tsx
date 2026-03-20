import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, MoreVertical, Send, Smile, Paperclip, LogOut, MessageCircle, Users, Plus, Video, Calendar, Copy } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AddContactModal } from './AddContactModal';
import { CreateGroupModal } from './CreateGroupModal';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { GroupDetailsModal } from './GroupDetailsModal';
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
    isGroup?: boolean;
    groupId?: string;
    invite_code?: string;
    message_permission?: string;
    my_role?: string;
}

export interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
}

const API_BASE = 'http://localhost:3001';

export const Chat = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [groups, setGroups] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);
    const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'chats' | 'groups'>('chats');
    const [meetings, setMeetings] = useState<any[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');

    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeConvRef = useRef<Conversation | null>(null);
    const colorCacheRef = useRef<Record<string, string>>({});
    const fetchGroupsRef = useRef<(() => void) | undefined>(undefined);
    
    const [copiedInvite, setCopiedInvite] = useState(false);

    const getStableColor = (id: string) => {
        if (!colorCacheRef.current[id]) {
            const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#14b8a6', '#06b6d4', '#3b82f6'];
            let hash = 0;
            for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
            colorCacheRef.current[id] = colors[Math.abs(hash) % colors.length];
        }
        return colorCacheRef.current[id];
    };

    useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ─── 1. Auth + Socket.IO connection ─────────────
    useEffect(() => {
        const token = localStorage.getItem('velo_token');
        const userData = localStorage.getItem('velo_user');
        if (!token || !userData) { navigate('/auth', { replace: true }); return; }

        let parsedUser: UserProfile;
        try { parsedUser = JSON.parse(userData); setUser(parsedUser); }
        catch { navigate('/auth', { replace: true }); return; }

        const socket = io(`${API_BASE}/chat`, { auth: { token }, transports: ['websocket', 'polling'] });

        socket.on('connect', () => { setIsConnected(true); });
        socket.on('disconnect', () => { setIsConnected(false); });
        socket.on('authenticated', (data: any) => { console.log('✅ Authenticated as', data.userId); });

        // DM messages
        socket.on('new_message', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && !currentConv.isGroup && msg.sender_id === currentConv.userId) {
                setMessages(prev => [...prev, { id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at }]);
            }
            setConversations(prev => prev.map(c => {
                if (c.userId === msg.sender_id) return { ...c, lastMessage: msg.text, time: formatTime(msg.created_at) };
                return c;
            }));
        });

        socket.on('message_sent', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && !currentConv.isGroup && msg.recipient_id === currentConv.userId) {
                setMessages(prev => [...prev, { id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at }]);
            }
            setConversations(prev => prev.map(c => {
                if (c.userId === msg.recipient_id) return { ...c, lastMessage: msg.text, time: formatTime(msg.created_at) };
                return c;
            }));
        });

        // Group messages
        socket.on('new_group_message', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && currentConv.isGroup && currentConv.groupId === msg.group_id) {
                setMessages(prev => [...prev, { id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at }]);
            }
            setGroups(prev => prev.map(g => {
                if (g.groupId === msg.group_id) return { ...g, lastMessage: msg.text, time: formatTime(msg.created_at) };
                return g;
            }));
        });

        socket.on('group_message_sent', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && currentConv.isGroup && currentConv.groupId === msg.group_id) {
                setMessages(prev => [...prev, { id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at }]);
            }
            setGroups(prev => prev.map(g => {
                if (g.groupId === msg.group_id) return { ...g, lastMessage: msg.text, time: formatTime(msg.created_at) };
                return g;
            }));
        });

        socket.on('error_message', (data: any) => {
            alert(data.message);
        });

        socketRef.current = socket;

        const handleSessionExpired = () => {
            socket.disconnect();
            localStorage.removeItem('velo_token');
            localStorage.removeItem('velo_user');
            navigate('/auth', { replace: true });
        };

        // Fetch contacts
        const fetchConnections = async () => {
            try {
                const contactsRes = await fetch(`${API_BASE}/users/contacts`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (contactsRes.status === 401) return handleSessionExpired();
                if (contactsRes.ok) {
                    const contactsData = await contactsRes.json();
                    const mapped = contactsData.map((c: any) => ({
                        id: c.id, userId: c.id, name: c.display_name, avatarUrl: c.avatar_url,
                        unread: 0, color: getStableColor(c.id), isGroup: false,
                    }));
                    setConversations(prev => {
                        const prevMap = new Map(prev.map(p => [p.userId, p]));
                        return mapped.map((c: Conversation) => ({
                            ...c,
                            lastMessage: prevMap.get(c.userId)?.lastMessage || '',
                            time: prevMap.get(c.userId)?.time || '',
                            unread: prevMap.get(c.userId)?.unread || 0,
                        }));
                    });
                }
                const pendingRes = await fetch(`${API_BASE}/users/connections/pending`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (pendingRes.status === 401) return handleSessionExpired();
                if (pendingRes.ok) setPendingRequests(await pendingRes.json());
            } catch (error) { console.error('Error fetching connections:', error); }
        };

        // Fetch groups
        const fetchGroups = async () => {
            try {
                const res = await fetch(`${API_BASE}/groups`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.status === 401) return handleSessionExpired();
                if (res.ok) {
                    const data = await res.json();
                    setGroups(prev => {
                        const prevMap = new Map(prev.map(p => [p.groupId!, p]));
                        return data.map((g: any) => ({
                            id: g.id, userId: g.id, groupId: g.id, name: g.name,
                            lastMessage: prevMap.get(g.id)?.lastMessage || '',
                            time: prevMap.get(g.id)?.time || '',
                            unread: 0, color: getStableColor(g.id), isGroup: true,
                            invite_code: g.invite_code, message_permission: g.message_permission, my_role: g.my_role,
                        }));
                    });
                }
            } catch (error) { console.error('Error fetching groups:', error); }
        };

        fetchGroupsRef.current = fetchGroups;

        fetchConnections();
        fetchGroups();
        const interval = setInterval(() => { fetchConnections(); fetchGroups(); }, 8000);

        return () => { clearInterval(interval); socket.disconnect(); };
    }, [navigate]);

    // ─── 2. Load chat history ───────────────────────
    useEffect(() => {
        if (!activeConv) { setMessages([]); setMeetings([]); return; }
        const token = localStorage.getItem('velo_token');

        const loadHistory = async () => {
            try {
                let url: string;
                if (activeConv.isGroup) {
                    url = `${API_BASE}/groups/${activeConv.groupId}/messages?limit=50`;
                } else {
                    url = `${API_BASE}/chat/${activeConv.userId}/messages?limit=50`;
                }
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.map((m: any) => ({ id: m.id, text: m.text, senderId: m.sender_id, createdAt: m.created_at })));
                }
            } catch (error) { console.error('Error loading history:', error); }
        };

        const loadMeetings = async () => {
            if (!activeConv.isGroup) return;
            try {
                const res = await fetch(`${API_BASE}/groups/${activeConv.groupId}/meetings`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) setMeetings(await res.json());
            } catch (error) { console.error('Error loading meetings:', error); }
        };

        loadHistory();
        loadMeetings();
    }, [activeConv]);

    // ─── 3. Send message via WebSocket ──────────────
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !activeConv || !socketRef.current) return;

        if (activeConv.isGroup) {
            socketRef.current.emit('send_group_message', { groupId: activeConv.groupId, text: messageInput.trim() });
        } else {
            socketRef.current.emit('send_message', { recipientId: activeConv.userId, text: messageInput.trim() });
        }
        setMessageInput('');
    };

    const handleRespondRequest = async (connectionId: string, status: 'ACCEPTED' | 'REJECTED') => {
        const token = localStorage.getItem('velo_token');
        try {
            await fetch(`${API_BASE}/users/connections/${connectionId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status }),
            });
            setPendingRequests(prev => prev.filter(req => req.id !== connectionId));
        } catch (error) { console.error('Error responding:', error); }
    };

    const handleJoinByCode = async () => {
        if (!joinCode.trim()) return;
        const token = localStorage.getItem('velo_token');
        try {
            await fetch(`${API_BASE}/groups/join`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ code: joinCode.trim() }),
            });
            setJoinCode('');
            setJoinError('');
            // Refresh groups
            const res = await fetch(`${API_BASE}/groups`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setGroups(data.map((g: any) => ({
                    id: g.id, userId: g.id, groupId: g.id, name: g.name,
                    lastMessage: '', time: '', unread: 0, color: getStableColor(g.id), isGroup: true,
                    invite_code: g.invite_code, message_permission: g.message_permission, my_role: g.my_role,
                })));
            }
        } catch (err: any) {
            setJoinError('Invalid code or already a member');
        }
    };

    const handleLogout = () => {
        socketRef.current?.disconnect();
        localStorage.removeItem('velo_token');
        localStorage.removeItem('velo_user');
        navigate('/auth', { replace: true });
    };

    const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const formatTime = (isoString: string) => {
        try { return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    };

    const handleInstantMeeting = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeConv || !activeConv.isGroup) return;
        const token = localStorage.getItem('velo_token');
        try {
            const res = await fetch(`${API_BASE}/groups/${activeConv.groupId}/meetings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title: 'Instant Sync', scheduledAt: new Date().toISOString(), durationMinutes: 60 })
            });
            if (res.ok) {
                const meeting = await res.json();
                setMeetings(prev => [meeting, ...prev]);
                window.open(meeting.meeting_url, '_blank');
            }
        } catch (err) {
            console.error('Instant meeting failed', err);
        }
    };

    const handleGroupCreated = (group: any) => {
        setIsCreateGroupOpen(false);
        setSidebarTab('groups');
        if (fetchGroupsRef.current) fetchGroupsRef.current();
        
        setActiveConv({
            id: group.id, userId: group.id, groupId: group.id, name: group.name,
            lastMessage: '', time: '', unread: 0, color: getStableColor(group.id), isGroup: true,
            invite_code: group.invite_code, message_permission: group.message_permission, my_role: 'owner',
        });
    };

    const filteredItems = (sidebarTab === 'chats' ? conversations : groups).filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) return null;

    const canSendInGroup = activeConv?.isGroup
        ? activeConv.message_permission === 'everyone' || ['owner', 'admin', 'hr'].includes(activeConv.my_role || '')
        : true;

    return (
        <div className="chat-layout">
            <AddContactModal 
                isOpen={isAddContactOpen} 
                onClose={() => setIsAddContactOpen(false)} 
                token={localStorage.getItem('velo_token') || ''} 
                onUnauthorized={handleLogout}
            />
            {isCreateGroupOpen && (
                <CreateGroupModal
                    onClose={() => setIsCreateGroupOpen(false)}
                    onCreated={handleGroupCreated}
                />
            )}
            {isScheduleMeetingOpen && activeConv?.isGroup && (
                <ScheduleMeetingModal
                    groupId={activeConv.groupId!}
                    onClose={() => setIsScheduleMeetingOpen(false)}
                    onScheduled={(meeting) => { 
                        setMeetings(prev => [meeting, ...prev]); 
                        setIsScheduleMeetingOpen(false); 
                        if (socketRef.current) {
                            socketRef.current.emit('send_group_message', {
                                groupId: activeConv.groupId,
                                text: `📅 Scheduled a new video meeting: ${meeting.title}. Join here: ${meeting.meeting_url}`
                            });
                        }
                    }}
                />
            )}
            {isGroupDetailsOpen && activeConv?.isGroup && (
                <GroupDetailsModal
                    groupId={activeConv.groupId!}
                    onClose={() => setIsGroupDetailsOpen(false)}
                />
            )}

            {/* ─── Sidebar ──────────────────────────────── */}
            <aside className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-v">V</span>ELO
                        {isConnected && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', marginLeft: 8 }} title="Connected" />}
                    </div>
                    <div className="sidebar-actions">
                        <button className="icon-btn" title="New chat" onClick={() => setIsAddContactOpen(true)}>
                            <Edit size={18} />
                        </button>
                        <button className="icon-btn" title="Create group" onClick={() => setIsCreateGroupOpen(true)}>
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setSidebarTab('chats')}
                        style={{
                            flex: 1, padding: '0.75rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: sidebarTab === 'chats' ? 'var(--primary-color)' : 'var(--text-muted)',
                            borderBottom: sidebarTab === 'chats' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        }}
                    >
                        💬 Chats
                    </button>
                    <button
                        onClick={() => setSidebarTab('groups')}
                        style={{
                            flex: 1, padding: '0.75rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: sidebarTab === 'groups' ? 'var(--primary-color)' : 'var(--text-muted)',
                            borderBottom: sidebarTab === 'groups' ? '2px solid var(--primary-color)' : '2px solid transparent',
                        }}
                    >
                        👥 Groups ({groups.length})
                    </button>
                </div>

                <div className="sidebar-search">
                    <div className="search-input-wrapper">
                        <Search className="search-icon" size={16} />
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>

                {/* Join by code (Groups tab) */}
                {sidebarTab === 'groups' && (
                    <div style={{ padding: '0 1rem 0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text" placeholder="Enter invite code" value={joinCode}
                            onChange={e => setJoinCode(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.8rem', background: 'var(--secondary-bg)', color: 'var(--text-main)' }}
                        />
                        <button onClick={handleJoinByCode} style={{ padding: '0.5rem 0.75rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                            Join
                        </button>
                    </div>
                )}
                {joinError && <div style={{ padding: '0 1rem', fontSize: '0.75rem', color: '#ef4444' }}>{joinError}</div>}

                {/* Pending requests (Chats tab) */}
                {sidebarTab === 'chats' && pendingRequests.length > 0 && (
                    <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(99, 102, 241, 0.05)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                            Connection Requests ({pendingRequests.length})
                        </div>
                        {pendingRequests.map(req => (
                            <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', borderRadius: '6px' }}>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>{req.requester.display_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.requester.email}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button onClick={() => handleRespondRequest(req.id, 'ACCEPTED')} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                                    <button onClick={() => handleRespondRequest(req.id, 'REJECTED')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Conversation / Group list */}
                <div className="conversation-list">
                    {filteredItems.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p>{sidebarTab === 'chats' ? 'No contacts yet.' : 'No groups yet.'}</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                {sidebarTab === 'chats' ? 'Search for a user to start chatting.' : 'Create a group or join with an invite code.'}
                            </p>
                        </div>
                    ) : (
                        filteredItems.map(conv => (
                            <div
                                key={conv.id}
                                className={`conversation-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                                onClick={() => setActiveConv(conv)}
                            >
                                <div className="conv-avatar" style={{ background: conv.color }}>
                                    {conv.isGroup ? <Users size={18} /> : getInitials(conv.name)}
                                </div>
                                <div className="conv-info">
                                    <div className="conv-name">
                                        {conv.name}
                                        {conv.isGroup && conv.message_permission === 'admin_only' && (
                                            <span style={{ fontSize: '0.65rem', background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>
                                                📢
                                            </span>
                                        )}
                                    </div>
                                    <div className="conv-last-msg">{conv.lastMessage || 'No messages yet'}</div>
                                </div>
                                <div className="conv-meta">
                                    <span className="conv-time">{conv.time}</span>
                                    {conv.unread > 0 && <span className="conv-badge">{conv.unread}</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="sidebar-profile" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="Edit Profile">
                    <div className="profile-avatar">{getInitials(user.display_name)}</div>
                    <div className="profile-info">
                        <div className="profile-name">{user.display_name}</div>
                        <div className="profile-status">Online</div>
                    </div>
                    <button className="icon-btn logout-btn" onClick={(e) => { e.stopPropagation(); handleLogout(); }} title="Sign out">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            {/* ─── Chat Area ────────────────────────────── */}
            <main className="chat-main">
                {activeConv ? (
                    <>
                        <div className="chat-header">
                            <div className="chat-header-left" onClick={() => activeConv.isGroup && setIsGroupDetailsOpen(true)} style={{ cursor: activeConv.isGroup ? 'pointer' : 'default', padding: '4px', borderRadius: '8px' }}>
                                <div className="chat-header-avatar" style={{ background: activeConv.color }}>
                                    {activeConv.isGroup ? <Users size={18} color="white" /> : getInitials(activeConv.name)}
                                </div>
                                <div className="chat-header-info">
                                    <h3>{activeConv.name}</h3>
                                    <span>
                                        {activeConv.isGroup
                                            ? `${activeConv.my_role} · ${activeConv.message_permission === 'admin_only' ? 'Admins only' : 'Everyone can chat'}`
                                            : 'Online'}
                                    </span>
                                </div>
                            </div>
                            <div className="chat-header-actions">
                                {activeConv.isGroup && (
                                    <>
                                        <button className="icon-btn" title="Start Instant Meeting" onClick={handleInstantMeeting}>
                                            <Video size={18} />
                                        </button>
                                        <button className="icon-btn" title="Schedule Meeting" onClick={() => setIsScheduleMeetingOpen(true)}>
                                            <Calendar size={18} />
                                        </button>
                                        <button className="icon-btn" title={`Invite code: ${activeConv.invite_code}`}
                                            onClick={() => { 
                                                navigator.clipboard.writeText(activeConv.invite_code || ''); 
                                                setCopiedInvite(true);
                                                setTimeout(() => setCopiedInvite(false), 2000);
                                            }}>
                                            {copiedInvite ? <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981'}}>✓</span> : <Copy size={18} />}
                                        </button>
                                    </>
                                )}
                                <button className="icon-btn" title="More options"><MoreVertical size={18} /></button>
                            </div>
                        </div>

                        {/* Meeting banner */}
                        {activeConv.isGroup && meetings.length > 0 && (
                            <div style={{ padding: '0.5rem 1.5rem', background: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {meetings.filter(m => m.status !== 'ended').slice(0, 3).map(m => (
                                    <a key={m.id} href={m.meeting_url} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                            padding: '0.4rem 0.75rem', background: 'white', borderRadius: '8px',
                                            fontSize: '0.8rem', fontWeight: 500, color: 'var(--primary-color)',
                                            textDecoration: 'none', border: '1px solid var(--border-color)',
                                        }}>
                                        <Video size={14} />
                                        {m.title} · {new Date(m.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </a>
                                ))}
                            </div>
                        )}

                        <div className="chat-messages">
                            {messages.length === 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    No messages yet. Say hello! 👋
                                </div>
                            ) : (
                                messages.map(msg => (
                                    <div key={msg.id} className={`message-row ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                                        <div>
                                            <div className="message-bubble">{msg.text}</div>
                                            <div className="message-time">{formatTime(msg.createdAt)}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            {canSendInGroup ? (
                                <form className="chat-input-wrapper" onSubmit={handleSendMessage}>
                                    <button type="button" className="icon-btn" title="Emoji"><Smile size={20} /></button>
                                    <button type="button" className="icon-btn" title="Attach file"><Paperclip size={20} /></button>
                                    <input
                                        type="text" placeholder="Type a message..."
                                        value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                                    />
                                    <button type="submit" className="send-btn" title="Send" disabled={!isConnected}>
                                        <Send size={18} />
                                    </button>
                                </form>
                            ) : (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    🔒 Only admins and management can send messages in this group
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div className="empty-icon"><MessageCircle size={36} /></div>
                        <h2>Welcome to VELO</h2>
                        <p>Select a conversation or group to start messaging.</p>
                    </div>
                )}
            </main>
        </div>
    );
};
