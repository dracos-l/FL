// client/src/NewMatch.jsx
import React, { useState, useMemo } from 'react';

const API = 'http://localhost:4000/api';
const K = 20; // must match server DEFAULT_K if you want identical previews

function computeElo(ra, rb, K = 20) {
  let Sa = 1;
  const Sb = 0;

  const expectedA = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ra - rb) / 400));

  const deltaA = Math.round(K * (Sa - expectedA) * 100) / 100;
  const deltaB = Math.round(K * (Sb - expectedB) * 100) / 100;

  return {
    newA: Math.round((ra + deltaA) * 100) / 100,
    newB: Math.round((rb + deltaB) * 100) / 100,
    deltaA,
    deltaB
  };
}

export default function NewMatch({ teams, refresh }) {
  const [winner, setWinner] = useState('');
  const [loser, setLoser] = useState('');
  const [loserScore, setLoserScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const winnerObj = teams.find(t => String(t.id) === String(winner));
  const loserObj = teams.find(t => String(t.id) === String(loser));

  const preview = useMemo(() => {
    if (!winnerObj || !loserObj) return null;
    return computeElo(winnerObj.elo, loserObj.elo, K);
  }, [winnerObj, loserObj, loserScore]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!winner || !loser || winner === loser) {
      alert('Choose two different teams (winner and loser).');
      return;
    }
    if (!Number.isFinite(Number(loserScore)) || loserScore < 0 || loserScore > 10) {
      alert('Loser score must be 0–10.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${API}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winnerId: Number(winner),
          loserId: Number(loser),
          loserScore: Number(loserScore)
        })
      });
      const body = await resp.json();
      if (!resp.ok) {
        alert('Error: ' + (body?.error || resp.statusText));
      } else {
        alert(`Match recorded. ELO change — winner: ${body.eloDelta.winner.toFixed(2) >= 0 ? '+' : ''}${body.eloDelta.winner.toFixed(2)}, loser: ${body.eloDelta.loser.toFixed(2) >= 0 ? '+' : ''}${body.eloDelta.loser.toFixed(2)}`);
        setWinner('');
        setLoser('');
        setLoserScore(0);
        refresh();
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Record New Match</h2>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
        <div>
          <label>Winner</label>
          <br />
          <select value={winner} onChange={e => setWinner(e.target.value)}>
            <option value="">— select winner —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} (ELO {t.elo.toFixed(2)})</option>)}
          </select>
        </div>

        <div>
          <label>Loser</label>
          <br />
          <select value={loser} onChange={e => setLoser(e.target.value)}>
            <option value="">— select loser —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name} (ELO {t.elo.toFixed(2)})</option>)}
          </select>
        </div>

        <div>
          <label>Loser Cups Left (0–10)</label>
          <br />
          <input type="range" min="0" max="10" value={loserScore} onChange={e => setLoserScore(Number(e.target.value))} />
          <span style={{ marginLeft: 8 }}>{loserScore}</span>
        </div>

        {preview && (
          <div style={{ padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
            <div><strong>Preview</strong></div>
            <div>Predicted ELO — Winner: {preview.deltaA >= 0 ? '+' : ''}{preview.deltaA} → {preview.newA}</div>
            <div>Predicted ELO — Loser: {preview.deltaB >= 0 ? '+' : ''}{preview.deltaB} → {preview.newB}</div>
          </div>
        )}

        <div>
          <button type="submit" disabled={submitting}>Record Match</button>
        </div>
      </form>
    </div>
  );
}