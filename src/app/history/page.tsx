'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  KOTC_HISTORY, 
  MODEL_PREDICTIONS, 
  WINNER_PROFILE,
  calculateAccuracyStats,
  getUpcomingTuesdays,
  KOTCResult,
  ModelPrediction 
} from '@/lib/historical-data';

export default function HistoryPage() {
  const [selectedResult, setSelectedResult] = useState<KOTCResult | null>(null);
  const stats = calculateAccuracyStats(MODEL_PREDICTIONS);
  const upcomingTuesdays = getUpcomingTuesdays(4);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-gray-400 text-sm hover:text-white transition">
                ← Back to Predictions
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">
                <span className="text-amber-500">📊</span> Historical Results
              </h1>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">2024-25 Season</p>
              <p className="text-gray-600 text-xs">{KOTC_HISTORY.length} Tuesdays tracked</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Model Accuracy Card */}
        {stats && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-3">Model Performance</h2>
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-emerald-400">{stats.correct_rate.toFixed(0)}%</p>
                  <p className="text-gray-500 text-sm">Winner Correct</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-amber-400">{stats.top_3_rate.toFixed(0)}%</p>
                  <p className="text-gray-500 text-sm">Top 3 Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-white">{stats.top_5_rate.toFixed(0)}%</p>
                  <p className="text-gray-500 text-sm">Top 5 Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-white">#{stats.avg_winner_rank.toFixed(1)}</p>
                  <p className="text-gray-500 text-sm">Avg Rank</p>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-400">{stats.streak}</p>
                  <p className="text-gray-500 text-sm">Current Streak</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-emerald-500/20 flex justify-between items-center">
                <div>
                  <span className="text-gray-500 text-sm">Recent Form: </span>
                  <span className="text-emerald-400 font-semibold">{stats.recent_form}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Avg PRA Diff: </span>
                  <span className="text-white font-semibold">±{stats.avg_pra_difference.toFixed(1)} pts</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Winner Profile */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Typical KOTC Winner Profile</h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-gray-500 text-sm mb-1">Average Winning PRA</p>
                <p className="text-2xl font-bold text-amber-400">{WINNER_PROFILE.avg_pra}</p>
                <p className="text-gray-600 text-xs">Range: {WINNER_PROFILE.min_pra}-{WINNER_PROFILE.max_pra}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Triple-Double Rate</p>
                <p className="text-2xl font-bold text-white">{(WINNER_PROFILE.triple_double_rate * 100).toFixed(0)}%</p>
                <p className="text-gray-600 text-xs">4 of 7 winners</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Common Positions</p>
                <p className="text-2xl font-bold text-white">{WINNER_PROFILE.most_common_position}</p>
                <p className="text-gray-600 text-xs">High-usage playmakers</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Most Wins</p>
                <div className="space-y-1">
                  {WINNER_PROFILE.top_winners.slice(0, 3).map((w, i) => (
                    <div key={w.name} className="flex justify-between text-sm">
                      <span className={i === 0 ? 'text-amber-400' : 'text-gray-400'}>{w.name}</span>
                      <span className="text-white">{w.wins}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Upcoming Tuesdays */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Upcoming KOTC Tuesdays</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcomingTuesdays.map((date, i) => (
              <div 
                key={date}
                className={`flex-shrink-0 bg-gray-900/50 border rounded-lg p-4 min-w-[140px] ${
                  i === 0 ? 'border-amber-500/50' : 'border-gray-800'
                }`}
              >
                <p className={`text-xs ${i === 0 ? 'text-amber-500' : 'text-gray-500'}`}>
                  {i === 0 ? 'Next Up' : `In ${i} week${i > 1 ? 's' : ''}`}
                </p>
                <p className="text-white font-semibold">
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Historical Results Table */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">All KOTC Results (2024-25)</h2>
          
          {/* Desktop Table */}
          <div className="hidden md:block bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-900 text-left text-gray-500 text-sm">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Winner</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 text-center">PTS</th>
                  <th className="px-4 py-3 text-center">REB</th>
                  <th className="px-4 py-3 text-center">AST</th>
                  <th className="px-4 py-3 text-center">PRA</th>
                  <th className="px-4 py-3 text-center">Our Pick</th>
                  <th className="px-4 py-3 text-center">Result</th>
                </tr>
              </thead>
              <tbody>
                {KOTC_HISTORY.map((result, index) => {
                  const prediction = MODEL_PREDICTIONS.find(p => p.date === result.date);
                  return (
                    <tr 
                      key={result.date}
                      className="border-t border-gray-800/50 hover:bg-gray-800/30 transition cursor-pointer"
                      onClick={() => setSelectedResult(selectedResult?.date === result.date ? null : result)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white">{new Date(result.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-gray-600 text-xs">{result.num_games} games</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{result.winner.name}</td>
                      <td className="px-4 py-3 text-gray-400">{result.winner.team}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{result.winner.points}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{result.winner.rebounds}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{result.winner.assists}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-400 font-bold">{result.winner.pra}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        {prediction ? `#${prediction.predicted_rank_of_winner}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {prediction?.was_correct ? '✅' : prediction?.was_top_3 ? '🟡' : prediction?.was_top_5 ? '🔵' : '❌'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {KOTC_HISTORY.map((result) => {
              const prediction = MODEL_PREDICTIONS.find(p => p.date === result.date);
              return (
                <div 
                  key={result.date}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-4"
                  onClick={() => setSelectedResult(selectedResult?.date === result.date ? null : result)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-gray-500 text-sm">
                        {new Date(result.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-white font-semibold">{result.winner.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-xl">{result.winner.pra}</p>
                      <p className="text-gray-600 text-xs">PRA</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {result.winner.points}p / {result.winner.rebounds}r / {result.winner.assists}a
                    </span>
                    <span>
                      {prediction?.was_correct ? '✅ Correct' : prediction?.was_top_3 ? '🟡 Top 3' : '❌ Missed'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Model Predictions Timeline */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Prediction History</h2>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {MODEL_PREDICTIONS.map((pred, i) => (
                <div 
                  key={pred.date}
                  className={`flex-shrink-0 w-24 rounded-lg p-3 text-center ${
                    pred.was_correct 
                      ? 'bg-emerald-500/20 border border-emerald-500/30' 
                      : pred.was_top_3 
                        ? 'bg-amber-500/20 border border-amber-500/30'
                        : 'bg-gray-800/50 border border-gray-700'
                  }`}
                >
                  <p className="text-xs text-gray-500 mb-1">
                    {new Date(pred.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-2xl mb-1">
                    {pred.was_correct ? '✅' : pred.was_top_3 ? '🟡' : '❌'}
                  </p>
                  <p className="text-white text-sm font-semibold">#{pred.predicted_rank_of_winner}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-800 text-center text-gray-500 text-sm">
              <span className="inline-flex items-center gap-4">
                <span>✅ = Correct Pick</span>
                <span>🟡 = Top 3</span>
                <span>❌ = Outside Top 3</span>
              </span>
            </div>
          </div>
        </section>

        {/* Key Insights */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Key Insights</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-amber-500 font-semibold mb-3">🎯 What Works</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• High-usage playmakers (30%+ USG) dominate</li>
                <li>• Triple-double threats have 57% win rate</li>
                <li>• Close games (spread &lt;7) keep stars on floor</li>
                <li>• High O/U games (230+) correlate with big PRA</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h3 className="text-red-400 font-semibold mb-3">⚠️ Watch Out For</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Blowout risks reduce star minutes</li>
                <li>• Back-to-back games hurt production</li>
                <li>• Injury report changes (late scratches)</li>
                <li>• Unexpected breakout performances</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-gray-800 text-center text-gray-600 text-sm">
          <p>King of the Court Predictor • Historical Tracker</p>
          <p className="mt-1">
            <Link href="/" className="text-amber-500 hover:text-amber-400">
              ← Back to Today&apos;s Predictions
            </Link>
          </p>
        </footer>
      </main>

      {/* Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedResult(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-gray-500 text-sm">
                    {new Date(selectedResult.date + 'T00:00:00').toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                  <h3 className="text-2xl font-bold text-white">{selectedResult.winner.name}</h3>
                  <p className="text-gray-400">{selectedResult.winner.team}</p>
                </div>
                <button onClick={() => setSelectedResult(null)} className="text-gray-500 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">PTS</p>
                  <p className="text-xl font-bold text-white">{selectedResult.winner.points}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">REB</p>
                  <p className="text-xl font-bold text-white">{selectedResult.winner.rebounds}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-xs">AST</p>
                  <p className="text-xl font-bold text-white">{selectedResult.winner.assists}</p>
                </div>
                <div className="bg-emerald-500/20 rounded-lg p-3 text-center">
                  <p className="text-emerald-400 text-xs">PRA</p>
                  <p className="text-xl font-bold text-emerald-400">{selectedResult.winner.pra}</p>
                </div>
              </div>

              {selectedResult.runner_up && (
                <div className="bg-black/20 rounded-lg p-3 mb-4">
                  <p className="text-gray-500 text-xs mb-1">Runner-up</p>
                  <div className="flex justify-between">
                    <span className="text-white">{selectedResult.runner_up.name}</span>
                    <span className="text-gray-400">{selectedResult.runner_up.pra} PRA</span>
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500">
                <p>{selectedResult.num_games} games that night</p>
                {selectedResult.notes && <p className="mt-1 text-gray-600">{selectedResult.notes}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
