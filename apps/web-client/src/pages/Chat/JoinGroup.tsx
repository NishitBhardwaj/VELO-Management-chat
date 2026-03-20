import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

export const JoinGroup = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
    const [message, setMessage] = useState('Joining group...');

    useEffect(() => {
        const token = localStorage.getItem('velo_token');
        if (!token) {
            // Save the code and redirect to auth
            localStorage.setItem('velo_pending_join', code || '');
            navigate('/auth', { replace: true });
            return;
        }

        const joinGroup = async () => {
            try {
                const res = await axios.post(`${API_BASE}/groups/join`, { code }, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setStatus('success');
                setMessage(`Joined "${res.data.group_name}" successfully!`);
                setTimeout(() => navigate('/chat', { replace: true }), 2000);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.response?.data?.message || 'Failed to join group');
            }
        };

        joinGroup();
    }, [code]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-app)',
            fontFamily: 'Inter, sans-serif',
        }}>
            <div style={{
                textAlign: 'center',
                padding: '3rem',
                background: 'white',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-lg)',
                maxWidth: '400px',
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                    {status === 'joining' ? '⏳' : status === 'success' ? '✅' : '❌'}
                </div>
                <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                    {status === 'joining' ? 'Joining Group...' : status === 'success' ? 'Welcome!' : 'Oops!'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{message}</p>
                {status === 'error' && (
                    <button
                        onClick={() => navigate('/chat')}
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem 2rem',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Go to Chat
                    </button>
                )}
            </div>
        </div>
    );
};
