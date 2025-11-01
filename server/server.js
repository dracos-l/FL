/* server.js — JSON-backed simple DB (no native modules) */
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(__dirname, 'db.json');
const PORT = process.env.PORT || 4000;

if (!fs.existsSync(DB_FILE)) {
  const seed = { teams: [], matches: [], nextTeamId: 1, nextMatchId: 1 };
  fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
}
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(obj) {
  fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2));
}

function computeElo(ra, rb, K = 20) {
  let Sa = 1;
  const Sb = 0;

  const expectedA = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ra - rb) / 400));

  const deltaA = K * (Sa - expectedA);
  const deltaB = K * (Sb - expectedB);

  return {
    newA: ra + deltaA,
    newB: rb + deltaB,
    deltaA,
    deltaB
  };
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/api/teams', (req, res) => {
  try {
    const db = readDB();
    const teams = db.teams.slice().sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return a.id - b.id;
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });

  const db = readDB();
  if (db.teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ error: 'team name already exists' });
  }

  const team = {
    id: db.nextTeamId++,
    name: name.trim(),
    elo: 1500,
    wins: 0,
    losses: 0,
    plus_minus: 0,
    created_at: new Date().toISOString()
  };
  db.teams.push(team);
  writeDB(db);
  res.json(team);
});

// ===== match endpoints — winner/loser format =====
// Assumes readDB(), writeDB(), computeElo(ra, rb, scoreA, scoreB, K) exist above in server.js

const DEFAULT_K = 20; // change this if you want a different K

function normalizeMatchForReplay(m) {
  // New format: winner_id, loser_id, loser_score (winner_score implied 10)
  if (m && m.winner_id && m.loser_id && typeof m.loser_score === 'number') {
    return {
      id: m.id,
      team_a_id: m.winner_id,
      team_b_id: m.loser_id,
      score_a: 10,
      score_b: Number(m.loser_score),
      raw: m
    };
  }
  // Old format fallback: team_a_id/team_b_id + score_a/score_b
  if (m && m.team_a_id && m.team_b_id && typeof m.score_a === 'number' && typeof m.score_b === 'number') {
    return {
      id: m.id,
      team_a_id: m.team_a_id,
      team_b_id: m.team_b_id,
      score_a: Number(m.score_a),
      score_b: Number(m.score_b),
      raw: m
    };
  }
  return null;
}

