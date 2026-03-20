import { useState, useEffect } from 'react';
import { X, Shield, User as UserIcon, LogOut } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

interface Member {
    id: string;
    display_name: string;
    avatar_url: string;
    role: 'owner' | 'admin' | 'hr' | 'member';
    joined_at: string;
}

interface GroupDetails {
    id: string;
    name: string;
    description: string;
    visibility: string;
    invite_code: string;
    my_role: string;
    members: Member[];
}

interface Props {
    groupId: string;
    onClose: () => void;
}

export const GroupDetailsModal = ({ groupId, onClose }: Props) => {
    const [details, setDetails] = useState<GroupDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const token = localStorage.getItem('velo_token');
    const myId = JSON.parse(localStorage.getItem('velo_user') || '{}').id;

    const fetchDetails = async () => {
        try {
            const res = await axios.get(`${API_BASE}/groups/${groupId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDetails(res.data);
        } catch (err: any) {
            setError('Failed to load group details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [groupId]);

    const changeRole = async (targetUserId: string, newRole: string) => {
        setActionLoading(true);
        try {
            await axios.put(`${API_BASE}/groups/${groupId}/members/${targetUserId}/role`, { role: newRole }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails(); // Refresh members
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to change role');
        } finally {
            setActionLoading(false);
        }
    };

    const handleKick = async (targetUserId: string) => {
        if (!confirm('Are you sure you want to kick this member?')) return;
        setActionLoading(true);
        try {
            // Note: We'd need a DELETE /groups/:id/members/:userId endpoint.
            // Assuming it exists or will be added.
            await axios.delete(`${API_BASE}/groups/${groupId}/members/${targetUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to kick member');
        } finally {
            setActionLoading(false);
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'owner': return '#f59e0b';
            case 'admin': return '#ef4444';
            case 'hr': return '#10b981';
            default: return 'var(--text-muted)';
        }
    };

    if (loading) return null; // Or a spinner

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ width: '450px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>Groups Details</h2>
                    <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                
                {error ? (
                    <div className="modal-body"><p style={{ color: 'red' }}>{error}</p></div>
                ) : details ? (
                    <div className="modal-body" style={{ overflowY: 'auto', padding: '1rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div className="conv-avatar" style={{ margin: '0 auto 1rem', width: '64px', height: '64px', fontSize: '1.5rem', background: 'var(--primary-color)' }}>
                                {details.name.charAt(0).toUpperCase()}
                            </div>
                            <h3 style={{ margin: '0 0 0.5rem 0' }}>{details.name}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{details.description || 'No description provided.'}</p>
                            
                            <div style={{ marginTop: '1rem', display: 'inline-flex', gap: '1rem', background: 'var(--secondary-bg)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Visibility</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{details.visibility}</div>
                                </div>
                                <div style={{ width: '1px', background: 'var(--border-color)' }} />
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invite Code</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{details.invite_code}</div>
                                </div>
                            </div>
                        </div>

                        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UserIcon size={16} /> Members ({details.members.length})
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {details.members.map(member => (
                                <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--secondary-bg)', borderRadius: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div className="conv-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                            {member.display_name?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                                {member.display_name} {member.id === myId && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: getRoleBadgeColor(member.role), display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '2px', textTransform: 'capitalize', fontWeight: 600 }}>
                                                {['owner', 'admin'].includes(member.role) && <Shield size={10} />}
                                                {member.role}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Role Management Dropdown (Visible only to owners/admins viewing non-owners) */}
                                    {['owner', 'admin'].includes(details.my_role) && member.role !== 'owner' && member.id !== myId && (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <select 
                                                value={member.role} 
                                                onChange={(e) => changeRole(member.id, e.target.value)}
                                                disabled={actionLoading || (details.my_role === 'admin' && member.role === 'admin')}
                                                style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.75rem', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                                            >
                                                {details.my_role === 'owner' && <option value="admin">Admin</option>}
                                                <option value="hr">HR</option>
                                                <option value="member">Member</option>
                                            </select>
                                            <button 
                                                onClick={() => handleKick(member.id)}
                                                disabled={actionLoading || (details.my_role === 'admin' && member.role === 'admin')}
                                                style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Kick Member"
                                            >
                                                <LogOut size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
