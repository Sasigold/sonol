import React from 'react';
import { SupabaseStatusCard } from './components/SupabaseStatusCard';
import { SupabaseDemo } from './components/SupabaseDemo';
import { Rocket } from 'lucide-react';

function App() {
  return (
    <div className="container">
      <div className="header">
        <h1 className="title">
          <Rocket size={32} style={{ display: 'inline', marginRight: '10px', verticalAlign: 'middle' }} color="#60a5fa" />
          React + Supabase
        </h1>
        <p className="subtitle">
          Your modern, high-performance starting point for building web applications.
        </p>
      </div>

      <SupabaseStatusCard />
      <SupabaseDemo />

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p className="subtitle" style={{ fontSize: '0.9rem' }}>
          Build something amazing today. Edit <code>src/App.jsx</code> to get started.
        </p>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}

export default App;
