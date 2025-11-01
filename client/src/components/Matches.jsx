// client/src/Matches.jsx
import React, { useEffect, useState, useMemo } from 'react';
const API = 'http://localhost:4000/api';

export default function Matches({ teams, refresh }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const teamNames = useMemo(() => {
    const map = {};
    teams.forEach(t => (map[t.id] = t.name));
    return map;
  }, [teams]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/matches`);
      const body = await res.json();
      setMatches(body || []);
    } catch (err) {
      alert('Failed to load matches: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Delete this match? This will recompute ratings from remaining matches.')) return;
    try {
      const res = await fetch(`${API}/matches/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        alert('Error: ' + (body?.error || res.statusText));
        return;
      }
      await load();
      refresh();
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  }

  return (
    <div>
      <h2>Matches</h2>
      <div style={{ marginBottom: 8 }}>
        <button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Reload'}</button>
      </div>

      {matches.length === 0 && <div>No matches recorded yet.</div>}

      {matches.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th>#</th><th>Date</th><th>Match</th><th>Score</th><th>ELO Δ</th><th></th>
          </tr></thead>
          <tbody>
            {matches.map((m, idx) => {
              // for backward compat, support both formats when rendering
              const winnerName = m.winner_id ? (teamNames[m.winner_id] || `#${m.winner_id}`) : (teamNames[m.team_a_id] || `#${m.team_a_id}`);
              const loserName = m.loser_id ? (teamNames[m.loser_id] || `#${m.loser_id}`) : (teamNames[m.team_b_id] || `#${m.team_b_id}`);
              const loserScore = 10 - m.loser_score ?? 10 - m.score_b ?? '';
              const winnerScore = m.winner_score ?? m.score_a ?? 10;
              const eloDeltaWinner = m.elo_change_winner.toFixed(2) ?? m.elo_change_a.toFixed(2) ?? '';
              const eloDeltaLoser = m.elo_change_loser.toFixed(2) ?? m.elo_change_b.toFixed(2) ?? '';
              return (
                <tr key={m.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ width: 40 }}>{idx + 1}</td>
                  <td>{m.created_at ? new Date(m.created_at).toLocaleString() : `id:${m.id}`}</td>
                  <td>{winnerName} vs {loserName}</td>
                  <td>{winnerScore} — {loserScore}</td>
                  <td>{(eloDeltaWinner >= 0 ? '+' : '') + (eloDeltaWinner ?? '')} / {(eloDeltaLoser >= 0 ? '+' : '') + (eloDeltaLoser ?? '')}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleDelete(m.id)} style={{ color: 'red' }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
