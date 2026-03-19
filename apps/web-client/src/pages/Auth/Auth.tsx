import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, User, ArrowRight, CheckCircle } from 'lucide-react';
import axios from 'axios';
import './Auth.css';

const AUTH_API_URL = 'http://localhost:3001/auth';

export const Auth = () => {
    const navigate = useNavigate();
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleToggleMode = () => {
        setAuthMode(authMode === 'login' ? 'register' : 'login');
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            if (authMode === 'login') {
                const response = await axios.post(`${AUTH_API_URL}/login`, {
                    email,
                    password,
                });

                const { access_token, user } = response.data;
                localStorage.setItem('velo_token', access_token);
                localStorage.setItem('velo_user', JSON.stringify(user));
                setSuccess(`Welcome back, ${user.display_name}! Redirecting...`);

                // Navigate to chat after showing success
                setTimeout(() => {
                    navigate('/chat', { replace: true });
                }, 1500);
            } else {
                const response = await axios.post(`${AUTH_API_URL}/register`, {
                    email,
                    password,
                    display_name: name,
                });

                const { user } = response.data;
                setSuccess(`Account created successfully! Welcome, ${user.display_name}. Switching to login...`);

                // Auto-switch to login mode after a brief delay, keeping email pre-filled
                setTimeout(() => {
                    setAuthMode('login');
                    setPassword('');
                    setName('');
                    setSuccess('');  // Clear success so button is enabled for login
                }, 2500);
            }
        } catch (err: any) {
            let errorMessage = 'Authentication failed. Please check your credentials.';
            if (err.response?.data?.message) {
                errorMessage = Array.isArray(err.response.data.message)
                    ? err.response.data.message.join(', ')
                    : err.response.data.message;
            } else if (err.message) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            {/* Animated Gradient Background */}
            <div className="auth-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <div className="auth-card glass-panel animate-fade-in">
                <div className="auth-header">
                    <div className="auth-logo">
                        <span className="logo-v">V</span>ELO
                    </div>
                    <h1>{authMode === 'login' ? 'Welcome back' : 'Create an account'}</h1>
                    <p>
                        {authMode === 'login'
                            ? 'Enter your credentials to access your workspace.'
                            : 'Join your team and start collaborating.'}
                    </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {/* Success Notification */}
                    {success && (
                        <div className="auth-success-banner">
                            <CheckCircle size={18} />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Error Notification */}
                    {error && (
                        <div className="auth-error-banner">
                            {error}
                        </div>
                    )}

                    {authMode === 'register' && (
                        <div className="input-group">
                            <User className="input-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <Mail className="input-icon" size={18} />
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock className="input-icon" size={18} />
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {authMode === 'login' && (
                        <div className="auth-options">
                            <label className="checkbox-label">
                                <input type="checkbox" /> Remember me
                            </label>
                            <a href="#" className="forgot-password">Forgot password?</a>
                        </div>
                    )}

                    <button type="submit" className="btn-primary" disabled={isLoading || !!success}>
                        {isLoading
                            ? 'Processing...'
                            : success
                                ? '✓ Done'
                                : authMode === 'login'
                                    ? 'Sign in to workspace'
                                    : 'Create account'}
                        {!isLoading && !success && <ArrowRight size={18} className="btn-icon-right" />}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or continue with</span>
                </div>

                <div className="social-login">
                    <button
                        className="btn-social"
                        type="button"
                        onClick={() => window.location.href = `${AUTH_API_URL}/google`}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
                                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
                            </g>
                        </svg>
                        Google
                    </button>

                    <button className="btn-social" type="button">
                        <Phone size={18} color="#64748b" />
                        Phone
                    </button>
                </div>

                <div className="auth-footer">
                    {authMode === 'login' ? (
                        <p>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleToggleMode(); }}>Sign up</a></p>
                    ) : (
                        <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleToggleMode(); }}>Sign in</a></p>
                    )}
                </div>
            </div>
        </div>
    );
};
