'use client';

import { useState, useEffect } from 'react';

interface ComponentScores {
  recent_pra: number;
  ceiling_factor: number;
  volume: number;
  matchup: number;
  environment: number;
}

interface PlayerStats {
  avg_pra_last_10: number;
  max_pra_last_10: number;
  std_dev_pra: number;
  usage_rate: number;
  minutes_per_game: number;
  triple_doubles: number;
  ppg?: number;
  rpg?: number;
  apg?: number;
}

interface GameContext {
  spread: number | null;
  over_under: number | null;
  is_home: boolean;
}

interface Prediction {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  matchup: string;
  opponent: string;
  headshot?: string | null;
  projected_pra: number;
  ceiling_pra: number;
  ceiling_score: number;
  component_scores: ComponentScores;
  stats: PlayerStats;
  game_context: GameContext;
  key_factors: string[];
  confidence: string;
  last_10_pra?: number[];
}

interface Game {
  game_id: string;
  matchup: string;
  game_time: string;
  home_team: string;
  away_team: string;
  spread: number | null;
  over_under: number | null;
}

interface PredictionData {
  generated_at: string;
  game_date: string;
  num_games: number;
  num_players: number;
  using_mock_data: boolean;
  data_source?: string;
  games: Game[];
  predictions: Prediction[];
}

