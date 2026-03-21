import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Edit, MoreVertical, Send, Smile, Paperclip, LogOut, MessageCircle, Users, Plus, Video, Calendar, Copy, Trash2, Mic, X, FileText, Play, CornerUpLeft, BarChart2, Ghost, PenTool } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { AddContactModal } from './AddContactModal';
import { CreateGroupModal } from './CreateGroupModal';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { CreatePollModal } from './CreatePollModal';
import { WhiteboardModal } from './WhiteboardModal';
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
    reactions?: Record<string, string[]>;
    mediaUrl?: string;
    mediaType?: string;
    mediaName?: string;
    replyToId?: string;
    status?: string;
    isEphemeral?: boolean;
    pollData?: any;
    whiteboardData?: any;
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
    const [showPollModal, setShowPollModal] = useState(false);
    const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
    const [isEphemeralMode, setIsEphemeralMode] = useState(false);
    const [revealedEphemeral, setRevealedEphemeral] = useState<Record<string, boolean>>({});
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

    // Media & Voice State
    const [attachment, setAttachment] = useState<File | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<number | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});

    const formatRecordTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const renderTextWithMentions = (text: string) => {
        if (!text) return null;
        const parts = text.split(/(@[A-Za-z0-9_.-]+)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return <span key={i} style={{ color: '#6366f1', fontWeight: 600, background: 'rgba(99, 102, 241, 0.1)', padding: '0 4px', borderRadius: '4px' }}>{part}</span>;
            }
            return part;
        });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                setAttachment(audioFile);
                audioChunksRef.current = [];
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (error) { console.error('Microphone unavailable', error); }
    };

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMessageInput(e.target.value);
        if (!socketRef.current || !activeConvRef.current) return;
        
        const payload = activeConvRef.current.isGroup ? { groupId: activeConvRef.current.groupId } : { recipientId: activeConvRef.current.userId };
        socketRef.current.emit('typing_start', payload);

        if ((window as any).typingTimeout) clearTimeout((window as any).typingTimeout);
        (window as any).typingTimeout = setTimeout(() => {
            socketRef.current?.emit('typing_stop', payload);
        }, 1500);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

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

        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }

        const handlePush = (title: string, body: string) => {
            if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body });
            }
        };

        // DM messages
        socket.on('new_message', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && !currentConv.isGroup && msg.sender_id === currentConv.userId) {
                setMessages(prev => [...prev, { 
                    id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at, 
                    mediaUrl: msg.media_url, mediaType: msg.media_type, mediaName: msg.media_name, 
                    replyToId: msg.reply_to_id, status: 'READ', isEphemeral: msg.is_ephemeral,
                    pollData: msg.poll_data, whiteboardData: msg.whiteboard_data, reactions: msg.reactions || {} 
                }]);
                socket.emit('mark_read', { messageIds: [msg.id] });
            } else {
                handlePush('New Message', msg.text || 'Sent an attachment');
            }
            setConversations(prev => prev.map(c => {
                if (c.userId === msg.sender_id) return { ...c, lastMessage: msg.text || (msg.media_type ? `[${msg.media_type}]` : ''), time: formatTime(msg.created_at) };
                return c;
            }));
        });

        socket.on('message_sent', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && !currentConv.isGroup && msg.recipient_id === currentConv.userId) {
                setMessages(prev => [...prev, { 
                    id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at, 
                    mediaUrl: msg.media_url, mediaType: msg.media_type, mediaName: msg.media_name, 
                    replyToId: msg.reply_to_id, status: msg.status || 'DELIVERED', isEphemeral: msg.is_ephemeral,
                    pollData: msg.poll_data, whiteboardData: msg.whiteboard_data, reactions: msg.reactions || {} 
                }]);
            }
            setConversations(prev => prev.map(c => {
                if (c.userId === msg.recipient_id) return { ...c, lastMessage: msg.text || (msg.media_type ? `[${msg.media_type}]` : ''), time: formatTime(msg.created_at) };
                return c;
            }));
        });

        // Group messages
        socket.on('new_group_message', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && currentConv.isGroup && currentConv.groupId === msg.group_id) {
                setMessages(prev => [...prev, { 
                    id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at, 
                    mediaUrl: msg.media_url, mediaType: msg.media_type, mediaName: msg.media_name, 
                    replyToId: msg.reply_to_id, status: 'READ', isEphemeral: msg.is_ephemeral,
                    pollData: msg.poll_data, whiteboardData: msg.whiteboard_data, reactions: msg.reactions || {} 
                }]);
                socket.emit('mark_read', { messageIds: [msg.id] });
            } else {
                handlePush('New Group Message', msg.text || 'Sent an attachment');
            }
            setGroups(prev => prev.map(g => {
                if (g.groupId === msg.group_id) return { ...g, lastMessage: msg.text || (msg.media_type ? `[${msg.media_type}]` : ''), time: formatTime(msg.created_at) };
                return g;
            }));
        });

        socket.on('group_message_sent', (msg: any) => {
            const currentConv = activeConvRef.current;
            if (currentConv && currentConv.isGroup && currentConv.groupId === msg.group_id) {
                setMessages(prev => [...prev, { 
                    id: msg.id, text: msg.text, senderId: msg.sender_id, createdAt: msg.created_at, 
                    mediaUrl: msg.media_url, mediaType: msg.media_type, mediaName: msg.media_name, 
                    replyToId: msg.reply_to_id, status: msg.status || 'DELIVERED', isEphemeral: msg.is_ephemeral,
                    pollData: msg.poll_data, whiteboardData: msg.whiteboard_data, reactions: msg.reactions || {} 
                }]);
            }
            setGroups(prev => prev.map(g => {
                if (g.groupId === msg.group_id) return { ...g, lastMessage: msg.text || (msg.media_type ? `[${msg.media_type}]` : ''), time: formatTime(msg.created_at) };
                return g;
            }));
        });

        socket.on('message_deleted', (data: { messageId: string, chatId: string }) => {
            setMessages(prev => prev.filter(m => m.id !== data.messageId));
        });

        socket.on('message_reaction_updated', (data: { messageId: string, chatId: string, reactions: Record<string, string[]> }) => {
            setMessages(prev => prev.map(m => {
                if (m.id === data.messageId) {
                    return { ...m, reactions: data.reactions };
                }
                return m;
            }));
        });

        socket.on('error_message', (data: any) => {
            alert(data.message);
        });

        // ─── Phase 6 Event Listeners ─────────────
        socket.on('messages_read', (data: { messageIds: string[], readerId: string }) => {
            setMessages(prev => prev.map(m => data.messageIds.includes(m.id) ? { ...m, status: 'READ' } : m));
        });

        socket.on('poll_updated', (data: { messageId: string, chatId: string, pollData: any }) => {
            setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, pollData: data.pollData } : m));
        });

        socket.on('user_typing_start', (data: { senderId: string, groupId?: string }) => {
            setTypingUsers(prev => {
                const key = data.groupId ? `group:${data.groupId}` : `dm:${data.senderId}`;
                const users = prev[key] || [];
                if (!users.includes(data.senderId)) return { ...prev, [key]: [...users, data.senderId] };
                return prev;
            });
        });

        socket.on('user_typing_stop', (data: { senderId: string, groupId?: string }) => {
            setTypingUsers(prev => {
                const key = data.groupId ? `group:${data.groupId}` : `dm:${data.senderId}`;
                const users = prev[key] || [];
                return { ...prev, [key]: users.filter(id => id !== data.senderId) };
            });
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
                    setMessages(data.map((m: any) => ({ 
                        id: m.id, text: m.text, senderId: m.sender_id, createdAt: m.created_at, reactions: m.reactions || {},
                        mediaUrl: m.media_url, mediaType: m.media_type, mediaName: m.media_name, replyToId: m.reply_to_id,
                        status: m.status, isEphemeral: m.is_ephemeral, pollData: m.poll_data, whiteboardData: m.whiteboard_data
                    })));

                    const unreadIds = data.filter((m: any) => m.sender_id !== user?.id && m.status !== 'READ').map((m: any) => m.id);
                    if (unreadIds.length > 0 && socketRef.current) {
                        socketRef.current.emit('mark_read', { messageIds: unreadIds });
                    }
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
    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!activeConv || !socketRef.current) return;
        
        const text = messageInput.trim();
        if (!text && !attachment) return;

        let mediaUrl = undefined;
        let mediaType = undefined;
        let mediaName = undefined;

        if (attachment) {
            setUploadingMedia(true);
            try {
                const formData = new FormData();
                formData.append('file', attachment);
                let mt = 'document';
                if (attachment.type.startsWith('image/')) mt = 'image';
                if (attachment.type.startsWith('audio/')) mt = 'voice';
                formData.append('media_type', mt);

                const res = await fetch('http://localhost:3002/media/upload-direct', {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                mediaUrl = mt === 'image' ? data.thumbnail_url || data.url : data.url;
                mediaType = mt;
                mediaName = attachment.name;
            } catch (err) {
                console.error('Media upload failed:', err);
                alert('Failed to upload attachment.');
                setUploadingMedia(false);
                return;
            }
            setUploadingMedia(false);
        }

        const payload: any = { text };
        if (mediaUrl) {
            payload.mediaUrl = mediaUrl;
            payload.mediaType = mediaType;
            payload.mediaName = mediaName;
        }
        if (replyingTo) payload.replyToId = replyingTo.id;
        if (isEphemeralMode) payload.isEphemeral = true;

        if (activeConv.isGroup) {
            payload.groupId = activeConv.groupId;
            socketRef.current.emit('send_group_message', payload);
        } else {
            payload.recipientId = activeConv.userId;
            socketRef.current.emit('send_message', payload);
        }
        
        setMessageInput('');
        setAttachment(null);
        setMessageInput('');
        setAttachment(null);
        setReplyingTo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendPoll = (question: string, options: string[]) => {
        if (!activeConv || !socketRef.current) return;
        const payload: any = { 
            text: `📊 Poll: ${question}`,
            pollData: { question, options: options.map(opt => ({ text: opt, voters: [] })) }
        };
        if (activeConv.isGroup) {
            payload.groupId = activeConv.groupId;
            socketRef.current.emit('send_group_message', payload);
        } else {
            payload.recipientId = activeConv.userId;
            socketRef.current.emit('send_message', payload);
        }
        setShowPollModal(false);
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

    const handleDeleteMessage = (messageId: string) => {
        if (!confirm('Delete this message for everyone?')) return;
        if (socketRef.current) {
            socketRef.current.emit('delete_message', { messageId });
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
            {showPollModal && (
                <CreatePollModal onClose={() => setShowPollModal(false)} onSubmit={handleSendPoll} />
            )}
            {isWhiteboardOpen && activeConv?.isGroup && (
                <WhiteboardModal
                    groupId={activeConv.groupId!}
                    socket={socketRef.current}
                    onClose={() => setIsWhiteboardOpen(false)}
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
                                {activeConv.isGroup && <button className="icon-btn" title="Whiteboard" onClick={() => setIsWhiteboardOpen(true)}><PenTool size={18} /></button>}
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
                                messages.map(msg => {
                                    const canDelete = msg.senderId === user?.id || (activeConv.isGroup && ['owner', 'admin'].includes(activeConv.my_role || ''));
                                    const activeReactions = Object.entries(msg.reactions || {}).filter(([_, users]) => users.length > 0);
                                    const quotedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
                                    
                                    return (
                                        <div key={msg.id} className={`message-row ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexDirection: msg.senderId === user?.id ? 'row-reverse' : 'row' }}>
                                                <div style={{ position: 'relative' }} className="message-content-wrapper">
                                                    <div className="message-bubble">
                                                        {msg.isEphemeral && !revealedEphemeral[msg.id] && msg.senderId !== user?.id ? (
                                                            <div 
                                                                onClick={() => setRevealedEphemeral(prev => ({ ...prev, [msg.id]: true }))}
                                                                style={{ padding: '24px 16px', color: 'var(--text-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', filter: 'blur(4px)', transition: 'filter 0.3s', userSelect: 'none' }}
                                                                onMouseOver={e => e.currentTarget.style.filter = 'blur(1px)'}
                                                                onMouseOut={e => e.currentTarget.style.filter = 'blur(4px)'}
                                                            >
                                                                👻 Tap to Reveal
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {quotedMsg && (
                                                                    <div className="message-quote">
                                                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '4px' }}>
                                                                            Replying to {quotedMsg.senderId === user?.id ? 'yourself' : 'a message'}
                                                                        </div>
                                                                        <div style={{ fontSize: '0.8rem', opacity: 0.8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                            {quotedMsg.text ? renderTextWithMentions(quotedMsg.text) : (quotedMsg.mediaType ? `[${quotedMsg.mediaType}]` : '')}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {msg.mediaUrl && msg.mediaType === 'image' && (
                                                                    <div style={{ marginBottom: '8px' }}>
                                                                        <img src={msg.mediaUrl} alt="attachment" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '250px', objectFit: 'cover' }} />
                                                                    </div>
                                                                )}
                                                        {msg.mediaUrl && msg.mediaType === 'document' && (
                                                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', textDecoration: 'none', color: 'inherit', marginBottom: '8px' }}>
                                                                <FileText size={20} />
                                                                <span style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{msg.mediaName || 'Document'}</span>
                                                            </a>
                                                        )}
                                                        {msg.mediaUrl && msg.mediaType === 'voice' && (
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <audio src={msg.mediaUrl} controls style={{ maxWidth: '200px', height: '40px' }} />
                                                            </div>
                                                        )}
                                                        {msg.pollData && (
                                                            <div className="poll-container" style={{ background: 'rgba(0,0,0,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '8px', minWidth: '250px' }}>
                                                                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--primary-color)' }}>📊 {msg.pollData.question}</div>
                                                                {msg.pollData.options.map((opt: any, idx: number) => {
                                                                    const totalVotes = msg.pollData.options.reduce((acc: number, o: any) => acc + (o.voters?.length || 0), 0);
                                                                    const optVotes = opt.voters?.length || 0;
                                                                    const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                                                                    const isVoted = opt.voters?.includes(user?.id || '');
                                                                    return (
                                                                        <div 
                                                                            key={idx} 
                                                                            onClick={() => socketRef.current?.emit('submit_poll_vote', { messageId: msg.id, optionIndex: idx })}
                                                                            style={{ background: isVoted ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-default)', padding: '8px', borderRadius: '6px', marginBottom: '6px', cursor: 'pointer', position: 'relative', overflow: 'hidden', border: isVoted ? '1px solid var(--primary-color)' : '1px solid var(--border-color)' }}
                                                                        >
                                                                            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${percentage}%`, background: 'rgba(99, 102, 241, 0.15)', zIndex: 1, transition: 'width 0.3s' }} />
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2, fontSize: '0.85rem' }}>
                                                                                <span style={{ fontWeight: isVoted ? 600 : 400 }}>{opt.text}</span>
                                                                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{percentage}%</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right' }}>
                                                                    {msg.pollData.options.reduce((acc: number, o: any) => acc + (o.voters?.length || 0), 0)} votes
                                                                </div>
                                                            </div>
                                                        )}
                                                        {msg.text && !msg.pollData && <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{renderTextWithMentions(msg.text)}</div>}
                                                        </>
                                                        )}
                                                        
                                                        {activeReactions.length > 0 && (
                                                            <div className="message-active-reactions">
                                                                {activeReactions.map(([emoji, users]) => (
                                                                    <div 
                                                                        key={emoji} 
                                                                        className={`reaction-chip ${users.includes(user?.id || '') ? 'reacted' : ''}`}
                                                                        onClick={() => socketRef.current?.emit('message_reaction', { messageId: msg.id, emoji })}
                                                                    >
                                                                        {emoji} <span className="reaction-count">{users.length}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="message-time">
                                                        {formatTime(msg.createdAt)}
                                                        {msg.senderId === user?.id && (
                                                            <span style={{ marginLeft: '4px', color: msg.status === 'READ' ? '#3b82f6' : 'var(--text-muted)' }}>
                                                                {msg.status === 'READ' ? '✓✓' : (msg.status === 'DELIVERED' ? '✓✓' : '✓')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="message-hover-actions">
                                                        <button className="icon-btn" onClick={() => setReplyingTo(msg)} title="Reply">
                                                            <CornerUpLeft size={16} />
                                                        </button>
                                                        <div className="reaction-picker">
                                                            {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                                                <button key={emoji} onClick={() => socketRef.current?.emit('message_reaction', { messageId: msg.id, emoji })}>
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                {canDelete && (
                                                    <button 
                                                        className="icon-btn delete-msg-btn" 
                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                        title="Delete message"
                                                        style={{ opacity: 0.5, padding: '4px' }}
                                                    >
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {typingUsers[activeConv.isGroup ? `group:${activeConv.groupId}` : `dm:${activeConv.userId}`]?.length > 0 && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', padding: '8px 16px', fontStyle: 'italic', animation: 'pulse 1.5s infinite' }}>
                                    {typingUsers[activeConv.isGroup ? `group:${activeConv.groupId}` : `dm:${activeConv.userId}`].length === 1 ? 'Someone is typing...' : 'Several people are typing...'}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            {canSendInGroup ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                    {replyingTo && (
                                        <div style={{ padding: '0.5rem 1rem', background: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid var(--primary-color)' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)' }}>Replying to message</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-color)', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                                    {replyingTo.text || (replyingTo.mediaType ? `[${replyingTo.mediaType}]` : '')}
                                                </div>
                                            </div>
                                            <button onClick={() => setReplyingTo(null)} className="icon-btn" style={{ padding: 4 }}><X size={16} /></button>
                                        </div>
                                    )}
                                    {attachment && (
                                        <div style={{ padding: '0.5rem 1rem', background: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--primary-color)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 500 }}>
                                                {attachment.type.startsWith('audio/') ? <Mic size={16} /> : <FileText size={16} />}
                                                {attachment.name}
                                            </div>
                                            <button onClick={() => { setAttachment(null); stopRecording(); if(fileInputRef.current) fileInputRef.current.value=''; }} className="icon-btn" style={{ color: '#ef4444' }}><X size={16} /></button>
                                        </div>
                                    )}

                                    <form className="chat-input-wrapper" style={{ border: isEphemeralMode ? '1px dashed #ef4444' : '1px solid var(--border-color)' }} onSubmit={handleSendMessage}>
                                        <button type="button" className="icon-btn" title="Emoji"><Smile size={20} /></button>
                                        <button type="button" className="icon-btn" title="Create Poll" onClick={() => setShowPollModal(true)}><BarChart2 size={20} /></button>
                                        <button type="button" className="icon-btn" style={{ color: isEphemeralMode ? '#ef4444' : 'inherit' }} title="Ghost Mode" onClick={() => setIsEphemeralMode(!isEphemeralMode)}><Ghost size={20} /></button>
                                        
                                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={e => {
                                            if (e.target.files?.[0]) setAttachment(e.target.files[0]);
                                        }} />
                                        <button type="button" className="icon-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
                                        
                                        {!isRecording ? (
                                            <input
                                                type="text" placeholder="Type a message..."
                                                value={messageInput} onChange={handleTyping}
                                            />
                                        ) : (
                                            <div style={{ flex: 1, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'pulse 2s infinite' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                                                Recording {formatRecordTime(recordingTime)}
                                            </div>
                                        )}

                                        {!isRecording && !messageInput.trim() && !attachment ? (
                                            <button type="button" className="icon-btn" title="Record Voice Note" onClick={startRecording}>
                                                <Mic size={20} />
                                            </button>
                                        ) : isRecording ? (
                                            <button type="button" className="send-btn" title="Stop Recording" onClick={stopRecording} style={{ background: '#ef4444' }}>
                                                <Play size={18} />
                                            </button>
                                        ) : (
                                            <button type="submit" className="send-btn" title="Send" disabled={!isConnected || uploadingMedia}>
                                                {uploadingMedia ? <span style={{fontSize:'0.8rem'}}>...</span> : <Send size={18} />}
                                            </button>
                                        )}
                                    </form>
                                </div>
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
