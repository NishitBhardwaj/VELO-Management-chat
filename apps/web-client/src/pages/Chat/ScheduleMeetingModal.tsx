import { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001';

interface Props {
    groupId: string;
    onClose: () => void;
    onScheduled: (meeting: any) => void;
}

export const ScheduleMeetingModal = ({ groupId, onClose, onScheduled }: Props) => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(30);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<any>(null);

    const token = localStorage.getItem('velo_token');

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !date || !time) return;
        setLoading(true);
        setError('');

        try {
            const scheduledAt = new Date(`${date}T${time}`).toISOString();
            const res = await axios.post(`${API_BASE}/groups/${groupId}/meetings`, {
                title: title.trim(),
                scheduled_at: scheduledAt,
                duration_minutes: duration,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setResult(res.data);
            onScheduled(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to schedule meeting');
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-card" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>📅 Meeting Scheduled!</h2>
                        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                    </div>
                    <div className="modal-body">
                        <div className="group-result-name">{result.title}</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            {new Date(result.scheduled_at).toLocaleString()} · {result.duration_minutes} min
                        </p>
                        <a
                            href={result.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary"
                            style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}
                        >
                            Join Meeting Now
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><Calendar size={20} /> Schedule Meeting</h2>
                    <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <form className="modal-body" onSubmit={handleSchedule}>
                    {error && <div className="modal-error">{error}</div>}

                    <div className="modal-field">
                        <label>Meeting Title *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Sprint Planning"
                            required
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="modal-field">
                            <label><Calendar size={14} /> Date *</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="modal-field">
                            <label><Clock size={14} /> Time *</label>
                            <input
                                type="time"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="modal-field">
                        <label>Duration (minutes)</label>
                        <select
                            value={duration}
                            onChange={e => setDuration(parseInt(e.target.value))}
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                background: 'var(--secondary-bg)',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                            }}
                        >
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading || !title.trim() || !date || !time}>
                        {loading ? 'Scheduling...' : 'Schedule Meeting'}
                    </button>
                </form>
            </div>
        </div>
    );
};