export default function Home() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Prediction | null>(null);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [modelVersion, setModelVersion] = useState<'v1' | 'v2'>('v1');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePlayers, setComparePlayers] = useState<Prediction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Get upcoming Tuesdays for date picker
  const getUpcomingTuesdays = () => {
    const tuesdays: string[] = [];
    const today = new Date();
    const current = new Date(today);
    
    // Go back to find recent Tuesday
    while (current.getDay() !== 2) {
      current.setDate(current.getDate() - 1);
    }
    current.setDate(current.getDate() - 7); // One more week back
    
    // Get 6 Tuesdays (2 past, current/next, 3 future)
    for (let i = 0; i < 6; i++) {
      tuesdays.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 7);
    }
    
    return tuesdays;
  };

  const upcomingTuesdays = getUpcomingTuesdays();

  useEffect(() => {
    fetchPredictions();
  }, [modelVersion, selectedDate]);

  async function fetchPredictions() {
    try {
      setLoading(true);
      const response = await fetch(`/api/predictions?model=${modelVersion}&date=${selectedDate}`);
      if (!response.ok) throw new Error('Failed to fetch predictions');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPredictions();
    setRefreshing(false);
  }

  async function runBacktest() {
    try {
      setBacktestLoading(true);
      const response = await fetch('/api/backtest');
      if (!response.ok) throw new Error('Failed to run backtest');
      const result = await response.json();
      setBacktestData(result);
      setShowBacktest(true);
    } catch (err) {
      console.error('Backtest error:', err);
    } finally {
      setBacktestLoading(false);
    }
  }

  function toggleComparePlayer(player: Prediction) {
    if (comparePlayers.find(p => p.player_id === player.player_id)) {
      setComparePlayers(comparePlayers.filter(p => p.player_id !== player.player_id));
    } else if (comparePlayers.length < 3) {
      setComparePlayers([...comparePlayers, player]);
    }
  }

  function isPlayerCompared(playerId: string) {
    return comparePlayers.some(p => p.player_id === playerId);
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'text-emerald-400';
      case 'Medium': return 'text-amber-400';
      case 'Low': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-gray-400';
  };

  const displayedPredictions = showAllPlayers 
    ? data?.predictions || []
    : (data?.predictions || []).slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading predictions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center text-red-400">
          <p className="text-xl mb-2">Error loading predictions</p>
          <p className="text-gray-500">{error}</p>
          <button 
            onClick={fetchPredictions}
            className="mt-4 px-6 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="text-amber-500">👑</span> King of the Court
              </h1>
              <p className="text-gray-500 text-sm">DraftKings PRA Predictor</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Model Toggle */}
              <div className="hidden sm:flex items-center bg-gray-900 rounded-lg p-1">
                <button
                  onClick={() => setModelVersion('v1')}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    modelVersion === 'v1' 
                      ? 'bg-amber-500 text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  V1
                </button>
                <button
                  onClick={() => setModelVersion('v2')}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    modelVersion === 'v2' 
                      ? 'bg-emerald-500 text-black' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  V2 ML
                </button>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-2 bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                title="Refresh data"
              >
                <svg 
                  className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <a 
                href="/history" 
                className="text-gray-400 hover:text-amber-500 transition text-sm hidden sm:block"
              >
                📊 History
              </a>
              <div className="text-right">
                <p className="text-gray-400 text-sm">
                  {data?.game_date && new Date(data.game_date + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="text-gray-600 text-xs">
                  {data?.num_games} games • {data?.num_players} players
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Model Info Banner */}
      {!loading && (
        <div className={`border-b ${modelVersion === 'v2' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  modelVersion === 'v2' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'
                }`}>
                  {modelVersion === 'v2' ? 'ML MODEL V2' : 'MODEL V1'}
                </span>
                <span className="text-gray-400">
                  {modelVersion === 'v2' 
                    ? '🎯 Game Context Focus: High O/U, close games, hot streaks'
                    : '📊 Stats Focus: Raw PRA, usage rate, ceiling potential'
                  }
                </span>
              </div>
              {/* Mobile model toggle */}
              <div className="sm:hidden flex items-center bg-gray-900 rounded-lg p-1">
                <button
                  onClick={() => setModelVersion('v1')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                    modelVersion === 'v1' ? 'bg-amber-500 text-black' : 'text-gray-400'
                  }`}
                >
                  V1
                </button>
                <button
                  onClick={() => setModelVersion('v2')}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                    modelVersion === 'v2' ? 'bg-emerald-500 text-black' : 'text-gray-400'
                  }`}
                >
                  V2
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker & Compare Toggle */}
      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-gray-500 text-sm whitespace-nowrap">📅 Tuesday:</span>
              {upcomingTuesdays.map((date) => {
                const dateObj = new Date(date + 'T00:00:00');
                const isSelected = date === selectedDate;
                const isToday = date === new Date().toISOString().split('T')[0];
                const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));
                
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                      isSelected
                        ? 'bg-amber-500 text-black font-semibold'
                        : isPast
                          ? 'bg-gray-800/50 text-gray-500 hover:bg-gray-800'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {isToday && <span className="ml-1 text-xs">•</span>}
                  </button>
                );
              })}
            </div>
            
            {/* Compare Toggle */}
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                if (compareMode) setComparePlayers([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                compareMode
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              ⚖️ Compare {compareMode && comparePlayers.length > 0 && `(${comparePlayers.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Panel */}
      {compareMode && comparePlayers.length > 0 && (
        <div className="border-b border-blue-500/30 bg-blue-500/5">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">⚖️ Player Comparison</h3>
              <button
                onClick={() => setComparePlayers([])}
                className="text-gray-500 hover:text-white text-sm"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparePlayers.map((player, index) => (
                <div key={player.player_id} className="bg-gray-900/80 border border-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-white font-semibold">{player.player_name}</p>
                      <p className="text-gray-500 text-sm">{player.team} • {player.position}</p>
                    </div>
                    <button
                      onClick={() => toggleComparePlayer(player)}
                      className="text-gray-500 hover:text-red-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Score</p>
                      <p className="text-amber-400 font-bold">{player.ceiling_score}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Proj PRA</p>
                      <p className="text-white font-bold">{player.projected_pra}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Ceiling</p>
                      <p className="text-emerald-400 font-bold">{player.ceiling_pra}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Usage</span>
                      <span className="text-white">{player.stats.usage_rate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Minutes</span>
                      <span className="text-white">{player.stats.minutes_per_game} MPG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Avg PRA</span>
                      <span className="text-white">{player.stats.avg_pra_last_10}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max PRA</span>
                      <span className="text-white">{player.stats.max_pra_last_10}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-gray-500 text-xs mb-1">Key Factors</p>
                    <div className="flex flex-wrap gap-1">
                      {player.key_factors.slice(0, 2).map((factor, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              
              {comparePlayers.length < 3 && (
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 flex items-center justify-center text-gray-500 text-sm">
                  Click players below to compare (max 3)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mock Data Warning Banner */}
      {data?.using_mock_data && (
        <div className="bg-amber-500/20 border-y border-amber-500/50">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-400 font-semibold">Demo Mode - Using Sample Data</p>
                <p className="text-amber-400/70 text-sm">
                  {data.data_source === 'mock (no games)' 
                    ? 'No NBA games scheduled for this date. Showing sample predictions.'
                    : 'Live ESPN data unavailable. Showing sample predictions for demonstration.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Data Indicator */}
      {data && !data.using_mock_data && (
        <div className="bg-emerald-500/10 border-y border-emerald-500/30">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 text-sm font-medium">
                Live Data from ESPN • {data.num_players} players from {data.num_games} games
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Games Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-3">Today&apos;s Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data?.games.map((game) => (
              <div key={game.game_id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-white">{game.matchup}</span>
                  <span className="text-gray-500 text-sm">{game.game_time}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  {game.spread && (
                    <span className="text-gray-400">
                      Spread: <span className="text-white">{game.spread > 0 ? '+' : ''}{game.spread}</span>
                    </span>
                  )}
                  {game.over_under && (
                    <span className="text-gray-400">
                      O/U: <span className="text-white">{game.over_under}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Pick Highlight */}
        {data?.predictions[0] && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-amber-500 text-sm font-semibold mb-1">🏆 TOP PICK</p>
                  <h3 className="text-3xl font-bold text-white mb-1">{data.predictions[0].player_name}</h3>
                  <p className="text-gray-400">{data.predictions[0].team} • {data.predictions[0].position} • {data.predictions[0].matchup}</p>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-bold text-amber-500">{data.predictions[0].ceiling_score.toFixed(1)}</p>
                  <p className="text-gray-500 text-sm">Ceiling Score</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Projected PRA</p>
                  <p className="text-2xl font-bold text-white">{data.predictions[0].projected_pra}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Ceiling PRA</p>
                  <p className="text-2xl font-bold text-emerald-400">{data.predictions[0].ceiling_pra}</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Usage Rate</p>
                  <p className="text-2xl font-bold text-white">{data.predictions[0].stats.usage_rate}%</p>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Triple-Doubles</p>
                  <p className="text-2xl font-bold text-white">{data.predictions[0].stats.triple_doubles}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.predictions[0].key_factors.map((factor, i) => (
                  <span key={i} className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Rankings Table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300">All Rankings</h2>
            <button
              onClick={() => setShowAllPlayers(!showAllPlayers)}
              className="text-amber-500 text-sm hover:text-amber-400 transition"
            >
              {showAllPlayers ? 'Show Top 5' : `Show All ${data?.predictions.length}`}
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm border-b border-gray-800">
                  {compareMode && <th className="pb-3 pr-2 w-10"></th>}
                  <th className="pb-3 pr-4">Rank</th>
                  <th className="pb-3 pr-4">Player</th>
                  <th className="pb-3 pr-4">Team</th>
                  <th className="pb-3 pr-4">Matchup</th>
                  <th className="pb-3 pr-4 text-right">Proj PRA</th>
                  <th className="pb-3 pr-4 text-right">Ceiling</th>
                  <th className="pb-3 pr-4 text-right">Score</th>
                  <th className="pb-3 pr-4 text-right">Confidence</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayedPredictions.map((player, index) => (
                  <tr 
                    key={player.player_id}
                    className={`border-b border-gray-800/50 hover:bg-gray-900/50 transition cursor-pointer ${
                      index === 0 ? 'bg-amber-500/5' : ''
                    } ${isPlayerCompared(player.player_id) ? 'bg-blue-500/10' : ''}`}
                    onClick={() => {
                      if (compareMode) {
                        toggleComparePlayer(player);
                      } else {
                        setSelectedPlayer(selectedPlayer?.player_id === player.player_id ? null : player);
                      }
                    }}
                  >
                    {compareMode && (
                      <td className="py-4 pr-2">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isPlayerCompared(player.player_id) 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'border-gray-600'
                        }`}>
                          {isPlayerCompared(player.player_id) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="py-4 pr-4">
                      <span className={`font-bold ${index < 3 ? 'text-amber-500' : 'text-gray-500'}`}>
                        {index === 0 ? '👑' : index + 1}
                      </span>
                    </td>
                    <td className="py-4 pr-4 font-semibold text-white">{player.player_name}</td>
                    <td className="py-4 pr-4 text-gray-400">{player.team}</td>
                    <td className="py-4 pr-4 text-gray-400">{player.matchup}</td>
                    <td className="py-4 pr-4 text-right font-mono">{player.projected_pra}</td>
                    <td className="py-4 pr-4 text-right font-mono text-emerald-400">{player.ceiling_pra}</td>
                    <td className={`py-4 pr-4 text-right font-bold ${getScoreColor(player.ceiling_score)}`}>
                      {player.ceiling_score.toFixed(1)}
                    </td>
                    <td className={`py-4 pr-4 text-right ${getConfidenceColor(player.confidence)}`}>
                      {player.confidence}
                    </td>
                    <td className="py-4 text-gray-600">
                      <svg className={`w-4 h-4 transition ${selectedPlayer?.player_id === player.player_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {displayedPredictions.map((player, index) => (
              <div 
                key={player.player_id}
                className={`bg-gray-900/50 border border-gray-800 rounded-lg p-4 ${
                  index === 0 ? 'border-amber-500/30' : ''
                } ${isPlayerCompared(player.player_id) ? 'border-blue-500/50 bg-blue-500/5' : ''}`}
                onClick={() => {
                  if (compareMode) {
                    toggleComparePlayer(player);
                  } else {
                    setSelectedPlayer(selectedPlayer?.player_id === player.player_id ? null : player);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {compareMode && (
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isPlayerCompared(player.player_id) 
                          ? 'bg-blue-500 border-blue-500' 
                          : 'border-gray-600'
                      }`}>
                        {isPlayerCompared(player.player_id) && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    )}
                    <span className={`font-bold ${index < 3 ? 'text-amber-500' : 'text-gray-500'} mr-2`}>
                      {index === 0 ? '👑' : `#${index + 1}`}
                    </span>
                    <span className="font-semibold text-white">{player.player_name}</span>
                  </div>
                  <span className={`font-bold text-lg ${getScoreColor(player.ceiling_score)}`}>
                    {player.ceiling_score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{player.team} • {player.position}</span>
                  <span>{player.matchup}</span>
                  <span className={getConfidenceColor(player.confidence)}>{player.confidence}</span>
                </div>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-gray-500">Proj: <span className="text-white">{player.projected_pra}</span></span>
                  <span className="text-gray-500">Ceiling: <span className="text-emerald-400">{player.ceiling_pra}</span></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Player Detail Modal */}
        {selectedPlayer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlayer(null)}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white">{selectedPlayer.player_name}</h3>
                    <p className="text-gray-400">{selectedPlayer.team} • {selectedPlayer.position} • {selectedPlayer.matchup}</p>
                  </div>
                  <button onClick={() => setSelectedPlayer(null)} className="text-gray-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-gray-500 text-xs">Ceiling Score</p>
                    <p className={`text-3xl font-bold ${getScoreColor(selectedPlayer.ceiling_score)}`}>
                      {selectedPlayer.ceiling_score.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-gray-500 text-xs">Projected PRA</p>
                    <p className="text-3xl font-bold text-white">{selectedPlayer.projected_pra}</p>
                  </div>
                  <div className="bg-black/30 rounded-lg p-4">
                    <p className="text-gray-500 text-xs">Ceiling PRA</p>
                    <p className="text-3xl font-bold text-emerald-400">{selectedPlayer.ceiling_pra}</p>
                  </div>
                </div>

                {/* Component Scores */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Component Scores</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Recent PRA (30%)', value: selectedPlayer.component_scores.recent_pra },
                      { label: 'Ceiling Factor (25%)', value: selectedPlayer.component_scores.ceiling_factor },
                      { label: 'Volume (20%)', value: selectedPlayer.component_scores.volume },
                      { label: 'Matchup (15%)', value: selectedPlayer.component_scores.matchup },
                      { label: 'Environment (10%)', value: selectedPlayer.component_scores.environment },
                    ].map((comp) => (
                      <div key={comp.label} className="flex items-center gap-3">
                        <span className="text-gray-500 text-sm w-40">{comp.label}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${comp.value}%` }}
                          />
                        </div>
                        <span className="text-white font-mono text-sm w-12 text-right">{comp.value.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Statistics</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Avg PRA</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.avg_pra_last_10}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Max PRA</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.max_pra_last_10}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Usage</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.usage_rate}%</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Minutes</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.minutes_per_game}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Triple-Dbl</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.triple_doubles}</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-500 text-xs">Std Dev</p>
                      <p className="text-white font-bold">{selectedPlayer.stats.std_dev_pra}</p>
                    </div>
                  </div>
                </div>

                {/* Last 10 PRA Chart */}
                {selectedPlayer.last_10_pra && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">Last 10 Games PRA</h4>
                    <div className="flex items-end gap-1 h-24">
                      {selectedPlayer.last_10_pra.map((pra, i) => (
                        <div 
                          key={i}
                          className="flex-1 bg-amber-500/30 hover:bg-amber-500 transition rounded-t relative group"
                          style={{ height: `${(pra / Math.max(...selectedPlayer.last_10_pra!)) * 100}%` }}
                        >
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">
                            {pra}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>10 games ago</span>
                      <span>Last game</span>
                    </div>
                  </div>
                )}

                {/* Key Factors */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">Key Factors</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlayer.key_factors.map((factor, i) => (
                      <span key={i} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backtest Section */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300">📊 Model Backtest</h2>
            <button
              onClick={runBacktest}
              disabled={backtestLoading}
              className="px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {backtestLoading ? 'Running...' : 'Run Backtest'}
            </button>
          </div>
          
          {showBacktest && backtestData?.summary && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs mb-1">Winner Correct</p>
                  <p className="text-2xl font-bold text-emerald-400">{backtestData.summary.winner_hit_rate.toFixed(0)}%</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs mb-1">Winner in Top 3</p>
                  <p className="text-2xl font-bold text-amber-400">{backtestData.summary.top_3_hit_rate.toFixed(0)}%</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs mb-1">Winner in Top 5</p>
                  <p className="text-2xl font-bold text-white">{backtestData.summary.top_5_hit_rate.toFixed(0)}%</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-gray-500 text-xs mb-1">Avg Winner Rank</p>
                  <p className="text-2xl font-bold text-white">#{backtestData.summary.avg_winner_rank.toFixed(1)}</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-800">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Actual Winner</th>
                      <th className="pb-2 text-right">PRA</th>
                      <th className="pb-2 text-right">Our Rank</th>
                      <th className="pb-2 text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtestData.summary.results.map((result: any) => (
                      <tr key={result.date} className="border-b border-gray-800/50">
                        <td className="py-2 text-gray-400">{result.date}</td>
                        <td className="py-2 text-white">{result.actual_winner?.player_name}</td>
                        <td className="py-2 text-right text-emerald-400">{result.actual_winner?.pra}</td>
                        <td className="py-2 text-right">
                          {result.predicted_rank_of_winner ? `#${result.predicted_rank_of_winner}` : 'N/A'}
                        </td>
                        <td className="py-2 text-center">
                          {result.winner_in_top_3 ? '✅' : result.winner_in_top_5 ? '🟡' : '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <p className="text-gray-600 text-xs mt-4 text-center">
                ✅ = Top 3 | 🟡 = Top 5 | ❌ = Outside Top 5
              </p>
            </div>
          )}
          
          {!showBacktest && (
            <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center">
              <p className="text-gray-500">
                Run a backtest to see how the model would have performed on past King of the Court Tuesdays
              </p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-600 text-sm">
          <p>
            King of the Court Predictor • 
            <span className={modelVersion === 'v2' ? 'text-emerald-500' : 'text-amber-500'}>
              {' '}{modelVersion === 'v2' ? 'ML Model V2' : 'Model V1 (Weighted)'}
            </span>
          </p>
          <p className="mt-1">
            {data?.data_source && (
              <span className={data?.using_mock_data ? 'text-amber-500/50' : 'text-emerald-500/50'}>
                Data: {data.data_source} • 
              </span>
            )}
            {' '}Last updated: {data?.generated_at && new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </footer>
      </main>
    </div>
  );
}
