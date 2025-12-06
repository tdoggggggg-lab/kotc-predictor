import { NextRequest, NextResponse } from 'next/server';
import { fetchGames, quickFetchPlayers, Game, EnhancedPlayerData } from '@/lib/espn-data';
import { predictAllPlayers, Prediction } from '@/lib/prediction-model';
import { predictAllPlayersV2, compareModels } from '@/lib/ml-model-v2';

export interface PredictionResponse {
  generated_at: string;
  game_date: string;
  num_games: number;
  num_players: number;
  using_mock_data: boolean;
  data_source: string;
  model_version: 'v1' | 'v2' | 'both';
  games: Game[];
  predictions: Prediction[];
  v2_predictions?: Prediction[];
  model_comparison?: {
    agreementRate: number;
    topPickMatch: boolean;
    top5Overlap: number;
    majorDifferences: Array<{
      player: string;
      v1Rank: number;
      v2Rank: number;
      diff: number;
    }>;
  };
  error?: string;
}

// Fallback mock data when APIs fail
const MOCK_GAMES: Game[] = [
  {
    game_id: '401584701',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '7:30 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '13',
    home_team: 'Los Angeles Lakers',
    home_team_abbrev: 'LAL',
    home_team_logo: '',
    away_team_id: '7',
    away_team: 'Denver Nuggets',
    away_team_abbrev: 'DEN',
    away_team_logo: '',
    matchup: 'DEN@LAL',
    venue: 'Crypto.com Arena',
    spread: -3.5,
    over_under: 228.5,
    home_moneyline: -150,
    away_moneyline: 130,
  },
  {
    game_id: '401584702',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '8:00 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '21',
    home_team: 'Phoenix Suns',
    home_team_abbrev: 'PHX',
    home_team_logo: '',
    away_team_id: '6',
    away_team: 'Dallas Mavericks',
    away_team_abbrev: 'DAL',
    away_team_logo: '',
    matchup: 'DAL@PHX',
    venue: 'Footprint Center',
    spread: 2.0,
    over_under: 232.0,
    home_moneyline: 110,
    away_moneyline: -130,
  },
];

