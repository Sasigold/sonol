import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, RefreshCw, Save } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

export function SupabaseStatusCard() {
  const [status, setStatus] = useState('checking'); // checking, connected, error, missing
  const [url, setUrl] = useState(supabaseUrl || '');
  const [key, setKey] = useState(supabaseAnonKey || '');
  
  const checkConnection = async () => {
    if (!supabase) {
      setStatus('missing');
      return;
    }
    
    setStatus('checking');
    try {
      // Simple query to test connection (doesn't require a specific table)
      const { error } = await supabase.from('_non_existent_table_').select('*').limit(1);
      // If we get an error that is NOT related to connection/CORS, we are connected
      // Usually it returns a 400 or 404 for missing table, which means we reached Supabase!
      if (error && error.message === 'Failed to fetch') {
        setStatus('error');
      } else {
        setStatus('connected');
      }
    } catch (e) {
      setStatus('error');
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const saveConfig = () => {
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    window.location.reload(); // Reload to re-initialize client
  };

  return (
    <div className="card">
      <div className="card-title">
        <Database size={24} color="var(--accent-color)" />
        Supabase Connection
        <div style={{ marginLeft: 'auto' }}>
          {status === 'checking' && (
            <span className="status-badge"><RefreshCw size={14} className="animate-spin" /> Checking...</span>
          )}
          {status === 'connected' && (
            <span className="status-badge connected"><CheckCircle2 size={14} /> Connected</span>
          )}
          {(status === 'error' || status === 'missing') && (
            <span className="status-badge error"><XCircle size={14} /> {status === 'missing' ? 'Not Configured' : 'Connection Error'}</span>
          )}
        </div>
      </div>
      
      <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
        Configure your Supabase URL and Anon Key. If you have set them in <code>.env</code>, they will appear here automatically.
      </p>

      <div className="form-group">
        <label className="form-label">Supabase URL</label>
        <input 
          type="text" 
          className="input" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-project-ref.supabase.co" 
        />
      </div>
      
      <div className="form-group">
        <label className="form-label">Anon Key</label>
        <input 
          type="password" 
          className="input" 
          value={key} 
          onChange={(e) => setKey(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
        />
      </div>

      <button className="btn" onClick={saveConfig}>
        <Save size={18} /> Save Configuration
      </button>
      
      <button className="btn btn-secondary" onClick={checkConnection} style={{ marginLeft: '1rem' }}>
        <RefreshCw size={18} /> Test Connection
      </button>
    </div>
  );
}
