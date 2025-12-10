'use client';

import { useState } from 'react';
import Link from 'next/link';

interface LineupSlot {
  position: string;
  player: {
    name: string;
    team_abbrev: string;
    position: string;
    salary: number;
    v1_score: number;
    v2_score: number;
    injury_status?: string;
    is_b2b?: boolean;
  } | null;
}

interface Lineup {
  slots: LineupSlot[];
  total_salary: number;
  remaining_salary: number;
  projected_score: number;
  value_score: number;
}

interface AvailablePlayer {
  player_id: string;
  name: string;
  team: string;
  position: string;
  dk_position: string;
  salary: number;
  projected: number;
  value: number;
  injury_status?: string;
  is_b2b?: boolean;
}

export default function LineupPage() {
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [players, setPlayers] = useState<AvailablePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<'v1' | 'v2'>('v1');
  const [salaryCap, setSalaryCap] = useState(50000);
  const [selectedLineup, setSelectedLineup] = useState(0);

  const generateLineups = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/optimize?model=${model}&salary=${salaryCap}&count=5`);
      const json = await res.json();
      if (json.success) {
        setLineups(json.lineups);
        setPlayers(json.available_players);
        setSelectedLineup(0);
      } else {
        setError(json.error || 'Failed to optimize');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (n: number) => `$${n.toLocaleString()}`;
  const currentLineup = lineups[selectedLineup];

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" className="text-blue-400 hover:underline">← Back</Link>
            <h1 className="text-3xl font-bold">💰 Lineup Optimizer</h1>
          </div>
          <p className="text-gray-400">
            Build optimal DraftKings KOTC lineups
          </p>
        </header>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Model</label>
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value as 'v1' | 'v2')}
              className="bg-gray-700 rounded px-3 py-2 text-white"
            >
              <option value="v1">V1 (Stats-Focused)</option>
              <option value="v2">V2 (Context-Focused)</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm text-gray-400 block mb-1">Salary Cap</label>
            <select 
              value={salaryCap} 
              onChange={(e) => setSalaryCap(parseInt(e.target.value))}
              className="bg-gray-700 rounded px-3 py-2 text-white"
            >
              <option value={50000}>$50,000</option>
              <option value={45000}>$45,000</option>
              <option value={40000}>$40,000</option>
            </select>
          </div>
          
          <button
            onClick={generateLineups}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium"
          >
            {loading ? 'Optimizing...' : 'Generate Lineups'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {lineups.length > 0 && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Lineup Selector */}
            <div className="md:col-span-2">
              {/* Lineup Tabs */}
              <div className="flex gap-2 mb-4">
                {lineups.map((lineup, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedLineup(i)}
                    className={`px-4 py-2 rounded ${
                      selectedLineup === i 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Lineup {i + 1}
                  </button>
                ))}
              </div>

              {/* Current Lineup */}
              {currentLineup && (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  {/* Lineup Header */}
                  <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <div>
                      <span className="text-2xl font-bold text-green-400">
                        {currentLineup.projected_score.toFixed(1)}
                      </span>
                      <span className="text-gray-400 ml-2">projected pts</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-medium">
                        {formatSalary(currentLineup.total_salary)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatSalary(currentLineup.remaining_salary)} remaining
                      </div>
                    </div>
                  </div>

                  {/* Roster */}
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-700 text-left text-sm text-gray-400">
                        <th className="p-3 w-16">Pos</th>
                        <th className="p-3">Player</th>
                        <th className="p-3 text-right">Salary</th>
                        <th className="p-3 text-right">Proj</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentLineup.slots.map((slot, i) => (
                        <tr key={i} className="border-t border-gray-700">
                          <td className="p-3">
                            <span className="bg-gray-600 px-2 py-1 rounded text-sm">
                              {slot.position}
                            </span>
                          </td>
                          <td className="p-3">
                            {slot.player ? (
                              <div>
                                <div className="font-medium">
                                  {slot.player.name}
                                  {slot.player.is_b2b && (
                                    <span className="bg-orange-600 text-xs px-1.5 py-0.5 rounded ml-2">B2B</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400">
                                  {slot.player.team_abbrev} • {slot.player.position}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-500">Empty</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {slot.player ? formatSalary(slot.player.salary) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono text-green-400">
                            {slot.player ? (model === 'v2' ? slot.player.v2_score : slot.player.v1_score).toFixed(1) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Player Pool */}
            <div>
              <h3 className="font-semibold mb-3">Top Available Players</h3>
              <div className="bg-gray-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-700">
                    <tr className="text-left text-gray-400">
                      <th className="p-2">Player</th>
                      <th className="p-2 text-right">$</th>
                      <th className="p-2 text-right">Val</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((p, i) => (
                      <tr key={p.player_id} className="border-t border-gray-700/50">
                        <td className="p-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-500">
                            {p.team} • {p.dk_position}
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          ${(p.salary / 1000).toFixed(1)}k
                        </td>
                        <td className="p-2 text-right font-mono text-green-400">
                          {p.value.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {lineups.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-500">
            Click "Generate Lineups" to build optimal rosters
          </div>
        )}
      </div>
    </main>
  );
}
