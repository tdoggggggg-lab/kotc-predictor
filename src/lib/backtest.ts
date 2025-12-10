// Historical Backtesting System
// Tracks predictions vs actual KOTC results

export interface HistoricalPrediction {
  date: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  predicted_rank: number;
  model_version: 'v1' | 'v2';
  v1_score: number;
  v2_score: number;
}

export interface ActualResult {
  date: string;
  player_id: string;
  player_name: string;
  kotc_points: number;  // Actual KOTC fantasy points
  actual_rank: number;  // Where they actually finished
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
  };
}

export interface BacktestResult {
  date: string;
  total_players: number;
  
  // Accuracy metrics
  top5_hit_rate: number;      // % of our top 5 that finished top 10
  top10_hit_rate: number;     // % of our top 10 that finished top 20
  top1_accuracy: number;      // Did our #1 finish top 5?
  
  // Comparison
  v1_avg_error: number;       // Avg rank difference (predicted vs actual)
  v2_avg_error: number;
  winner: 'v1' | 'v2' | 'tie';
  
  // Individual results
  predictions: Array<{
    player_name: string;
    predicted_rank: number;
    actual_rank: number;
    rank_diff: number;
    kotc_points: number;
  }>;
}

export interface BacktestSummary {
  total_days: number;
  date_range: { start: string; end: string };
  
  // Overall accuracy
  avg_top5_hit_rate: number;
  avg_top10_hit_rate: number;
  top1_hit_count: number;
  
  // Model comparison
  v1_wins: number;
  v2_wins: number;
  ties: number;
  v1_avg_error: number;
  v2_avg_error: number;
  
  // Best/worst days
  best_day: { date: string; top5_hit_rate: number };
  worst_day: { date: string; top5_hit_rate: number };
  
  daily_results: BacktestResult[];
}

// Calculate KOTC points from box score stats
export function calculateKOTCPoints(stats: ActualResult['stats']): number {
  // KOTC scoring: 1pt per point, 1.2 per rebound, 1.5 per assist, 
  // 3 per steal, 3 per block, -1 per turnover
  return (
    stats.points * 1 +
    stats.rebounds * 1.2 +
    stats.assists * 1.5 +
    stats.steals * 3 +
    stats.blocks * 3 -
    stats.turnovers * 1
  );
}

// Fetch historical box scores from ESPN for backtesting
export async function fetchHistoricalBoxScores(date: string): Promise<ActualResult[]> {
  console.log(`[KOTC Backtest] Fetching box scores for ${date}`);
  
  const results: ActualResult[] = [];
  const dateStr = date.replace(/-/g, '');
  
  try {
    // Get games for that date
    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
    const response = await fetch(scoreboardUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.log(`[KOTC Backtest] Could not fetch games for ${date}`);
      return results;
    }
    
    const data = await response.json();
    const events = data?.events || [];
    
    // For each completed game, get box scores
    for (const event of events) {
      const status = event.status?.type?.name;
      if (status !== 'STATUS_FINAL') continue;
      
      const gameId = event.id;
      
      try {
        // Fetch box score
        const boxScoreUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
        const boxResponse = await fetch(boxScoreUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!boxResponse.ok) continue;
        
        const boxData = await boxResponse.json();
        const boxScore = boxData?.boxscore;
        
        if (!boxScore?.players) continue;
        
        // Parse player stats from both teams
        for (const team of boxScore.players) {
          const teamAbbrev = team.team?.abbreviation || '';
          const statistics = team.statistics?.[0]; // First stat category is usually totals
          
          if (!statistics?.athletes) continue;
          
          for (const athlete of statistics.athletes) {
            const playerId = athlete.athlete?.id;
            const playerName = athlete.athlete?.displayName;
            
            if (!playerId || !playerName) continue;
            
            // Parse stats from the stats array
            // ESPN format: [MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS]
            const statsArr = athlete.stats || [];
            
            // Find opponent
            const competition = event.competitions?.[0];
            const teams = competition?.competitors || [];
            const opponent = teams.find((t: any) => t.team?.abbreviation !== teamAbbrev);
            const opponentAbbrev = opponent?.team?.abbreviation || '';
            
            const playerStats = {
              points: parseFloat(statsArr[13]) || 0,
              rebounds: parseFloat(statsArr[6]) || 0,
              assists: parseFloat(statsArr[7]) || 0,
              steals: parseFloat(statsArr[8]) || 0,
              blocks: parseFloat(statsArr[9]) || 0,
              turnovers: parseFloat(statsArr[10]) || 0
            };
            
            const kotcPoints = calculateKOTCPoints(playerStats);
            
            results.push({
              date,
              player_id: playerId,
              player_name: playerName,
              kotc_points: kotcPoints,
              actual_rank: 0, // Will be calculated after sorting
              stats: playerStats
            });
          }
        }
      } catch (err) {
        console.log(`[KOTC Backtest] Error fetching box score for game ${gameId}`);
      }
    }
    
    // Sort by KOTC points and assign ranks
    results.sort((a, b) => b.kotc_points - a.kotc_points);
    results.forEach((r, i) => r.actual_rank = i + 1);
    
    console.log(`[KOTC Backtest] Got ${results.length} player results for ${date}`);
    return results;
    
  } catch (error) {
    console.error(`[KOTC Backtest] Error:`, error);
    return results;
  }
}

