import { useState } from 'react';
import ProcessingDirector from '../ProcessingDirector.jsx';
import LoginForm from '../components/LoginForm.jsx';
import { useAuthContext } from '../context/AuthContext.jsx';
import { supabase } from '../services/supabaseClient.js';

export default function ProcessingDirectorPage({ onBack, onMarketIntelligence }) {
  const { user, profile, loading } = useAuthContext();
  const [showLogin, setShowLogin] = useState(false);
  const [dirty, setDirty] = useState(false);
  return (
    <main className="min-h-screen bg-[#EDE8DC] text-[#15130F] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <button type="button" className="mb-5 min-h-11 underline" disabled={dirty} onClick={onBack}>← Back to marketplace</button>
        {loading ? <p role="status">Checking your Stratum session…</p> : user ? (
          <ProcessingDirector
            key={user.id}
            onDirtyChange={setDirty}
            client={supabase}
            userId={user.id}
            user={{ ...user, user_metadata: { ...user.user_metadata, full_name: (profile?.id === user.id ? profile.name : null) || user.user_metadata?.full_name } }}
            onMarketIntelligence={onMarketIntelligence}
          />
        ) : (
          <section className="rounded-xl bg-white p-6">
            <h1 className="text-2xl mb-3">Mill operations</h1>
            <p>Sign in to create a private mill workspace or join with a staff invitation.</p>
            <button type="button" className="mt-4 min-h-11 px-5 rounded bg-[#1F4D3D] text-white" onClick={() => setShowLogin(true)}>Sign in to Stratum</button>
          </section>
        )}
        {showLogin && <LoginForm onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    </main>
  );
}
