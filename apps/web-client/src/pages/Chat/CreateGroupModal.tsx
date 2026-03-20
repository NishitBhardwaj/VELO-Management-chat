import { useState } from 'react';
import { X, Users, Shield, Globe, Lock } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

interface Props {
    onClose: () => void;
    onCreated: (group: any) => void;
}

export const CreateGroupModal = ({ onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private'>('private');
    const [messagePermission, setMessagePermission] = useState<'everyone' | 'admin_only'>('everyone');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<any>(null);
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const token = localStorage.getItem('velo_token');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setLoading(true);
        setError('');

        try {
            const res = await axios.post(`${API_BASE}/groups`, {
                name: name.trim(),
                description: description.trim() || undefined,
                visibility,
                message_permission: messagePermission,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setResult(res.data);
            onCreated(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    const copyInvite = (text: string, type: 'code' | 'link') => {
        navigator.clipboard.writeText(text);
        if (type === 'code') {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } else {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };

    if (result) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-card" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>🎉 Group Created!</h2>
                        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                    </div>
                    <div className="modal-body">
                        <div className="group-result-name">{result.name}</div>
                        <div className="invite-section">
                            <label>Invite Code</label>
                            <div className="invite-copy-row">
                                <code className="invite-code">{result.invite_code}</code>
                                <button className="copy-btn" onClick={() => copyInvite(result.invite_code, 'code')}>
                                    {copiedCode ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <div className="invite-section">
                            <label>Invite Link</label>
                            <div className="invite-copy-row">
                                <code className="invite-link">{result.invite_link || `http://localhost:5173/join/${result.invite_code}`}</code>
                                <button className="copy-btn" onClick={() => copyInvite(result.invite_link || `http://localhost:5173/join/${result.invite_code}`, 'link')}>
                                    {copiedLink ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <p className="invite-hint">Share this code or link so others can join your group!</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Users size={20} /> Create Group</h2>
                    <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <form className="modal-body" onSubmit={handleCreate}>
                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-field">
                        <label>Group Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Engineering Team"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="modal-field">
                        <label>Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="What's this group about?"
                            rows={2}
                        />
                    </div>

                    <div className="modal-field">
                        <label>Visibility</label>
                        <div className="toggle-group">
                            <button
                                type="button"
                                className={`toggle-btn ${visibility === 'private' ? 'active' : ''}`}
                                onClick={() => setVisibility('private')}
                            >
                                <Lock size={14} /> Private
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${visibility === 'public' ? 'active' : ''}`}
                                onClick={() => setVisibility('public')}
                            >
                                <Globe size={14} /> Public
                            </button>
                        </div>
                    </div>

                    <div className="modal-field">
                        <label>Who can send messages?</label>
                        <div className="toggle-group">
                            <button
                                type="button"
                                className={`toggle-btn ${messagePermission === 'everyone' ? 'active' : ''}`}
                                onClick={() => setMessagePermission('everyone')}
                            >
                                <Users size={14} /> Everyone
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${messagePermission === 'admin_only' ? 'active' : ''}`}
                                onClick={() => setMessagePermission('admin_only')}
                            >
                                <Shield size={14} /> Admins Only
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </form>
            </div>
        </div>
    );
};
