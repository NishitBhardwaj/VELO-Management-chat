import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface Props {
    onClose: () => void;
    onSubmit: (question: string, options: string[]) => void;
}

export const CreatePollModal: React.FC<Props> = ({ onClose, onSubmit }) => {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);

    const handleAddOption = () => setOptions([...options, '']);
    const handleRemoveOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(o => o.trim());
        if (!question.trim() || validOptions.length < 2) {
            alert('A poll needs a question and at least 2 options.');
            return;
        }
        onSubmit(question, validOptions);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h3 style={{ margin: 0 }}>Create Live Poll</h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>Question</label>
                        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a question..." style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} required />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>Options</label>
                        {options.map((opt, i) => (
                            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input type="text" value={opt} onChange={(e) => { const newOpts = [...options]; newOpts[i] = e.target.value; setOptions(newOpts); }} placeholder={`Option ${i + 1}`} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} required />
                                {options.length > 2 && <button type="button" onClick={() => handleRemoveOption(i)} className="icon-btn" style={{ color: '#ef4444' }}><Trash2 size={18} /></button>}
                            </div>
                        ))}
                        <button type="button" onClick={handleAddOption} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}><Plus size={16} /> Add Option</button>
                    </div>
                    <div style={{ marginTop: '1rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Send Poll</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