// POST /api/matches
// Accepts: { winnerId, loserId, loserScore }
app.post('/api/matches', (req, res) => {
  try {
    const body = req.body || {};

    // Accept either camelCase or snake_case keys
    let winnerId = body.winnerId ?? body.winner_id;
    let loserId = body.loserId ?? body.loser_id;
    let loserScore = body.loserScore ?? body.loser_score;

    // Backwards compatibility: if old format provided (teamAId/teamBId/scoreA/scoreB),
    // determine winner/loser automatically
    if (!winnerId && body.teamAId && body.teamBId && typeof body.scoreA === 'number' && typeof body.scoreB === 'number') {
      if (body.scoreA >= body.scoreB) {
        winnerId = body.teamAId;
        loserId = body.teamBId;
        loserScore = body.scoreB;
      } else {
        winnerId = body.teamBId;
        loserId = body.teamAId;
        loserScore = body.scoreA;
      }
    }

    if (!winnerId || !loserId || winnerId === loserId) {
      return res.status(400).json({ error: 'winnerId and loserId (different) are required' });
    }
    if (!Number.isFinite(loserScore) || loserScore < 0 || loserScore > 10) {
      return res.status(400).json({ error: 'loserScore must be a number between 0 and 10' });
    }

    const db = readDB();
    const winner = db.teams.find(t => t.id === Number(winnerId));
    const loser = db.teams.find(t => t.id === Number(loserId));
    if (!winner || !loser) return res.status(400).json({ error: 'team(s) not found' });

    // compute elo using winner=10, loser=loserScore
    const scoreA = 10;
    const scoreB = 10 - Number(loserScore);
    const eloResult = computeElo(winner.elo, loser.elo, DEFAULT_K);

    // update teams
    winner.elo = eloResult.newA;
    loser.elo = eloResult.newB;
    winner.plus_minus = (winner.plus_minus || 0) + (scoreA - scoreB);
    loser.plus_minus = (loser.plus_minus || 0) + (scoreB - scoreA);

    winner.wins = (winner.wins || 0) + 1;
    loser.losses = (loser.losses || 0) + 1;

    // save match in new format
    const match = {
      id: db.nextMatchId++,
      winner_id: Number(winnerId),
      loser_id: Number(loserId),
      loser_score: Number(loserScore),
      winner_score: 10,
      elo_change_winner: eloResult.deltaA,
      elo_change_loser: eloResult.deltaB,
      created_at: new Date().toISOString()
    };
    db.matches.push(match);

    writeDB(db);

    const standings = db.teams.slice().sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return a.id - b.id;
    });

    res.json({ matchId: match.id, eloDelta: { winner: eloResult.deltaA, loser: eloResult.deltaB }, updatedStandings: standings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/matches
app.get('/api/matches', (req, res) => {
  try {
    const db = readDB();
    const matches = (db.matches || []).slice().sort((a, b) => {
      if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
      return (b.id || 0) - (a.id || 0);
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/matches/:id -> remove and recompute ratings from remaining matches
app.delete('/api/matches/:id', (req, res) => {
  try {
    const idToDelete = Number(req.params.id);
    if (!idToDelete) return res.status(400).json({ error: 'invalid id' });

    const db = readDB();
    const matchIndex = (db.matches || []).findIndex(m => m.id === idToDelete);
    if (matchIndex === -1) return res.status(404).json({ error: 'match not found' });

    // remove
    db.matches.splice(matchIndex, 1);

    // recompute all teams from remaining matches
    const teamMap = {};
    (db.teams || []).forEach(t => {
      teamMap[t.id] = { id: t.id, name: t.name, elo: 1500, plus_minus: 0, created_at: t.created_at };
    });

    // normalize & order matches
    const normalized = (db.matches || [])
      .map(normalizeMatchForReplay)
      .filter(Boolean)
      .sort((a, b) => {
        const ra = a.raw && a.raw.created_at ? new Date(a.raw.created_at).getTime() : 0;
        const rb = b.raw && b.raw.created_at ? new Date(b.raw.created_at).getTime() : 0;
        if (ra && rb) return ra - rb;
        return (a.id || 0) - (b.id || 0);
      });

    for (const nm of normalized) {
      const a = teamMap[nm.team_a_id];
      const b = teamMap[nm.team_b_id];
      if (!a || !b) continue;
      const scoreA = Number(nm.score_a);
      const scoreB = Number(nm.score_b);
      const { deltaA, deltaB, newA, newB } = computeElo(a.elo, b.elo, DEFAULT_K);
      a.elo = newA;
      b.elo = newB;
      a.plus_minus = (a.plus_minus || 0) + (scoreA - scoreB);
      b.plus_minus = (b.plus_minus || 0) + (scoreB - scoreA);
      a.wins = (a.wins || 0) + 1;
      b.losses = (b.losses || 0) + 1;

      // if desired, update stored match deltas to keep file consistent:
      if (nm.raw) {
        nm.raw.elo_change_a = deltaA;
        nm.raw.elo_change_b = deltaB;
        // for new-format matches update elo_change_winner/loser
        if (nm.raw.winner_id) {
          nm.raw.elo_change_winner = deltaA;
          nm.raw.elo_change_loser = deltaB;
        } else if (nm.raw.team_a_id) {
          nm.raw.elo_change_a = deltaA;
          nm.raw.elo_change_b = deltaB;
        }
      }
    }

    // persist recomputed teams & matches
    db.teams = Object.values(teamMap);
    writeDB(db);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`JSON-backed server listening on http://localhost:${PORT}`);
});