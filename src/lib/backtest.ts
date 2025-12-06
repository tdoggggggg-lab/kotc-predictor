/**
 * Backtesting Module for King of the Court Predictions
 * 
 * Tests the prediction model against historical NBA game data
 * to calculate accuracy metrics.
 */

import { Game, EnhancedPlayerData } from './espn-data';
import { predictAllPlayers, Prediction } from './prediction-model';

// ESPN API for historical data
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

export interface GameResult {
  game_id: string;
  game_date: string;
  matchup: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
}

export interface PlayerGameResult {
  player_id: string;
  player_name: string;
  team: string;
  points: number;
  rebounds: number;
  assists: number;
  pra: number;
  minutes: number;
  game_id: string;
}

export interface BacktestResult {
  date: string;
  num_games: number;
  num_players_predicted: number;
  
  // Actual results
  actual_winner: PlayerGameResult | null;
  actual_top_5: PlayerGameResult[];
  
  // Our predictions
  predicted_winner: Prediction | null;
  predicted_top_5: Prediction[];
  
  // Accuracy metrics
  winner_correct: boolean;
  winner_in_top_3: boolean;
  winner_in_top_5: boolean;
  winner_in_top_10: boolean;
  predicted_rank_of_winner: number | null;
  
  // Score comparison
  predicted_pra: number;
  actual_pra: number;
  pra_difference: number;
}

export interface BacktestSummary {
  dates_tested: number;
  total_games: number;
  
  // Hit rates
  winner_hit_rate: number;
  top_3_hit_rate: number;
  top_5_hit_rate: number;
  top_10_hit_rate: number;
  
  // Average metrics
  avg_winner_rank: number;
  avg_pra_difference: number;
  
  // Best/worst
  best_prediction: BacktestResult | null;
  worst_prediction: BacktestResult | null;
  
  // Detailed results
  results: BacktestResult[];
}

/**
 * Get all Tuesdays in the current NBA season
 */
export function getTuesdaysInSeason(startDate?: string, endDate?: string): string[] {
  const start = startDate ? new Date(startDate) : new Date('2024-10-22'); // Season start
  const end = endDate ? new Date(endDate) : new Date();
  
  const tuesdays: string[] = [];
  const current = new Date(start);
  
  // Find first Tuesday
  while (current.getDay() !== 2) {
    current.setDate(current.getDate() + 1);
  }
  
  // Collect all Tuesdays
  while (current <= end) {
    tuesdays.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 7);
  }
  
  return tuesdays;
}

/**
 * Fetch completed game results for a date
 */
export async function fetchGameResults(date: string): Promise<GameResult[]> {
  const dateFormatted = date.replace(/-/g, '');
  
  try {
    const url = `${ESPN_BASE}/scoreboard?dates=${dateFormatted}`;
    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours (historical data)
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = data.events || [];
    
    return events
      .filter((event: any) => event.status?.type?.completed)
      .map((event: any) => {
        const competition = event.competitions?.[0] || {};
        const competitors = competition.competitors || [];
        const home = competitors.find((c: any) => c.homeAway === 'home');
        const away = competitors.find((c: any) => c.homeAway === 'away');
        
        return {
          game_id: event.id,
          game_date: date,
          matchup: `${away?.team?.abbreviation}@${home?.team?.abbreviation}`,
          home_team: home?.team?.displayName || '',
          away_team: away?.team?.displayName || '',
          home_score: parseInt(home?.score) || 0,
          away_score: parseInt(away?.score) || 0,
          status: event.status?.type?.name || '',
        };
      });
  } catch (error) {
    console.error(`Error fetching game results for ${date}:`, error);
    return [];
  }
}

/**
 * Fetch box score for a specific game
 */
