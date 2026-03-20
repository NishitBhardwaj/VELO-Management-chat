import { useState, useEffect } from 'react';
import { Search, X, UserPlus, Check } from 'lucide-react';
import './AddContactModal.css';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onUnauthorized?: () => void;
}

export const AddContactModal = ({ isOpen, onClose, token, onUnauthorized }: AddContactModalProps) => {
    const [searchEmail, setSearchEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Reset all state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSearchEmail('');
            setResult(null);
            setError('');
            setSuccess(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResult(null);
        setSuccess(false);
        if (!searchEmail.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/users/search?email=${encodeURIComponent(searchEmail)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to search user');
            }

            const data = await res.json();
            if (!data.found) {
                setError('No user found with that email address.');
            } else {
                setResult(data);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!result) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('http://localhost:3001/users/connections', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ recipientId: result.id })
            });

            if (res.status === 401 && onUnauthorized) {
                onUnauthorized();
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to send request');
            }
            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}><X size={20} /></button>
                <h2>Add Contact</h2>
                
                <form onSubmit={handleSearch} className="search-form">
                    <div className="modal-search-wrapper">
                        <Search className="search-icon" size={16} />
                        <input
                            type="email"
                            placeholder="Enter exact email address..."
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="search-btn" disabled={loading}>
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </form>

                {error && <div className="error-message">{error}</div>}

                {result && !success && (
                    <div className="search-result">
                        <div className="result-info">
                            <div className="result-avatar">
                                {result.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="result-name">{result.display_name}</div>
                                <div className="result-email">{result.email}</div>
                            </div>
                        </div>
                        <button className="add-btn" onClick={handleSendRequest} disabled={loading}>
                            <UserPlus size={16} /> Send Request
                        </button>
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        <Check size={20} className="success-icon" />
                        Connection request sent successfully!
                    </div>
                )}
            </div>
        </div>
    );
};
