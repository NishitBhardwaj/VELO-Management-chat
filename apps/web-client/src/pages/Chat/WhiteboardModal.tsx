import React, { useState, useEffect, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { X } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface Props {
    groupId: string;
    socket: Socket | null;
    onClose: () => void;
}

export const WhiteboardModal: React.FC<Props> = ({ groupId, socket, onClose }) => {
    const [elements, setElements] = useState<any>(null);
    const [appState, setAppState] = useState<any>(null);

    useEffect(() => {
        if (!socket) return;
        const listenForSync = (data: { senderId: string, elements: any, appState: any }) => {
            setElements(data.elements);
            setAppState(data.appState);
        };
        socket.on('board_updated', listenForSync);
        return () => { socket.off('board_updated', listenForSync); };
    }, [socket]);

    const handleSync = useCallback((els: readonly any[], state: any) => {
        if (!socket) return;
        socket.emit('sync_canvas', { groupId, elements: els, appState: state });
    }, [groupId, socket]);

    return (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ width: '90vw', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div className="modal-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🎨</span> Collaborative Whiteboard
                    </h3>
                    <button onClick={onClose} className="icon-btn" style={{ padding: '4px' }}><X size={20} /></button>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Excalidraw 
                        initialData={{ elements, appState }}
                        onChange={(els, state) => handleSync(els, state)}
                        UIOptions={{ canvasActions: { toggleTheme: true, export: { saveFileToDisk: true } } }}
                    />
                </div>
            </div>
        </div>
    );
};
