import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, User, ArrowRight, CheckCircle, KeyRound, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import './Auth.css';

const AUTH_API_URL = 'http://localhost:3001/auth';

type AuthMode = 'login' | 'register' | 'forgot' | 'otp' | 'reset';

export const Auth = () => {
    const navigate = useNavigate();
    const [authMode, setAuthMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleToggleMode = () => {
        setAuthMode(authMode === 'login' ? 'register' : 'login');
        setError('');
        setSuccess('');
    };

    const showBrowserNotification = (title: string, body: string) => {
        // Show as a styled alert at the top of the page
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '🔑' });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '🔑' });
                }
            });
        }
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

                setTimeout(() => {
                    navigate('/chat', { replace: true });
                }, 1500);
            } else if (authMode === 'register') {
                const response = await axios.post(`${AUTH_API_URL}/register`, {
                    email,
                    username,
                    password,
                    display_name: name,
                });

                const { user } = response.data;
                setSuccess(`Account created successfully! Welcome, ${user.display_name}. Switching to login...`);

                     setTimeout(() => {
                    setAuthMode('login');
                    setPassword('');
                    setName('');
                    setUsername('');
                    setSuccess('');
                }, 2500);
            } else if (authMode === 'forgot') {
                // Step 1: Request OTP
                const response = await axios.post(`${AUTH_API_URL}/forgot-password`, { email });
                const receivedOtp = response.data.otp;

                // Show OTP as browser notification
                showBrowserNotification('VELO - Password Reset OTP', `Your OTP is: ${receivedOtp}`);
                setSuccess(`OTP sent! Check your browser notification. Your OTP is: ${receivedOtp}`);

                setTimeout(() => {
                    setAuthMode('otp');
                    setSuccess('');
                }, 2000);
            } else if (authMode === 'otp') {
                // Step 2: Just validate OTP format, move to reset step
                if (otp.length !== 6) {
                    throw new Error('OTP must be 6 digits');
                }
                setAuthMode('reset');
            } else if (authMode === 'reset') {
                // Step 3: Reset password
                if (newPassword !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                if (newPassword.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }

                await axios.post(`${AUTH_API_URL}/reset-password`, {
                    email,
                    otp,
                    newPassword,
                });

                setSuccess('Password reset successfully! Redirecting to login...');

                setTimeout(() => {
                    setAuthMode('login');
                    setPassword('');
                    setOtp('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setSuccess('');
                }, 2500);
            }
        } catch (err: any) {
            let errorMessage = 'Something went wrong. Please try again.';
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

    const getHeading = () => {
        switch (authMode) {
            case 'login': return 'Welcome back';
            case 'register': return 'Create an account';
            case 'forgot': return 'Forgot Password';
            case 'otp': return 'Enter OTP';
            case 'reset': return 'Set New Password';
        }
    };

    const getSubheading = () => {
        switch (authMode) {
            case 'login': return 'Enter your credentials to access your workspace.';
            case 'register': return 'Join your team and start collaborating.';
            case 'forgot': return 'Enter your email and we\'ll send you a one-time password.';
            case 'otp': return 'Check your browser notification for the 6-digit OTP.';
            case 'reset': return 'Enter your new password below.';
        }
    };

    const getButtonText = () => {
        if (isLoading) return 'Processing...';
        if (success) return '✓ Done';
        switch (authMode) {
            case 'login': return 'Sign in to workspace';
            case 'register': return 'Create account';
            case 'forgot': return 'Send OTP';
            case 'otp': return 'Verify OTP';
            case 'reset': return 'Reset Password';
        }
    };

    const isForgotFlow = authMode === 'forgot' || authMode === 'otp' || authMode === 'reset';

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
                    <h1>{getHeading()}</h1>
                    <p>{getSubheading()}</p>
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

                    {/* Register: Name field */}
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

                    {/* Register: Username field */}
                    {authMode === 'register' && (
                        <div className="input-group">
                            <span className="input-icon" style={{ fontWeight: 'bold' }}>@</span>
                            <input
                                type="text"
                                placeholder="Username (unique)"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                required
                                minLength={3}
                            />
                        </div>
                    )}

                    {/* Login, Register, Forgot: Email field */}
                    {(authMode === 'login' || authMode === 'register' || authMode === 'forgot') && (
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
                    )}

                    {/* Login, Register: Password field */}
                    {(authMode === 'login' || authMode === 'register') && (
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
                    )}

                    {/* OTP: OTP input field */}
                    {authMode === 'otp' && (
                        <div className="input-group">
                            <KeyRound className="input-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                maxLength={6}
                                style={{ letterSpacing: '0.5em', fontWeight: 600, fontSize: '1.1rem', textAlign: 'center' }}
                            />
                        </div>
                    )}

                    {/* Reset: New password fields */}
                    {authMode === 'reset' && (
                        <>
                            <div className="input-group">
                                <ShieldCheck className="input-icon" size={18} />
                                <input
                                    type="password"
                                    placeholder="New password (min 6 chars)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="input-group">
                                <Lock className="input-icon" size={18} />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        </>
                    )}

                    {authMode === 'login' && (
                        <div className="auth-options">
                            <label className="checkbox-label">
                                <input type="checkbox" /> Remember me
                            </label>
                            <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); setAuthMode('forgot'); setError(''); setSuccess(''); }}>Forgot password?</a>
                        </div>
                    )}

                    <button type="submit" className="btn-primary" disabled={isLoading || !!success}>
                        {getButtonText()}
                        {!isLoading && !success && <ArrowRight size={18} className="btn-icon-right" />}
                    </button>
                </form>

                {/* Social login only on login/register */}
                {!isForgotFlow && (
                    <>
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
                    </>
                )}

                <div className="auth-footer">
                    {isForgotFlow ? (
                        <p><a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); setError(''); setSuccess(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); }}>← Back to Sign in</a></p>
                    ) : authMode === 'login' ? (
                        <p>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleToggleMode(); }}>Sign up</a></p>
                    ) : (
                        <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleToggleMode(); }}>Sign in</a></p>
                    )}
                </div>
            </div>
        </div>
    );
};