// Compare predictions against actual results
export function compareResults(
  predictions: HistoricalPrediction[],
  actuals: ActualResult[]
): BacktestResult {
  const date = predictions[0]?.date || actuals[0]?.date || '';
  
  // Create lookup by player name (normalized)
  const actualMap = new Map<string, ActualResult>();
  for (const actual of actuals) {
    const key = actual.player_name.toLowerCase().replace(/[^a-z]/g, '');
    actualMap.set(key, actual);
  }
  
  const results: BacktestResult['predictions'] = [];
  let v1TotalError = 0;
  let v2TotalError = 0;
  let v1Count = 0;
  let v2Count = 0;
  
  for (const pred of predictions) {
    const key = pred.player_name.toLowerCase().replace(/[^a-z]/g, '');
    const actual = actualMap.get(key);
    
    if (!actual) continue;
    
    const rankDiff = Math.abs(pred.predicted_rank - actual.actual_rank);
    
    results.push({
      player_name: pred.player_name,
      predicted_rank: pred.predicted_rank,
      actual_rank: actual.actual_rank,
      rank_diff: rankDiff,
      kotc_points: actual.kotc_points
    });
    
    if (pred.model_version === 'v1') {
      v1TotalError += rankDiff;
      v1Count++;
    } else {
      v2TotalError += rankDiff;
      v2Count++;
    }
  }
  
  // Calculate hit rates
  const top5Predicted = results.filter(r => r.predicted_rank <= 5);
  const top5Hits = top5Predicted.filter(r => r.actual_rank <= 10).length;
  const top5HitRate = top5Predicted.length > 0 ? top5Hits / top5Predicted.length : 0;
  
  const top10Predicted = results.filter(r => r.predicted_rank <= 10);
  const top10Hits = top10Predicted.filter(r => r.actual_rank <= 20).length;
  const top10HitRate = top10Predicted.length > 0 ? top10Hits / top10Predicted.length : 0;
  
  const top1 = results.find(r => r.predicted_rank === 1);
  const top1Accuracy = top1 && top1.actual_rank <= 5 ? 1 : 0;
  
  const v1AvgError = v1Count > 0 ? v1TotalError / v1Count : 0;
  const v2AvgError = v2Count > 0 ? v2TotalError / v2Count : 0;
  
  let winner: 'v1' | 'v2' | 'tie' = 'tie';
  if (v1AvgError < v2AvgError - 1) winner = 'v1';
  else if (v2AvgError < v1AvgError - 1) winner = 'v2';
  
  return {
    date,
    total_players: results.length,
    top5_hit_rate: top5HitRate,
    top10_hit_rate: top10HitRate,
    top1_accuracy: top1Accuracy,
    v1_avg_error: v1AvgError,
    v2_avg_error: v2AvgError,
    winner,
    predictions: results.sort((a, b) => a.predicted_rank - b.predicted_rank)
  };
}

// Generate summary from multiple backtest results
export function generateSummary(results: BacktestResult[]): BacktestSummary {
  if (results.length === 0) {
    return {
      total_days: 0,
      date_range: { start: '', end: '' },
      avg_top5_hit_rate: 0,
      avg_top10_hit_rate: 0,
      top1_hit_count: 0,
      v1_wins: 0,
      v2_wins: 0,
      ties: 0,
      v1_avg_error: 0,
      v2_avg_error: 0,
      best_day: { date: '', top5_hit_rate: 0 },
      worst_day: { date: '', top5_hit_rate: 0 },
      daily_results: []
    };
  }
  
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  
  let totalTop5 = 0;
  let totalTop10 = 0;
  let top1Hits = 0;
  let v1Wins = 0;
  let v2Wins = 0;
  let ties = 0;
  let totalV1Error = 0;
  let totalV2Error = 0;
  
  let bestDay = results[0];
  let worstDay = results[0];
  
  for (const r of results) {
    totalTop5 += r.top5_hit_rate;
    totalTop10 += r.top10_hit_rate;
    top1Hits += r.top1_accuracy;
    totalV1Error += r.v1_avg_error;
    totalV2Error += r.v2_avg_error;
    
    if (r.winner === 'v1') v1Wins++;
    else if (r.winner === 'v2') v2Wins++;
    else ties++;
    
    if (r.top5_hit_rate > bestDay.top5_hit_rate) bestDay = r;
    if (r.top5_hit_rate < worstDay.top5_hit_rate) worstDay = r;
  }
  
  return {
    total_days: results.length,
    date_range: {
      start: sorted[0].date,
      end: sorted[sorted.length - 1].date
    },
    avg_top5_hit_rate: totalTop5 / results.length,
    avg_top10_hit_rate: totalTop10 / results.length,
    top1_hit_count: top1Hits,
    v1_wins: v1Wins,
    v2_wins: v2Wins,
    ties,
    v1_avg_error: totalV1Error / results.length,
    v2_avg_error: totalV2Error / results.length,
    best_day: { date: bestDay.date, top5_hit_rate: bestDay.top5_hit_rate },
    worst_day: { date: worstDay.date, top5_hit_rate: worstDay.top5_hit_rate },
    daily_results: sorted
  };
}
