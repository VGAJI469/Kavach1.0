import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import useKavachStore from './store/useKavachStore';
import { pingML } from './services/api';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PolicyPage from './pages/PolicyPage';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const loadUserFromFirestore = useKavachStore(state => state.loadUserFromFirestore);
  const worker = useKavachStore(state => state.worker);

  useEffect(() => { pingML(); }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await loadUserFromFirestore(u.uid);
      }
      setLoading(false);
    });
    return unsub;
  }, [loadUserFromFirestore]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>Loading...</div>;
  }

  // Determine if onboarding is complete (allows devMode where Firebase user might be null)
  const isOnboarded = worker && worker.phone && worker.policy?.status === 'Active';
  const canAccessDashboard = user || isOnboarded;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={isOnboarded ? <Navigate to="/dashboard" replace /> : <Onboarding />} />
        <Route path="/dashboard" element={canAccessDashboard ? <Dashboard /> : <Navigate to="/onboarding" replace />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/policy" element={canAccessDashboard ? <PolicyPage /> : <Navigate to="/onboarding" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
