import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const AUTH_API_URL = 'http://localhost:3001/auth';

export const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            setError('Authentication failed: No token received from provider.');
            setTimeout(() => navigate('/auth'), 3000);
            return;
        }

        // We have a token. Let's save it and fetch the user profile.
        localStorage.setItem('velo_token', token);

        const fetchProfile = async () => {
            try {
                const response = await axios.get(`${AUTH_API_URL}/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                localStorage.setItem('velo_user', JSON.stringify(response.data));

                // Navigate to chat
                navigate('/chat', { replace: true });
            } catch (err) {
                console.error('Failed to fetch user profile after OAuth:', err);
                setError('Failed to load user profile. Please try logging in again.');
                localStorage.removeItem('velo_token');
                setTimeout(() => navigate('/auth'), 3000);
            }
        };

        fetchProfile();
    }, [searchParams, navigate]);

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <div className="auth-card glass-panel animate-fade-in" style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="auth-logo" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                    <span className="logo-v">V</span>ELO
                </div>

                {error ? (
                    <div className="auth-error-banner" style={{ marginBottom: 0 }}>
                        {error}
                        <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>Redirecting...</div>
                    </div>
                ) : (
                    <div>
                        <div className="spinner" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <h2>Authenticating...</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Setting up your workspace securely.</p>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                )}
            </div>
        </div>
    );
};