export async function fetchBoxScore(gameId: string): Promise<PlayerGameResult[]> {
  try {
    const url = `${ESPN_BASE}/summary?event=${gameId}`;
    const response = await fetch(url, {
      next: { revalidate: 86400 },
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const boxscore = data.boxscore || {};
    const players = boxscore.players || [];
    
    const results: PlayerGameResult[] = [];
    
    for (const team of players) {
      const teamAbbrev = team.team?.abbreviation || '';
      const statistics = team.statistics || [];
      
      // Find the stats array
      const playerStats = statistics[0]?.athletes || [];
      
      for (const player of playerStats) {
        const stats = player.stats || [];
        const athlete = player.athlete || {};
        
        // ESPN box score stats order varies, so we need to find by label
        let points = 0, rebounds = 0, assists = 0, minutes = 0;
        
        // Parse stats array (usually: MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS)
        if (stats.length >= 14) {
          minutes = parseMinutes(stats[0]);
          rebounds = parseInt(stats[6]) || 0;
          assists = parseInt(stats[7]) || 0;
          points = parseInt(stats[13]) || 0;
        }
        
        if (minutes > 0) {
          results.push({
            player_id: athlete.id || '',
            player_name: athlete.displayName || '',
            team: teamAbbrev,
            points,
            rebounds,
            assists,
            pra: points + rebounds + assists,
            minutes,
            game_id: gameId,
          });
        }
      }
    }
    
    return results.sort((a, b) => b.pra - a.pra);
  } catch (error) {
    console.error(`Error fetching box score for game ${gameId}:`, error);
    return [];
  }
}

/**
 * Parse minutes string (e.g., "35:42" -> 35)
 */
function parseMinutes(minStr: string): number {
  if (!minStr) return 0;
  const parts = minStr.split(':');
  return parseInt(parts[0]) || 0;
}

/**
 * Get all player results for a date (across all games)
 */
export async function getAllPlayerResults(date: string): Promise<PlayerGameResult[]> {
  const games = await fetchGameResults(date);
  
  if (games.length === 0) {
    console.log(`No completed games for ${date}`);
    return [];
  }
  
  const allResults: PlayerGameResult[] = [];
  
  for (const game of games) {
    const boxScore = await fetchBoxScore(game.game_id);
    allResults.push(...boxScore);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Sort by PRA descending
  return allResults.sort((a, b) => b.pra - a.pra);
}

/**
 * Run backtest for a single date
 */
export async function backtestDate(
  date: string,
  predictions: Prediction[]
): Promise<BacktestResult | null> {
  console.log(`Backtesting ${date}...`);
  
  // Get actual results
  const actualResults = await getAllPlayerResults(date);
  
  if (actualResults.length === 0) {
    console.log(`No results available for ${date}`);
    return null;
  }
  
  const actualWinner = actualResults[0];
  const actualTop5 = actualResults.slice(0, 5);
  
  // Find where our predicted winner actually finished
  const predictedWinner = predictions[0];
  const predictedTop5 = predictions.slice(0, 5);
  
  // Find the actual rank of our predicted winner
  const actualRankOfPrediction = actualResults.findIndex(
    p => p.player_name.toLowerCase() === predictedWinner?.player_name.toLowerCase()
  ) + 1;
  
  // Check if actual winner was in our predictions
  const predictedRankOfWinner = predictions.findIndex(
    p => p.player_name.toLowerCase() === actualWinner.player_name.toLowerCase()
  ) + 1;
  
  const result: BacktestResult = {
    date,
    num_games: (await fetchGameResults(date)).length,
    num_players_predicted: predictions.length,
    
    actual_winner: actualWinner,
    actual_top_5: actualTop5,
    
    predicted_winner: predictedWinner,
    predicted_top_5: predictedTop5,
    
    winner_correct: predictedRankOfWinner === 1,
    winner_in_top_3: predictedRankOfWinner > 0 && predictedRankOfWinner <= 3,
    winner_in_top_5: predictedRankOfWinner > 0 && predictedRankOfWinner <= 5,
    winner_in_top_10: predictedRankOfWinner > 0 && predictedRankOfWinner <= 10,
    predicted_rank_of_winner: predictedRankOfWinner > 0 ? predictedRankOfWinner : null,
    
    predicted_pra: predictedWinner?.projected_pra || 0,
    actual_pra: actualWinner.pra,
    pra_difference: Math.abs((predictedWinner?.projected_pra || 0) - actualWinner.pra),
  };
  
  console.log(`  Winner: ${actualWinner.player_name} (${actualWinner.pra} PRA)`);
  console.log(`  Our #1: ${predictedWinner?.player_name} (actual rank: ${actualRankOfPrediction || 'not found'})`);
  console.log(`  Actual winner was our #${predictedRankOfWinner || 'not in predictions'}`);
  
  return result;
}

/**
 * Run full backtest across multiple dates
 */
export async function runBacktest(
  dates: string[],
  getPredictionsForDate: (date: string) => Promise<Prediction[]>
): Promise<BacktestSummary> {
  const results: BacktestResult[] = [];
  
  for (const date of dates) {
    try {
      const predictions = await getPredictionsForDate(date);
      
      if (predictions.length === 0) {
        console.log(`No predictions generated for ${date}, skipping`);
        continue;
      }
      
      const result = await backtestDate(date, predictions);
      
      if (result) {
        results.push(result);
      }
      
      // Rate limiting between dates
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error backtesting ${date}:`, error);
    }
  }
  
  if (results.length === 0) {
    return {
      dates_tested: 0,
      total_games: 0,
      winner_hit_rate: 0,
      top_3_hit_rate: 0,
      top_5_hit_rate: 0,
      top_10_hit_rate: 0,
      avg_winner_rank: 0,
      avg_pra_difference: 0,
      best_prediction: null,
      worst_prediction: null,
      results: [],
    };
  }
  
  // Calculate summary metrics
  const winnerCorrect = results.filter(r => r.winner_correct).length;
  const inTop3 = results.filter(r => r.winner_in_top_3).length;
  const inTop5 = results.filter(r => r.winner_in_top_5).length;
  const inTop10 = results.filter(r => r.winner_in_top_10).length;
  
  const ranksWithWinner = results.filter(r => r.predicted_rank_of_winner !== null);
  const avgRank = ranksWithWinner.length > 0
    ? ranksWithWinner.reduce((sum, r) => sum + (r.predicted_rank_of_winner || 0), 0) / ranksWithWinner.length
    : 0;
  
  const avgPraDiff = results.reduce((sum, r) => sum + r.pra_difference, 0) / results.length;
  
  // Find best/worst predictions
  const sortedByRank = [...results]
    .filter(r => r.predicted_rank_of_winner !== null)
    .sort((a, b) => (a.predicted_rank_of_winner || 999) - (b.predicted_rank_of_winner || 999));
  
  return {
    dates_tested: results.length,
    total_games: results.reduce((sum, r) => sum + r.num_games, 0),
    winner_hit_rate: (winnerCorrect / results.length) * 100,
    top_3_hit_rate: (inTop3 / results.length) * 100,
    top_5_hit_rate: (inTop5 / results.length) * 100,
    top_10_hit_rate: (inTop10 / results.length) * 100,
    avg_winner_rank: avgRank,
    avg_pra_difference: avgPraDiff,
    best_prediction: sortedByRank[0] || null,
    worst_prediction: sortedByRank[sortedByRank.length - 1] || null,
    results,
  };
}

/**
 * Generate a formatted backtest report
 */
export function generateBacktestReport(summary: BacktestSummary): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '           KING OF THE COURT - BACKTEST REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Dates Tested: ${summary.dates_tested}`,
    `Total Games: ${summary.total_games}`,
    '',
    '─────────────────────────────────────────────────────────────────',
    '                    ACCURACY METRICS',
    '─────────────────────────────────────────────────────────────────',
    '',
    `  Winner Correct (Top 1):  ${summary.winner_hit_rate.toFixed(1)}%`,
    `  Winner in Top 3:         ${summary.top_3_hit_rate.toFixed(1)}%`,
    `  Winner in Top 5:         ${summary.top_5_hit_rate.toFixed(1)}%`,
    `  Winner in Top 10:        ${summary.top_10_hit_rate.toFixed(1)}%`,
    '',
    `  Average Winner Rank:     #${summary.avg_winner_rank.toFixed(1)}`,
    `  Average PRA Difference:  ${summary.avg_pra_difference.toFixed(1)} points`,
    '',
  ];
  
  if (summary.best_prediction) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('                    BEST PREDICTION');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push(`  Date: ${summary.best_prediction.date}`);
    lines.push(`  Winner: ${summary.best_prediction.actual_winner?.player_name} (${summary.best_prediction.actual_winner?.pra} PRA)`);
    lines.push(`  We ranked them: #${summary.best_prediction.predicted_rank_of_winner}`);
    lines.push('');
  }
  
  if (summary.worst_prediction) {
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('                    WORST PREDICTION');
    lines.push('─────────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push(`  Date: ${summary.worst_prediction.date}`);
    lines.push(`  Winner: ${summary.worst_prediction.actual_winner?.player_name} (${summary.worst_prediction.actual_winner?.pra} PRA)`);
    lines.push(`  We ranked them: #${summary.worst_prediction.predicted_rank_of_winner || 'Not in predictions'}`);
    lines.push('');
  }
  
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('                    DETAILED RESULTS');
  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push('Date        | Actual Winner          | PRA | Our Rank | Result');
  lines.push('------------|------------------------|-----|----------|--------');
  
  for (const result of summary.results) {
    const winner = result.actual_winner?.player_name.substring(0, 22).padEnd(22) || 'Unknown';
    const pra = result.actual_winner?.pra.toString().padStart(3) || '  ?';
    const rank = result.predicted_rank_of_winner?.toString().padStart(8) || '     N/A';
    const status = result.winner_in_top_5 ? '✓' : '✗';
    
    lines.push(`${result.date} | ${winner} | ${pra} | ${rank} | ${status}`);
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

export default {
  getTuesdaysInSeason,
  fetchGameResults,
  fetchBoxScore,
  getAllPlayerResults,
  backtestDate,
  runBacktest,
  generateBacktestReport,
};
