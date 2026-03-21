import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Link as LinkIcon, User, Building2, FileText, CheckCircle, Upload } from 'lucide-react';
import axios from 'axios';
import './Profile.css';

const API_BASE = 'http://localhost:3001';

interface SocialLinkData {
    id?: string;
    label: string;
    url: string;
}

export const Profile = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Integrations
    const [gmailConnected, setGmailConnected] = useState(false);
    const [gmailAddress, setGmailAddress] = useState('');

    // Profile fields
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [statusText, setStatusText] = useState('');
    const [organization, setOrganization] = useState('');
    const [position, setPosition] = useState('');
    const [bio, setBio] = useState('');

    // Social links
    const [socialLinks, setSocialLinks] = useState<SocialLinkData[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newUrl, setNewUrl] = useState('');

    const token = localStorage.getItem('velo_token');

    useEffect(() => {
        if (!token) {
            navigate('/auth', { replace: true });
            return;
        }
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const res = await axios.get(`${API_BASE}/users/profile/full`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = res.data;
            setDisplayName(data.display_name || '');
            setEmail(data.email || '');
            setPhone(data.phone || '');
            setAvatarUrl(data.avatar_url || '');
            setStatusText(data.status_text || '');
            setOrganization(data.organization || '');
            setPosition(data.position || '');
            setBio(data.bio || '');
            setSocialLinks(data.social_links || []);
            
            // Fetch Gmail Status
            const userData = localStorage.getItem('velo_user');
            const currentUser = userData ? JSON.parse(userData) : null;
            if (currentUser?.id) {
                try {
                    const statusRes = await axios.get(`http://localhost:3004/oauth/status/${currentUser.id}`);
                    setGmailConnected(statusRes.data.connected);
                    setGmailAddress(statusRes.data.gmail_address || '');
                } catch (e) {
                    console.error('Failed to load Gmail status', e);
                }
            }
            
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await axios.put(`${API_BASE}/auth/profile`, {
                display_name: displayName,
                phone: phone || undefined,
                avatar_url: avatarUrl || undefined,
                status_text: statusText || undefined,
                organization: organization || undefined,
                position: position || undefined,
                bio: bio || undefined,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            // Update localStorage with new display_name
            const userData = localStorage.getItem('velo_user');
            if (userData) {
                const user = JSON.parse(userData);
                user.display_name = displayName;
                user.avatar_url = avatarUrl;
                localStorage.setItem('velo_user', JSON.stringify(user));
            }

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save profile:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('media_type', 'image');

            // Send strictly to the media-service port 3002
            const res = await axios.post('http://localhost:3002/media/upload-direct', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.thumbnail_url) {
                setAvatarUrl(res.data.thumbnail_url);
            }
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Avatar upload failed. Please try again.');
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleAddLink = async () => {
        if (!newLabel.trim() || !newUrl.trim()) return;
        try {
            const res = await axios.post(`${API_BASE}/users/profile/links`, {
                label: newLabel.trim(),
                url: newUrl.trim(),
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSocialLinks(prev => [...prev, res.data]);
            setNewLabel('');
            setNewUrl('');
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add link:', error);
        }
    };

    const handleDeleteLink = async (linkId: string) => {
        try {
            await axios.delete(`${API_BASE}/users/profile/links/${linkId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSocialLinks(prev => prev.filter(l => l.id !== linkId));
        } catch (error) {
            console.error('Failed to delete link:', error);
        }
    };

    const handleDisconnectGmail = async () => {
        const userData = localStorage.getItem('velo_user');
        const currentUser = userData ? JSON.parse(userData) : null;
        if (!currentUser?.id) return;
        
        try {
            await axios.post('http://localhost:3004/oauth/disconnect', { user_id: currentUser.id });
            setGmailConnected(false);
            setGmailAddress('');
        } catch (error) {
            console.error('Failed to disconnect Gmail:', error);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    };

    if (loading) {
        return (
            <div className="profile-container">
                <div style={{ color: 'var(--text-muted)', marginTop: '4rem' }}>Loading profile...</div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            <div className="profile-back-nav">
                <button className="profile-back-btn" onClick={() => navigate('/chat')}>
                    <ArrowLeft size={18} /> Back to Chat
                </button>
            </div>

            <div className="profile-card">
                {/* Header with Avatar */}
                <div className="profile-header">
                    <div className="profile-avatar-wrapper" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', position: 'relative' }}>
                        <div className="profile-avatar-large" style={{ opacity: uploadingAvatar ? 0.5 : 1 }}>
                            {avatarUrl && avatarUrl !== 'Uploading...' ? (
                                <img src={avatarUrl} alt={displayName} />
                            ) : (
                                getInitials(displayName || 'U')
                            )}
                            <div className="profile-avatar-overlay">
                                <Upload size={24} color="white" />
                            </div>
                        </div>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleAvatarUpload}
                        />
                        {uploadingAvatar && <div className="profile-avatar-uploading">Uploading...</div>}
                    </div>
                    <h2 className="profile-header-name">{displayName || 'Your Name'}</h2>
                    <p className="profile-header-email">{email}</p>
                </div>

                <div className="profile-body">
                    {/* Personal Info */}
                    <div className="profile-section">
                        <div className="profile-section-title">
                            <User size={14} /> Personal Information
                        </div>

                        <div className="profile-field">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your display name"
                            />
                        </div>

                        <div className="profile-field-row">
                            <div className="profile-field">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                />
                            </div>
                            <div className="profile-field">
                                <label>Avatar URL</label>
                                <input
                                    type="url"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                />
                            </div>
                        </div>

                        <div className="profile-field">
                            <label>Status</label>
                            <input
                                type="text"
                                value={statusText}
                                onChange={(e) => setStatusText(e.target.value)}
                                placeholder="What's on your mind?"
                            />
                        </div>
                    </div>

                    {/* Organization */}
                    <div className="profile-section">
                        <div className="profile-section-title">
                            <Building2 size={14} /> Organization
                        </div>

                        <div className="profile-field-row">
                            <div className="profile-field">
                                <label>Organization</label>
                                <input
                                    type="text"
                                    value={organization}
                                    onChange={(e) => setOrganization(e.target.value)}
                                    placeholder="Company or team name"
                                />
                            </div>
                            <div className="profile-field">
                                <label>Position</label>
                                <input
                                    type="text"
                                    value={position}
                                    onChange={(e) => setPosition(e.target.value)}
                                    placeholder="Your role or title"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bio */}
                    <div className="profile-section">
                        <div className="profile-section-title">
                            <FileText size={14} /> About
                        </div>
                        <div className="profile-field">
                            <label>Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell us about yourself..."
                                rows={3}
                            />
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className="profile-section">
                        <div className="profile-section-title">
                            <LinkIcon size={14} /> Social Links
                        </div>

                        {socialLinks.length === 0 && !showAddForm && (
                            <p className="profile-empty-links">No social links yet. Add your GitHub, LeetCode, LinkedIn, and more!</p>
                        )}

                        <div className="social-links-list">
                            {socialLinks.map((link) => (
                                <div key={link.id} className="social-link-item">
                                    <div className="social-link-icon">
                                        <LinkIcon size={16} color="white" />
                                    </div>
                                    <div className="social-link-info">
                                        <div className="social-link-label">{link.label}</div>
                                        <div className="social-link-url">{link.url}</div>
                                    </div>
                                    <button
                                        className="social-link-delete"
                                        onClick={() => link.id && handleDeleteLink(link.id)}
                                        title="Remove link"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {showAddForm ? (
                            <div className="add-link-form">
                                <div className="profile-field">
                                    <label>Label</label>
                                    <input
                                        type="text"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                        placeholder="e.g. GitHub"
                                    />
                                </div>
                                <div className="profile-field">
                                    <label>URL</label>
                                    <input
                                        type="url"
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                        placeholder="https://github.com/username"
                                    />
                                </div>
                                <button className="add-link-btn" onClick={handleAddLink}>
                                    Add
                                </button>
                            </div>
                        ) : (
                            <button className="add-link-toggle" onClick={() => setShowAddForm(true)}>
                                <Plus size={16} /> Add Link
                            </button>
                        )}
                    </div>

                    {/* Integrations */}
                    <div className="profile-section">
                        <div className="profile-section-title">
                            <LinkIcon size={14} /> Integrations
                        </div>

                        {gmailConnected ? (
                            <div className="profile-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-lighter)', borderRadius: '8px' }}>
                                <div>
                                    <strong>Gmail Connected: </strong>
                                    <span>{gmailAddress}</span>
                                </div>
                                <button className="profile-save-btn" style={{ background: '#d32f2f' }} onClick={handleDisconnectGmail}>Disconnect</button>
                            </div>
                        ) : (
                            <div className="profile-field">
                                <p style={{ color: 'var(--text-muted)', marginBottom: 10 }}>Connect your Gmail account to read and reply to emails directly inside VELO Chat.</p>
                                <button 
                                    className="add-link-toggle" 
                                    onClick={() => {
                                        const userData = localStorage.getItem('velo_user');
                                        const currentUser = userData ? JSON.parse(userData) : null;
                                        if (currentUser?.id) {
                                            window.location.href = `http://localhost:3004/oauth/connect?userId=${currentUser.id}`;
                                        }
                                    }}
                                >
                                    <Plus size={16} /> Connect Gmail
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Bar */}
                <div className="profile-save-bar">
                    {saveSuccess && (
                        <div className="profile-success">
                            <CheckCircle size={16} /> Profile saved!
                        </div>
                    )}
                    <button
                        className="profile-save-btn"
                        onClick={handleSaveProfile}
                        disabled={saving}
                    >
                        <Save size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};
