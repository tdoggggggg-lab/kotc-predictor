'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BacktestResult {
  date: string;
  total_players: number;
  top5_hit_rate: number;
  top10_hit_rate: number;
  top1_accuracy: number;
  v1_avg_error: number;
  v2_avg_error: number;
  winner: 'v1' | 'v2' | 'tie';
  predictions: Array<{
    player_name: string;
    predicted_rank: number;
    actual_rank: number;
    rank_diff: number;
    kotc_points: number;
  }>;
}

interface BacktestSummary {
  total_days: number;
  date_range: { start: string; end: string };
  avg_top5_hit_rate: number;
  avg_top10_hit_rate: number;
  top1_hit_count: number;
  v1_wins: number;
  v2_wins: number;
  ties: number;
  v1_avg_error: number;
  v2_avg_error: number;
  best_day: { date: string; top5_hit_rate: number };
  worst_day: { date: string; top5_hit_rate: number };
  daily_results: BacktestResult[];
}

export default function HistoryPage() {
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [selectedDay, setSelectedDay] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backtest?days=${days}`);
      const json = await res.json();
      if (json.success) {
        setSummary(json.summary);
      } else {
        setError(json.error || 'Failed to run backtest');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric' 
  });

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/" className="text-blue-400 hover:underline">← Back</Link>
            <h1 className="text-3xl font-bold">📊 Historical Backtest</h1>
          </div>
          <p className="text-gray-400">
            Compare predictions against actual KOTC results
          </p>
        </header>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Days to analyze</label>
            <select 
              value={days} 
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="bg-gray-700 rounded px-3 py-2 text-white"
            >
              <option value={3}>Last 3 days</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          
          <button
            onClick={runBacktest}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-medium"
          >
            {loading ? 'Running...' : 'Run Backtest'}
          </button>
          
          {loading && (
            <span className="text-gray-400 text-sm">
              Fetching ESPN data... this may take a minute
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {summary && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Top 5 Hit Rate</div>
                <div className="text-2xl font-bold text-green-400">
                  {formatPercent(summary.avg_top5_hit_rate)}
                </div>
                <div className="text-xs text-gray-500">of top 5 picks in top 10</div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Top 10 Hit Rate</div>
                <div className="text-2xl font-bold text-blue-400">
                  {formatPercent(summary.avg_top10_hit_rate)}
                </div>
                <div className="text-xs text-gray-500">of top 10 picks in top 20</div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">#1 Pick Success</div>
                <div className="text-2xl font-bold text-yellow-400">
                  {summary.top1_hit_count}/{summary.total_days}
                </div>
                <div className="text-xs text-gray-500">#1 pick finished top 5</div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Model Winner</div>
                <div className="text-2xl font-bold">
                  {summary.v1_wins > summary.v2_wins ? (
                    <span className="text-blue-400">V1</span>
                  ) : summary.v2_wins > summary.v1_wins ? (
                    <span className="text-purple-400">V2</span>
                  ) : (
                    <span className="text-gray-400">Tie</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  V1: {summary.v1_wins} | V2: {summary.v2_wins} | Tie: {summary.ties}
                </div>
              </div>
            </div>

            {/* Model Comparison */}
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-3">Average Rank Error (lower is better)</h3>
              <div className="flex gap-8">
                <div>
                  <span className="text-blue-400 font-bold">V1:</span>{' '}
                  <span className="font-mono">{summary.v1_avg_error.toFixed(1)} positions</span>
                </div>
                <div>
                  <span className="text-purple-400 font-bold">V2:</span>{' '}
                  <span className="font-mono">{summary.v2_avg_error.toFixed(1)} positions</span>
                </div>
              </div>
            </div>

            {/* Daily Results */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <h3 className="font-semibold p-4 border-b border-gray-700">Daily Results</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-700 text-left text-sm text-gray-400">
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center">Players</th>
                    <th className="p-3 text-center">Top 5 Hit</th>
                    <th className="p-3 text-center">Top 10 Hit</th>
                    <th className="p-3 text-center">#1 Pick</th>
                    <th className="p-3 text-center">Winner</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daily_results.map((day) => (
                    <tr 
                      key={day.date}
                      className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => setSelectedDay(selectedDay?.date === day.date ? null : day)}
                    >
                      <td className="p-3 font-medium">{formatDate(day.date)}</td>
                      <td className="p-3 text-center">{day.total_players}</td>
                      <td className="p-3 text-center">
                        <span className={day.top5_hit_rate >= 0.6 ? 'text-green-400' : day.top5_hit_rate >= 0.4 ? 'text-yellow-400' : 'text-red-400'}>
                          {formatPercent(day.top5_hit_rate)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={day.top10_hit_rate >= 0.6 ? 'text-green-400' : day.top10_hit_rate >= 0.4 ? 'text-yellow-400' : 'text-red-400'}>
                          {formatPercent(day.top10_hit_rate)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {day.top1_accuracy ? '✅' : '❌'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={
                          day.winner === 'v1' ? 'text-blue-400' :
                          day.winner === 'v2' ? 'text-purple-400' : 'text-gray-400'
                        }>
                          {day.winner.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400">
                        {selectedDay?.date === day.date ? '▼' : '▶'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Expanded Day Details */}
              {selectedDay && (
                <div className="border-t border-gray-700 p-4 bg-gray-900/50">
                  <h4 className="font-semibold mb-3">
                    {formatDate(selectedDay.date)} - Top Predictions vs Actual
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="p-2">Player</th>
                          <th className="p-2 text-center">Predicted</th>
                          <th className="p-2 text-center">Actual</th>
                          <th className="p-2 text-center">Diff</th>
                          <th className="p-2 text-center">KOTC Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDay.predictions.slice(0, 15).map((p, i) => (
                          <tr key={i} className="border-t border-gray-700/50">
                            <td className="p-2">{p.player_name}</td>
                            <td className="p-2 text-center">#{p.predicted_rank}</td>
                            <td className="p-2 text-center">#{p.actual_rank}</td>
                            <td className="p-2 text-center">
                              <span className={
                                p.rank_diff <= 3 ? 'text-green-400' :
                                p.rank_diff <= 10 ? 'text-yellow-400' : 'text-red-400'
                              }>
                                {p.rank_diff > 0 ? '+' : ''}{p.rank_diff}
                              </span>
                            </td>
                            <td className="p-2 text-center font-mono">{p.kotc_points.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!summary && !loading && (
          <div className="text-center py-20 text-gray-500">
            Click "Run Backtest" to analyze historical accuracy
          </div>
        )}
      </div>
    </main>
  );
}
