// server/recompute_all.js
const fs = require('fs');
const path = require('path');
const DB_FILE = path.resolve(__dirname, 'db.json');

function readDB(){ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
function writeDB(obj){ fs.writeFileSync(DB_FILE, JSON.stringify(obj,null,2)); }

// copy computeElo from server (ensure K matches)
function computeElo(ra, rb, K = 20) {
  let Sa = 1;
  let Sb = 0;

  const expectedA = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ra - rb) / 400));

  const deltaA = Math.round(K * (Sa - expectedA) * 100) / 100;
  const deltaB = Math.round(K * (Sb - expectedB) * 100) / 100;

  return { deltaA, deltaB, newA: Math.round((ra + deltaA)*100)/100, newB: Math.round((rb + deltaB)*100)/100 };
}

function normalizeMatchForReplay(m) {
  // New format: winner_id, loser_id, loser_score (loser_score = actual points scored by loser)
  if (m && m.winner_id && m.loser_id && typeof m.loser_score === 'number') {
    return {
      id: m.id,
      team_a_id: m.winner_id, // first team = winner
      team_b_id: m.loser_id,  // second team = loser
      score_a: 10,
      score_b: Number(m.loser_score),
      raw: m
    };
  }
  // Old-format safety: if someone used team_a/team_b and passed "pointsLeft" (noncanonical),
  // try to interpret gracefully. If they provided score_b we assume that's pointsLeft and convert.
  if (m && m.team_a_id && m.team_b_id) {
    // if they stored loser_score-like field, try to convert; otherwise if score_a/score_b exist treat
    if (typeof m.loser_score === 'number') {
      return { id: m.id, team_a_id: m.team_a_id, team_b_id: m.team_b_id, score_a: 10, score_b: Number(m.loser_score), raw: m };
    }
    if (typeof m.score_a === 'number' && typeof m.score_b === 'number') {
      // In legacy cases where score_b was stored as "pointsLeft", convert to actual points:
      // If you know score_b was already actual points, you can remove this conversion.
      // Here we *assume* score_b is actual loser points; keep as-is:
      return { id: m.id, team_a_id: m.team_a_id, team_b_id: m.team_b_id, score_a: Number(m.score_a), score_b: Number(m.score_b), raw: m };
    }
  }
  return null;
}


function recomputeAll() {
  const db = readDB();
  // initialize teams map
  const teamMap = {};
  (db.teams || []).forEach(t => {
    teamMap[t.id] = {
      id: t.id,
      name: t.name,
      elo: 1500,
      plus_minus: 0,
      wins: 0,
      losses: 0,
      created_at: t.created_at || new Date().toISOString()
    };
  });

  // normalize & chronological order
  const normalized = (db.matches || []).map(normalizeMatchForReplay).filter(Boolean)
    .sort((a,b) => {
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
    const scoreB = 10 - Number(nm.score_b);
    const res = computeElo(a.elo, b.elo, 20); // match server K
    a.elo = res.newA;
    b.elo = res.newB;
    a.plus_minus = (a.plus_minus||0) + (scoreA - scoreB);
    b.plus_minus = (b.plus_minus||0) + (scoreB - scoreA);
    a.wins = (a.wins||0) + 1; b.losses = (b.losses||0) + 1;
    // update raw match deltas optionally
    if (nm.raw) {
      if (nm.raw.winner_id) { nm.raw.elo_change_winner = res.deltaA; nm.raw.elo_change_loser = res.deltaB; }
      else { nm.raw.elo_change_a = res.deltaA; nm.raw.elo_change_b = res.deltaB; }
    }
  }

  db.teams = Object.values(teamMap);
  writeDB(db);
  console.log('Recompute done, wrote', DB_FILE);
}

recomputeAll();