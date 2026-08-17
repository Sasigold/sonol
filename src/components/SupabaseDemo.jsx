import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, LogIn, DatabaseZap, Loader2 } from 'lucide-react';

export function SupabaseDemo() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const handleAnonymousSignIn = async () => {
    if (!supabase) return alert('Supabase client not configured.');
    
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setResult({ type: 'success', message: `Signed in as anonymous: ${data.user.id}` });
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const checkUsersCount = async () => {
    if (!supabase) return alert('Supabase client not configured.');
    
    setLoading(true);
    setResult(null);
    try {
      // Trying to access an arbitrary table - usually 'users' or 'profiles' in typical demo
      const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        if (error.code === '42P01') { // undefined_table
          throw new Error('Table "profiles" does not exist yet. Create it in Supabase dashboard to test queries.');
        }
        throw error;
      }
      setResult({ type: 'success', message: `Query successful. Profiles count: ${count || 0}` });
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <div className="card-title">
        <DatabaseZap size={24} color="#f59e0b" />
        Interactive Demo
      </div>
      <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
        Test real-time authentication and database features once connected.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button 
          className="btn" 
          onClick={handleAnonymousSignIn} 
          disabled={loading || !supabase}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
          Test Auth (Anonymous)
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={checkUsersCount}
          disabled={loading || !supabase}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
          Query "profiles" Table
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '8px',
          background: result.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${result.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          color: result.type === 'error' ? 'var(--error)' : 'var(--success)',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}>
          {result.message}
        </div>
      )}
    </div>
  );
}