const MOCK_PLAYERS: EnhancedPlayerData[] = [
  {
    player_id: '3945274', player_name: 'Luka Dončić', first_name: 'Luka', last_name: 'Dončić',
    team_id: '6', team_abbrev: 'DAL', team_name: 'Dallas Mavericks', position: 'PG',
    jersey: '77', height: '6\'7"', weight: '230 lbs', age: 25, headshot: null,
    games_played: 20, ppg: 33.5, rpg: 9.2, apg: 9.5, mpg: 37.5, fgpct: 47.2, fg3pct: 35.8,
    ftpct: 78.5, spg: 1.5, bpg: 0.5, topg: 4.2, pra_avg: 52.2,
    game_id: '401584702', matchup: 'DAL@PHX', opponent_id: '21', opponent_abbrev: 'PHX',
    is_home: false, spread: 2.0, over_under: 232.0,
    last_games_pra: [55, 58, 62, 51, 64, 53, 59, 56, 60, 54],
    avg_pra_last_10: 57.2, max_pra_last_10: 64, min_pra_last_10: 51, std_dev_pra: 4.1,
    usage_rate: 33.8, triple_doubles: 6, injury_status: null,
  },
  {
    player_id: '3112335', player_name: 'Nikola Jokić', first_name: 'Nikola', last_name: 'Jokić',
    team_id: '7', team_abbrev: 'DEN', team_name: 'Denver Nuggets', position: 'C',
    jersey: '15', height: '6\'11"', weight: '284 lbs', age: 29, headshot: null,
    games_played: 22, ppg: 29.5, rpg: 13.2, apg: 9.8, mpg: 36.5, fgpct: 56.8, fg3pct: 38.5,
    ftpct: 81.2, spg: 1.4, bpg: 0.9, topg: 3.1, pra_avg: 52.5,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '13', opponent_abbrev: 'LAL',
    is_home: false, spread: -3.5, over_under: 228.5,
    last_games_pra: [52, 48, 55, 61, 45, 58, 50, 53, 47, 56],
    avg_pra_last_10: 52.5, max_pra_last_10: 61, min_pra_last_10: 45, std_dev_pra: 4.8,
    usage_rate: 31.2, triple_doubles: 8, injury_status: null,
  },
  {
    player_id: '3032977a', player_name: 'Giannis Antetokounmpo', first_name: 'Giannis', last_name: 'Antetokounmpo',
    team_id: '15', team_abbrev: 'MIL', team_name: 'Milwaukee Bucks', position: 'PF',
    jersey: '34', height: '6\'11"', weight: '243 lbs', age: 29, headshot: null,
    games_played: 21, ppg: 31.8, rpg: 12.0, apg: 6.2, mpg: 35.5, fgpct: 61.2, fg3pct: 27.5,
    ftpct: 64.5, spg: 1.1, bpg: 1.5, topg: 3.8, pra_avg: 50.0,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '7', opponent_abbrev: 'DEN',
    is_home: true, spread: -3.5, over_under: 228.5,
    last_games_pra: [52, 48, 55, 50, 53, 46, 58, 49, 54, 51],
    avg_pra_last_10: 51.6, max_pra_last_10: 58, min_pra_last_10: 46, std_dev_pra: 3.4,
    usage_rate: 32.5, triple_doubles: 4, injury_status: null,
  },
  {
    player_id: '6583', player_name: 'Anthony Davis', first_name: 'Anthony', last_name: 'Davis',
    team_id: '13', team_abbrev: 'LAL', team_name: 'Los Angeles Lakers', position: 'PF',
    jersey: '3', height: '6\'10"', weight: '253 lbs', age: 31, headshot: null,
    games_played: 20, ppg: 27.5, rpg: 11.8, apg: 3.2, mpg: 35.0, fgpct: 55.5, fg3pct: 28.2,
    ftpct: 79.8, spg: 1.3, bpg: 2.2, topg: 2.1, pra_avg: 42.5,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '7', opponent_abbrev: 'DEN',
    is_home: true, spread: -3.5, over_under: 228.5,
    last_games_pra: [44, 40, 46, 42, 45, 38, 43, 41, 47, 39],
    avg_pra_last_10: 42.5, max_pra_last_10: 47, min_pra_last_10: 38, std_dev_pra: 3.0,
    usage_rate: 30.5, triple_doubles: 0, injury_status: null,
  },
  {
    player_id: '1966', player_name: 'LeBron James', first_name: 'LeBron', last_name: 'James',
    team_id: '13', team_abbrev: 'LAL', team_name: 'Los Angeles Lakers', position: 'SF',
    jersey: '23', height: '6\'9"', weight: '250 lbs', age: 39, headshot: null,
    games_played: 21, ppg: 24.2, rpg: 7.8, apg: 8.5, mpg: 35.5, fgpct: 51.2, fg3pct: 36.5,
    ftpct: 75.8, spg: 1.0, bpg: 0.5, topg: 3.5, pra_avg: 40.5,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '7', opponent_abbrev: 'DEN',
    is_home: true, spread: -3.5, over_under: 228.5,
    last_games_pra: [42, 38, 45, 40, 43, 39, 41, 44, 37, 42],
    avg_pra_last_10: 41.1, max_pra_last_10: 45, min_pra_last_10: 37, std_dev_pra: 2.5,
    usage_rate: 28.8, triple_doubles: 3, injury_status: null,
  },
  {
    player_id: '3136193', player_name: 'Kevin Durant', first_name: 'Kevin', last_name: 'Durant',
    team_id: '21', team_abbrev: 'PHX', team_name: 'Phoenix Suns', position: 'SF',
    jersey: '35', height: '6\'10"', weight: '240 lbs', age: 36, headshot: null,
    games_played: 18, ppg: 27.2, rpg: 6.5, apg: 4.8, mpg: 36.0, fgpct: 52.8, fg3pct: 40.2,
    ftpct: 88.5, spg: 0.8, bpg: 1.3, topg: 2.8, pra_avg: 38.5,
    game_id: '401584702', matchup: 'DAL@PHX', opponent_id: '6', opponent_abbrev: 'DAL',
    is_home: true, spread: 2.0, over_under: 232.0,
    last_games_pra: [40, 37, 42, 38, 41, 36, 39, 43, 35, 40],
    avg_pra_last_10: 39.1, max_pra_last_10: 43, min_pra_last_10: 35, std_dev_pra: 2.6,
    usage_rate: 29.5, triple_doubles: 0, injury_status: null,
  },
  {
    player_id: '3032977b', player_name: 'Devin Booker', first_name: 'Devin', last_name: 'Booker',
    team_id: '21', team_abbrev: 'PHX', team_name: 'Phoenix Suns', position: 'SG',
    jersey: '1', height: '6\'5"', weight: '206 lbs', age: 27, headshot: null,
    games_played: 19, ppg: 26.5, rpg: 4.2, apg: 6.8, mpg: 35.5, fgpct: 48.5, fg3pct: 36.8,
    ftpct: 89.2, spg: 1.0, bpg: 0.3, topg: 2.5, pra_avg: 37.5,
    game_id: '401584702', matchup: 'DAL@PHX', opponent_id: '6', opponent_abbrev: 'DAL',
    is_home: true, spread: 2.0, over_under: 232.0,
    last_games_pra: [38, 35, 40, 36, 39, 34, 41, 33, 37, 38],
    avg_pra_last_10: 37.1, max_pra_last_10: 41, min_pra_last_10: 33, std_dev_pra: 2.5,
    usage_rate: 28.2, triple_doubles: 0, injury_status: null,
  },
  {
    player_id: '6606', player_name: 'Damian Lillard', first_name: 'Damian', last_name: 'Lillard',
    team_id: '15', team_abbrev: 'MIL', team_name: 'Milwaukee Bucks', position: 'PG',
    jersey: '0', height: '6\'2"', weight: '195 lbs', age: 34, headshot: null,
    games_played: 21, ppg: 25.5, rpg: 4.5, apg: 7.2, mpg: 35.0, fgpct: 44.2, fg3pct: 35.5,
    ftpct: 91.5, spg: 1.0, bpg: 0.3, topg: 2.8, pra_avg: 37.2,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '7', opponent_abbrev: 'DEN',
    is_home: true, spread: -3.5, over_under: 228.5,
    last_games_pra: [38, 35, 40, 37, 39, 34, 41, 36, 38, 37],
    avg_pra_last_10: 37.5, max_pra_last_10: 41, min_pra_last_10: 34, std_dev_pra: 2.2,
    usage_rate: 28.8, triple_doubles: 1, injury_status: null,
  },
  {
    player_id: '4066259', player_name: 'Kyrie Irving', first_name: 'Kyrie', last_name: 'Irving',
    team_id: '6', team_abbrev: 'DAL', team_name: 'Dallas Mavericks', position: 'PG',
    jersey: '11', height: '6\'2"', weight: '195 lbs', age: 32, headshot: null,
    games_played: 20, ppg: 24.8, rpg: 5.0, apg: 5.2, mpg: 35.5, fgpct: 49.8, fg3pct: 42.5,
    ftpct: 90.2, spg: 1.2, bpg: 0.4, topg: 2.3, pra_avg: 35.0,
    game_id: '401584702', matchup: 'DAL@PHX', opponent_id: '21', opponent_abbrev: 'PHX',
    is_home: false, spread: 2.0, over_under: 232.0,
    last_games_pra: [35, 33, 38, 32, 36, 34, 37, 31, 35, 33],
    avg_pra_last_10: 34.4, max_pra_last_10: 38, min_pra_last_10: 31, std_dev_pra: 2.1,
    usage_rate: 27.2, triple_doubles: 0, injury_status: null,
  },
  {
    player_id: '3136779', player_name: 'Jamal Murray', first_name: 'Jamal', last_name: 'Murray',
    team_id: '7', team_abbrev: 'DEN', team_name: 'Denver Nuggets', position: 'PG',
    jersey: '27', height: '6\'4"', weight: '215 lbs', age: 27, headshot: null,
    games_played: 18, ppg: 21.3, rpg: 4.1, apg: 6.8, mpg: 33.2, fgpct: 47.5, fg3pct: 41.2,
    ftpct: 85.8, spg: 1.0, bpg: 0.3, topg: 2.5, pra_avg: 32.2,
    game_id: '401584701', matchup: 'DEN@LAL', opponent_id: '13', opponent_abbrev: 'LAL',
    is_home: false, spread: -3.5, over_under: 228.5,
    last_games_pra: [32, 28, 35, 30, 33, 29, 31, 34, 27, 30],
    avg_pra_last_10: 30.9, max_pra_last_10: 35, min_pra_last_10: 27, std_dev_pra: 2.5,
    usage_rate: 26.5, triple_doubles: 0, injury_status: null,
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const useMock = searchParams.get('mock') === 'true';
  const modelVersion = (searchParams.get('model') || 'v1') as 'v1' | 'v2' | 'both';
  
  try {
    // Force mock data if requested
    if (useMock) {
      const v1Predictions = predictAllPlayers(MOCK_PLAYERS);
      const v2Predictions = predictAllPlayersV2(MOCK_PLAYERS);
      const comparison = compareModels(v1Predictions, v2Predictions);
      
      return NextResponse.json({
        generated_at: new Date().toISOString(),
        game_date: date,
        num_games: MOCK_GAMES.length,
        num_players: v1Predictions.length,
        using_mock_data: true,
        data_source: 'mock (forced)',
        model_version: modelVersion,
        games: MOCK_GAMES,
        predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
        v2_predictions: modelVersion === 'both' ? v2Predictions : undefined,
        model_comparison: modelVersion === 'both' ? comparison : undefined,
      } as PredictionResponse);
    }
    
    // Try to fetch real data
    console.log(`Fetching games for ${date}...`);
    const games = await fetchGames(date);
    
    if (!games || games.length === 0) {
      console.log('No games found, using mock data');
      const v1Predictions = predictAllPlayers(MOCK_PLAYERS);
      const v2Predictions = predictAllPlayersV2(MOCK_PLAYERS);
      const comparison = compareModels(v1Predictions, v2Predictions);
      
      return NextResponse.json({
        generated_at: new Date().toISOString(),
        game_date: date,
        num_games: MOCK_GAMES.length,
        num_players: v1Predictions.length,
        using_mock_data: true,
        data_source: 'mock (no games)',
        model_version: modelVersion,
        games: MOCK_GAMES,
        predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
        v2_predictions: modelVersion === 'both' ? v2Predictions : undefined,
        model_comparison: modelVersion === 'both' ? comparison : undefined,
      } as PredictionResponse);
    }
    
    console.log(`Found ${games.length} games, fetching players...`);
    
    // Fetch player data
    const players = await quickFetchPlayers(games);
    
    if (!players || players.length === 0) {
      console.log('No players found, using mock data with real games');
      const v1Predictions = predictAllPlayers(MOCK_PLAYERS);
      const v2Predictions = predictAllPlayersV2(MOCK_PLAYERS);
      const comparison = compareModels(v1Predictions, v2Predictions);
      
      return NextResponse.json({
        generated_at: new Date().toISOString(),
        game_date: date,
        num_games: games.length,
        num_players: v1Predictions.length,
        using_mock_data: true,
        data_source: 'mixed (real games, mock players)',
        model_version: modelVersion,
        games,
        predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
        v2_predictions: modelVersion === 'both' ? v2Predictions : undefined,
        model_comparison: modelVersion === 'both' ? comparison : undefined,
      } as PredictionResponse);
    }
    
    console.log(`Found ${players.length} players, generating predictions...`);
    
    // Generate predictions with selected model
    const v1Predictions = predictAllPlayers(players);
    const v2Predictions = predictAllPlayersV2(players);
    const comparison = compareModels(v1Predictions, v2Predictions);
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      game_date: date,
      num_games: games.length,
      num_players: v1Predictions.length,
      using_mock_data: false,
      data_source: 'ESPN API',
      model_version: modelVersion,
      games,
      predictions: (modelVersion === 'v2' ? v2Predictions : v1Predictions).slice(0, 50),
      v2_predictions: modelVersion === 'both' ? v2Predictions.slice(0, 50) : undefined,
      model_comparison: modelVersion === 'both' ? comparison : undefined,
    } as PredictionResponse);
    
  } catch (error) {
    console.error('API Error:', error);
    
    // Return mock data on error
    const v1Predictions = predictAllPlayers(MOCK_PLAYERS);
    const v2Predictions = predictAllPlayersV2(MOCK_PLAYERS);
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      game_date: date,
      num_games: MOCK_GAMES.length,
      num_players: v1Predictions.length,
      using_mock_data: true,
      data_source: 'mock (error fallback)',
      model_version: modelVersion,
      games: MOCK_GAMES,
      predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as PredictionResponse);
  }
}

// Cache configuration for Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate every 5 minutes
