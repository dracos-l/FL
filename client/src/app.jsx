// client/src/App.jsx
import React, { useEffect, useState } from 'react';
import Standings from './components/Standings';
import NewMatch from './components/NewMatch';
import Matches from './components/Matches';

const API_BASE = 'http://localhost:4000/api';

// helper that reads admin password from localStorage and attaches header
function apiFetch(path, opts = {}) {
  const adminPassword = localStorage.getItem('adminPassword') || '';
  const headers = new Headers(opts.headers || {});
  if (adminPassword) {
    headers.set('x-admin-password', adminPassword);
  }
  // default json content-type for body presence
  if (opts.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

export default function App() {
  const [teams, setTeams] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('adminPassword') || '';
  });

    function saveAdminPassword() {
    localStorage.setItem('adminPassword', adminPassword || '');
    // optionally give feedback to user (toast / alert) — omitted for brevity
  }

  function clearAdminPassword() {
    localStorage.removeItem('adminPassword');
    setAdminPassword('');
  }


  useEffect(() => {
    fetch(`${API_BASE}/teams`).then(r => r.json()).then(setTeams).catch(console.error);
  }, [refreshKey]);

  const [page, setPage] = useState('standings');
  const refresh = () => setRefreshKey(k => k + 1);
  


  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <div className="brand-mark">FL</div>
          <h1 style={{ margin: 0 }}>Fidel League Standings</h1>
        </div>

        <nav className="app-nav" role="navigation" aria-label="Main">
          <button
            className={page === 'standings' ? 'active' : ''}
            onClick={() => setPage('standings')}
          >
            Standings
          </button>

          <button
            className={page === 'new' ? 'active' : ''}
            onClick={() => setPage('new')}
          >
            New Match
          </button>

          <button
            className={page === 'matches' ? 'active' : ''}
            onClick={() => setPage('matches')}
          >
            Matches
          </button>
        </nav>
        
      </header>

      <main style={{ padding: 12 }}>
        {page === 'standings' && <Standings teams={teams} refresh={refresh} />}
        {page === 'new' && <NewMatch teams={teams} refresh={refresh} />}
        {page === 'matches' && <Matches teams={teams} refresh={refresh} />}
      </main>
    </div>
  );
}
