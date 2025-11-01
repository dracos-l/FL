import React, { useState } from 'react';

export default function Standings({ teams, refresh }) {
  const [name, setName] = useState('');
  const API = 'http://localhost:4000/api';

  async function addTeam(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const resp = await fetch(`${API}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    });
    if (!resp.ok) {
      const err = await resp.json();
      alert('Error: ' + (err?.error || resp.statusText));
      return;
    }
    setName('');
    refresh();
  }

  return (
    <div>
      <h2>Standings</h2>
      <form onSubmit={addTeam} style={{ marginBottom: 12 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New team name" />
        <button type="submit" style={{ marginLeft: 8 }}>Add team</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
            <tr>
                <th style={{ textAlign: 'left' }}>#</th>
                <th style={{ textAlign: 'left' }}>Team</th>
                <th>ELO</th>
                <th>W</th>
                <th>L</th>
                <th>Plus/Minus</th>
            </tr>
        </thead>
        <tbody>
          {teams.map((t, idx) => (
            <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ width: 40 }}>{idx + 1}</td>
              <td>{t.name}</td>
              <td style={{ textAlign: 'center' }}>{Number(t.elo).toFixed ? Number(t.elo).toFixed(2) : t.elo}</td>
                <td style={{ textAlign: 'center' }}>{t.wins ?? 0}</td>
                <td style={{ textAlign: 'center' }}>{t.losses ?? 0}</td>
                <td style={{ textAlign: 'center' }}>{t.plus_minus ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
