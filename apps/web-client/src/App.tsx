import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Auth } from './pages/Auth/Auth';
import { AuthCallback } from './pages/Auth/AuthCallback';
import { Chat } from './pages/Chat/Chat';
import { Profile } from './pages/Profile/Profile';
import { JoinGroup } from './pages/Chat/JoinGroup';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/join/:code" element={<JoinGroup />} />
        {/* Default: redirect to chat if logged in, auth if not */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

