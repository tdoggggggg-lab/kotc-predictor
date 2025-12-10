'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Player {
  player_id: string;
  name: string;
  team_abbrev: string;
  position: string;
  opponent_abbrev: string;
  ppg: number;
  rpg: number;
  apg: number;
  v1_score: number;
  v2_score: number;
  rank_v1?: number;
  rank_v2?: number;
  rank_change?: number;
  opp_def_rating: number;
  is_mock?: boolean;
  injury_status?: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'HEALTHY';
  injury_type?: string;
  injury_adjustment?: number;
  is_b2b?: boolean;
  opponent_b2b?: boolean;
}

interface ApiResponse {
  success: boolean;
  data_source: 'live' | 'partial' | 'demo';
  games_source: 'espn' | 'mock';
  players_source: 'espn' | 'mock';
  games_count: number;
  games: Array<{ home: string; away: string; time: string }>;
  predictions: Player[];
  v2_predictions?: Player[];
  injuries_loaded: boolean;
  injured_players_count: number;
  excluded_players_count: number;
  b2b_teams: string[];
  model_comparison?: {
    rank_changes: number;
    biggest_riser: { name: string; change: number } | null;
    biggest_faller: { name: string; change: number } | null;
    top5_overlap: number;
  };
}

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelView, setModelView] = useState<'v1' | 'v2' | 'compare'>('v1');

  useEffect(() => {
    fetchPredictions();
  }, []);

  async function fetchPredictions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predictions?model=both');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || 'Failed to fetch predictions');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBanner = () => {
    if (!data) return null;
    
    return (
      <div className="mb-6 flex flex-wrap gap-4">
        {/* Injury Status */}
        {data.injuries_loaded && (
          <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-2">
            <span>🏥</span>
            <div className="text-sm">
              <span className="text-gray-400">Injuries: </span>
              <span className="font-medium">{data.injured_players_count}</span>
              {data.excluded_players_count > 0 && (
                <span className="text-red-400 ml-1">({data.excluded_players_count} OUT)</span>
              )}
            </div>
          </div>
        )}
        
        {/* B2B Teams */}
        {data.b2b_teams && data.b2b_teams.length > 0 && (
          <div className="bg-orange-900/30 rounded-lg p-3 flex items-center gap-2">
            <span>😴</span>
            <div className="text-sm">
              <span className="text-gray-400">B2B: </span>
              <span className="font-medium text-orange-300">{data.b2b_teams.join(', ')}</span>
            </div>
          </div>
        )}
        
        {/* Data Source */}
        <div className={`rounded-lg p-3 flex items-center gap-2 ${
          data.data_source === 'live' ? 'bg-green-900/30' :
          data.data_source === 'partial' ? 'bg-blue-900/30' : 'bg-gray-800'
        }`}>
          <span>{data.data_source === 'live' ? '✅' : data.data_source === 'partial' ? 'ℹ️' : '📊'}</span>
          <span className="text-sm">
            {data.data_source === 'live' ? 'Live ESPN Data' :
             data.data_source === 'partial' ? 'Partial Data' : 'Sample Data'}
          </span>
        </div>
      </div>
    );
  };

  // Get injury badge
  const getInjuryBadge = (status?: string) => {
    if (!status || status === 'HEALTHY') return null;
    
    const badges: Record<string, { text: string; color: string }> = {
      'OUT': { text: 'OUT', color: 'bg-red-600' },
      'DOUBTFUL': { text: 'DTD', color: 'bg-red-500' },
      'QUESTIONABLE': { text: 'GTD', color: 'bg-yellow-600' },
      'PROBABLE': { text: 'PROB', color: 'bg-yellow-500' }
    };
    
    const badge = badges[status];
    if (!badge) return null;
    
    return (
      <span className={`${badge.color} text-white text-xs px-1.5 py-0.5 rounded ml-2`}>
        {badge.text}
      </span>
    );
  };

  // Get B2B badge
  const getB2BBadge = (isB2B?: boolean, oppB2B?: boolean) => {
    if (isB2B) {
      return (
        <span className="bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded ml-1" title="Team on back-to-back">
          B2B
        </span>
      );
    }
    if (oppB2B) {
      return (
        <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded ml-1" title="Opponent on back-to-back">
          vs B2B
        </span>
      );
    }
    return null;
  };

  const players = modelView === 'v2' ? data?.v2_predictions : data?.predictions;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              👑 King of the Court Predictor
            </h1>
            <p className="text-gray-400">
              DraftKings KOTC predictions powered by ESPN data
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/lineup" className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded text-sm">
              💰 Lineup Builder
            </Link>
            <Link href="/history" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm">
              📊 Backtest
            </Link>
          </div>
        </header>

        {getStatusBanner()}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-4 text-gray-400">Loading predictions...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4">
            <p className="text-red-200">Error: {error}</p>
            <button 
              onClick={fetchPredictions}
              className="mt-2 px-4 py-2 bg-red-600 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Games Today */}
            <div className="mb-6 bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Today's Games</h2>
              <div className="flex flex-wrap gap-3">
                {data.games.map((game, i) => (
                  <div key={i} className="bg-gray-700 rounded px-3 py-2 text-sm">
                    <span className="font-medium">{game.away}</span>
                    <span className="text-gray-400 mx-2">@</span>
                    <span className="font-medium">{game.home}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Toggle */}
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setModelView('v1')}
                className={`px-4 py-2 rounded ${
                  modelView === 'v1' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                V1 (Stats-Focused)
              </button>
              <button
                onClick={() => setModelView('v2')}
                className={`px-4 py-2 rounded ${
                  modelView === 'v2' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                V2 (Context-Focused)
              </button>
              <button
                onClick={() => setModelView('compare')}
                className={`px-4 py-2 rounded ${
                  modelView === 'compare' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Compare Models
              </button>
            </div>

            {/* Model Comparison Stats */}
            {modelView === 'compare' && data.model_comparison && (
              <div className="mb-6 bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Model Comparison</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-700 rounded p-3">
                    <div className="text-gray-400">Rank Changes</div>
                    <div className="text-2xl font-bold">{data.model_comparison.rank_changes}</div>
                  </div>
                  <div className="bg-gray-700 rounded p-3">
                    <div className="text-gray-400">Top 5 Overlap</div>
                    <div className="text-2xl font-bold">{data.model_comparison.top5_overlap}/5</div>
                  </div>
                  {data.model_comparison.biggest_riser && (
                    <div className="bg-green-900/50 rounded p-3">
                      <div className="text-green-400">Biggest Riser (V2)</div>
                      <div className="font-bold">{data.model_comparison.biggest_riser.name}</div>
                      <div className="text-green-300">+{data.model_comparison.biggest_riser.change} spots</div>
                    </div>
                  )}
                  {data.model_comparison.biggest_faller && (
                    <div className="bg-red-900/50 rounded p-3">
                      <div className="text-red-400">Biggest Faller (V2)</div>
                      <div className="font-bold">{data.model_comparison.biggest_faller.name}</div>
                      <div className="text-red-300">{data.model_comparison.biggest_faller.change} spots</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Player Rankings */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-700 text-left text-sm text-gray-400">
                    <th className="p-3 w-12">#</th>
                    <th className="p-3">Player</th>
                    <th className="p-3">Matchup</th>
                    <th className="p-3 text-center">PPG</th>
                    <th className="p-3 text-center">RPG</th>
                    <th className="p-3 text-center">APG</th>
                    <th className="p-3 text-center">Score</th>
                    {modelView === 'compare' && (
                      <th className="p-3 text-center">V2 Rank</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {players?.slice(0, 25).map((player, i) => (
                    <tr 
                      key={player.player_id}
                      className={`border-t border-gray-700 ${
                        i < 5 ? 'bg-yellow-900/20' : ''
                      } ${player.injury_status && player.injury_status !== 'HEALTHY' ? 'opacity-80' : ''}`}
                    >
                      <td className="p-3 font-bold text-gray-400">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-semibold">
                          {player.name}
                          {getInjuryBadge(player.injury_status)}
                          {getB2BBadge(player.is_b2b, player.opponent_b2b)}
                        </div>
                        <div className="text-sm text-gray-400">
                          {player.team_abbrev} • {player.position}
                          {player.injury_type && (
                            <span className="text-yellow-500 ml-1">• {player.injury_type}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-gray-300">vs {player.opponent_abbrev}</span>
                        <div className="text-xs text-gray-500">
                          Def: {player.opp_def_rating.toFixed(1)}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono">{player.ppg.toFixed(1)}</td>
                      <td className="p-3 text-center font-mono">{player.rpg.toFixed(1)}</td>
                      <td className="p-3 text-center font-mono">{player.apg.toFixed(1)}</td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-blue-400">
                          {(modelView === 'v2' ? player.v2_score : player.v1_score).toFixed(1)}
                        </span>
                      </td>
                      {modelView === 'compare' && (
                        <td className="p-3 text-center">
                          <span className={`font-bold ${
                            (player.rank_change || 0) > 0 ? 'text-green-400' :
                            (player.rank_change || 0) < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            #{player.rank_v2}
                            {player.rank_change !== 0 && (
                              <span className="text-xs ml-1">
                                ({player.rank_change! > 0 ? '+' : ''}{player.rank_change})
                              </span>
                            )}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-center text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
              <button 
                onClick={fetchPredictions}
                className="ml-4 text-blue-400 hover:underline"
              >
                Refresh
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
