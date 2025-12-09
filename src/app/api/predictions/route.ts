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

// Generate dynamic mock data that varies by date
// This ensures V1 and V2 show different rankings on different days
function generateDynamicMockData(dateStr: string): { games: Game[], players: EnhancedPlayerData[] } {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0-6
  const dayOfMonth = date.getDate(); // 1-31
  
  // Rotate game contexts based on day
  // This creates variety - same player, different matchup each day
  const gameContexts = [
    // Context 0: Close game vs weak defense (BEST for V2)
    { spread: 2.5, ou: 232, oppDrtg: 'CHA', desc: 'Close + Weak D' },
    // Context 1: Blowout risk (BAD for V2)
    { spread: -14.5, ou: 222, oppDrtg: 'UTA', desc: 'Blowout risk' },
    // Context 2: Underdog vs average defense
    { spread: 6.5, ou: 225, oppDrtg: 'SAC', desc: 'Underdog' },
    // Context 3: Elite defense matchup (BAD for both)
    { spread: 1.5, ou: 212, oppDrtg: 'CLE', desc: 'Elite D' },
    // Context 4: High-pace shootout (GREAT for V2)
    { spread: -3.5, ou: 242, oppDrtg: 'IND', desc: 'Shootout' },
    // Context 5: Moderate game
    { spread: -5.0, ou: 224, oppDrtg: 'PHI', desc: 'Average' },
    // Context 6: Road underdog vs bad D
    { spread: 4.5, ou: 230, oppDrtg: 'WAS', desc: 'Road + Weak D' },
  ];
  
  // Base mock players with their season stats (these don't change)
  const basePlayers = [
    { id: '3945274', name: 'Luka Dončić', team: 'DAL', pos: 'PG', pra: 53.1, usage: 32.5, td: 6, mpg: 37.2,
      ppg: 28.5, rpg: 8.8, apg: 8.2, last10: [55, 52, 58, 48, 62, 51, 54, 50, 57, 53] },
    { id: '3112335', name: 'Nikola Jokić', team: 'DEN', pos: 'C', pra: 52.6, usage: 31.2, td: 10, mpg: 36.5,
      ppg: 29.2, rpg: 13.0, apg: 10.4, last10: [52, 48, 55, 61, 45, 58, 50, 53, 47, 56] },
    { id: '3032977', name: 'Giannis Antetokounmpo', team: 'MIL', pos: 'PF', pra: 48.2, usage: 33.5, td: 3, mpg: 35.5,
      ppg: 30.2, rpg: 11.5, apg: 6.5, last10: [50, 46, 52, 44, 48, 51, 45, 49, 47, 53] },
    { id: '4066262', name: 'Shai Gilgeous-Alexander', team: 'OKC', pos: 'SG', pra: 44.0, usage: 31.8, td: 1, mpg: 34.5,
      ppg: 31.2, rpg: 5.5, apg: 6.2, last10: [45, 42, 48, 40, 46, 43, 44, 41, 47, 44] },
    { id: '4066328', name: 'Tyrese Maxey', team: 'PHI', pos: 'PG', pra: 43.4, usage: 29.8, td: 0, mpg: 37.8,
      ppg: 27.5, rpg: 4.2, apg: 6.2, last10: [44, 41, 46, 39, 45, 42, 43, 40, 45, 43] },
    { id: '4432166', name: 'Cade Cunningham', team: 'DET', pos: 'PG', pra: 43.1, usage: 31.2, td: 2, mpg: 36.0,
      ppg: 24.5, rpg: 7.2, apg: 9.5, last10: [44, 41, 46, 40, 45, 42, 43, 39, 44, 41] },
    { id: '4432811', name: 'Jalen Johnson', team: 'ATL', pos: 'SF', pra: 41.7, usage: 26.5, td: 1, mpg: 34.5,
      ppg: 20.5, rpg: 10.8, apg: 5.2, last10: [48, 40, 44, 38, 43, 41, 42, 39, 52, 46] },
    { id: '4395725', name: 'Austin Reaves', team: 'LAL', pos: 'SG', pra: 41.7, usage: 27.2, td: 0, mpg: 36.0,
      ppg: 24.2, rpg: 5.2, apg: 6.8, last10: [42, 40, 44, 39, 43, 41, 42, 38, 44, 41] },
    { id: '6583', name: 'Donovan Mitchell', team: 'CLE', pos: 'SG', pra: 40.8, usage: 29.5, td: 0, mpg: 35.0,
      ppg: 24.0, rpg: 4.5, apg: 4.8, last10: [41, 39, 43, 38, 42, 40, 41, 37, 44, 40] },
    { id: '4066421', name: 'Tyrese Haliburton', team: 'IND', pos: 'PG', pra: 38.5, usage: 27.8, td: 3, mpg: 34.0,
      ppg: 20.5, rpg: 4.0, apg: 10.2, last10: [40, 36, 42, 34, 39, 37, 38, 35, 41, 38] },
  ];
  
  // Assign different game contexts to each player based on day
  // This rotation ensures different rankings each day
  const players: EnhancedPlayerData[] = basePlayers.map((p, idx) => {
    // Rotate context assignment: player 0 gets context (day+0)%7, player 1 gets (day+1)%7, etc.
    const contextIdx = (dayOfWeek + idx + Math.floor(dayOfMonth / 7)) % gameContexts.length;
    const ctx = gameContexts[contextIdx];
    
    const avgPra = p.last10.reduce((a, b) => a + b, 0) / p.last10.length;
    const stdDev = Math.sqrt(p.last10.reduce((sum, val) => sum + Math.pow(val - avgPra, 2), 0) / p.last10.length);
    
    return {
      player_id: p.id,
      player_name: p.name,
      first_name: p.name.split(' ')[0],
      last_name: p.name.split(' ').slice(1).join(' '),
      team_id: p.team,
      team_abbrev: p.team,
      team_name: p.team,
      position: p.pos,
      jersey: '',
      height: '',
      weight: '',
      age: null,
      headshot: null,
      games_played: 25,
      ppg: p.ppg,
      rpg: p.rpg,
      apg: p.apg,
      mpg: p.mpg,
      fgpct: 48,
      fg3pct: 36,
      ftpct: 82,
      spg: 1.2,
      bpg: 0.5,
      topg: 3.0,
      pra_avg: p.pra,
      game_id: `mock-${idx}`,
      matchup: `${p.team}@${ctx.oppDrtg}`,
      opponent_id: ctx.oppDrtg,
      opponent_abbrev: ctx.oppDrtg,
      is_home: idx % 2 === 0,
      spread: ctx.spread * (idx % 2 === 0 ? -1 : 1), // Home/away affects spread sign
      over_under: ctx.ou,
      last_games_pra: p.last10,
      avg_pra_last_10: avgPra,
      max_pra_last_10: Math.max(...p.last10),
      min_pra_last_10: Math.min(...p.last10),
      std_dev_pra: Math.round(stdDev * 10) / 10,
      usage_rate: p.usage,
      triple_doubles: p.td,
      injury_status: null,
    };
  });
  
  // Generate corresponding games
  const games: Game[] = [];
  const usedMatchups = new Set<string>();
  players.forEach((p, idx) => {
    const matchupKey = p.matchup || `${p.team_abbrev}@${p.opponent_abbrev}`;
    if (!usedMatchups.has(matchupKey)) {
      usedMatchups.add(matchupKey);
      games.push({
        game_id: `mock-game-${idx}`,
        game_date: dateStr,
        game_time: `${7 + Math.floor(idx / 2)}:00 PM ET`,
        game_status: 'STATUS_SCHEDULED',
        home_team_id: p.opponent_abbrev || '',
        home_team: p.opponent_abbrev || '',
        home_team_abbrev: p.opponent_abbrev || '',
        home_team_logo: '',
        away_team_id: p.team_abbrev,
        away_team: p.team_name,
        away_team_abbrev: p.team_abbrev,
        away_team_logo: '',
        matchup: matchupKey,
        venue: 'Arena',
        spread: p.spread ?? null,
        over_under: p.over_under ?? null,
        home_moneyline: null,
        away_moneyline: null,
      });
    }
  });
  
  return { games, players };
}

// Fallback mock data when APIs fail
// VARIED GAME CONTEXTS to demonstrate V1 vs V2 differences:
// - Game 1: Competitive game (V2 likes)
// - Game 2: BIG blowout (V2 penalizes heavily)
// - Game 3: Underdog star (V2 boosts)
// - Game 4: Elite defense (both penalize, V2 more)
// - Game 5: High pace shootout (V2 loves)
const MOCK_GAMES: Game[] = [
  {
    game_id: '401584702',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '7:30 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '30',
    home_team: 'Charlotte Hornets',
    home_team_abbrev: 'CHA',
    home_team_logo: '',
    away_team_id: '13',
    away_team: 'Los Angeles Lakers',
    away_team_abbrev: 'LAL',
    away_team_logo: '',
    matchup: 'LAL@CHA',
    venue: 'Spectrum Center',
    spread: 2.5,  // Close game
    over_under: 228.0,  // High scoring
    home_moneyline: 120,
    away_moneyline: -140,
  },
  {
    game_id: '401584701',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '8:00 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '26',
    home_team: 'Utah Jazz',
    home_team_abbrev: 'UTA',
    home_team_logo: '',
    away_team_id: '7',
    away_team: 'Denver Nuggets',
    away_team_abbrev: 'DEN',
    away_team_logo: '',
    matchup: 'DEN@UTA',
    venue: 'Delta Center',
    spread: -14.5,  // MASSIVE blowout risk for Jokic
    over_under: 225.0,
    home_moneyline: 650,
    away_moneyline: -950,
  },
  {
    game_id: '401584703',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '8:30 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '2',
    home_team: 'Boston Celtics',
    home_team_abbrev: 'BOS',
    home_team_logo: '',
    away_team_id: '15',
    away_team: 'Milwaukee Bucks',
    away_team_abbrev: 'MIL',
    away_team_logo: '',
    matchup: 'MIL@BOS',
    venue: 'TD Garden',
    spread: 5.5,  // Underdog Giannis
    over_under: 220.5,
    home_moneyline: -220,
    away_moneyline: 180,
  },
  {
    game_id: '401584704',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '9:00 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '5',
    home_team: 'Cleveland Cavaliers',
    home_team_abbrev: 'CLE',
    home_team_logo: '',
    away_team_id: '25',
    away_team: 'Oklahoma City Thunder',
    away_team_abbrev: 'OKC',
    away_team_logo: '',
    matchup: 'OKC@CLE',
    venue: 'Rocket Mortgage FieldHouse',
    spread: 1.5,  // Close, but ELITE defense matchup
    over_under: 214.0,  // Very low
    home_moneyline: -120,
    away_moneyline: 100,
  },
  {
    game_id: '401584705',
    game_date: new Date().toISOString().split('T')[0],
    game_time: '10:00 PM ET',
    game_status: 'STATUS_SCHEDULED',
    home_team_id: '11',
    home_team: 'Indiana Pacers',
    home_team_abbrev: 'IND',
    home_team_logo: '',
    away_team_id: '1',
    away_team: 'Atlanta Hawks',
    away_team_abbrev: 'ATL',
    away_team_logo: '',
    matchup: 'ATL@IND',
    venue: 'Gainbridge Fieldhouse',
    spread: -3.5,  // Moderate favorite
    over_under: 242.5,  // SHOOTOUT - V2 loves this
    home_moneyline: -165,
    away_moneyline: 140,
  },
];

const MOCK_PLAYERS: EnhancedPlayerData[] = [
  // GAME 1: LAL@CHA - Close game vs WEAK defense (V2 should LOVE Luka here)
  {
    player_id: '3945274', player_name: 'Luka Dončić', first_name: 'Luka', last_name: 'Dončić',
    team_id: '13', team_abbrev: 'LAL', team_name: 'Los Angeles Lakers', position: 'SF',
    jersey: '77', height: '6\'7"', weight: '230 lbs', age: 26, headshot: null,
    games_played: 22, ppg: 28.5, rpg: 8.8, apg: 8.2, mpg: 36.5, fgpct: 46.2, fg3pct: 34.8,
    ftpct: 77.5, spg: 1.4, bpg: 0.4, topg: 4.0, pra_avg: 53.1,
    game_id: '401584702', matchup: 'LAL@CHA', opponent_id: '30', opponent_abbrev: 'CHA', // WEAK D!
    is_home: false, spread: -2.5, over_under: 228.0,
    last_games_pra: [55, 52, 58, 48, 56, 51, 54, 50, 57, 53], // Consistent
    avg_pra_last_10: 53.4, max_pra_last_10: 58, min_pra_last_10: 48, std_dev_pra: 3.2,
    usage_rate: 32.5, triple_doubles: 4, injury_status: null,
  },
  {
    player_id: '4395725', player_name: 'Austin Reaves', first_name: 'Austin', last_name: 'Reaves',
    team_id: '13', team_abbrev: 'LAL', team_name: 'Los Angeles Lakers', position: 'PG',
    jersey: '15', height: '6\'5"', weight: '206 lbs', age: 27, headshot: null,
    games_played: 23, ppg: 24.2, rpg: 5.2, apg: 6.8, mpg: 36.0, fgpct: 48.5, fg3pct: 40.2,
    ftpct: 88.5, spg: 0.8, bpg: 0.3, topg: 2.5, pra_avg: 41.7,
    game_id: '401584702', matchup: 'LAL@CHA', opponent_id: '30', opponent_abbrev: 'CHA',
    is_home: false, spread: -2.5, over_under: 228.0,
    last_games_pra: [42, 40, 44, 39, 43, 41, 42, 38, 44, 41],
    avg_pra_last_10: 41.4, max_pra_last_10: 44, min_pra_last_10: 38, std_dev_pra: 2.0,
    usage_rate: 27.2, triple_doubles: 0, injury_status: null,
  },
  
  // GAME 2: DEN@UTA - MASSIVE blowout risk (V2 should HEAVILY penalize Jokic)
  {
    player_id: '3112335', player_name: 'Nikola Jokić', first_name: 'Nikola', last_name: 'Jokić',
    team_id: '7', team_abbrev: 'DEN', team_name: 'Denver Nuggets', position: 'C',
    jersey: '15', height: '6\'11"', weight: '284 lbs', age: 29, headshot: null,
    games_played: 22, ppg: 29.2, rpg: 13.0, apg: 10.4, mpg: 36.5, fgpct: 56.8, fg3pct: 38.5,
    ftpct: 81.2, spg: 1.4, bpg: 0.9, topg: 3.1, pra_avg: 52.6,
    game_id: '401584701', matchup: 'DEN@UTA', opponent_id: '26', opponent_abbrev: 'UTA',
    is_home: false, spread: -14.5, over_under: 225.0, // HUGE blowout = will sit 4th quarter
    last_games_pra: [52, 48, 55, 61, 45, 58, 50, 53, 47, 56],
    avg_pra_last_10: 52.5, max_pra_last_10: 61, min_pra_last_10: 45, std_dev_pra: 4.8,
    usage_rate: 31.2, triple_doubles: 8, injury_status: null,
  },
  
  // GAME 3: MIL@BOS - Underdog star vs ELITE defense (V2 boosts underdog, but defense hurts)
  {
    player_id: '3032977a', player_name: 'Giannis Antetokounmpo', first_name: 'Giannis', last_name: 'Antetokounmpo',
    team_id: '15', team_abbrev: 'MIL', team_name: 'Milwaukee Bucks', position: 'SF',
    jersey: '34', height: '6\'11"', weight: '243 lbs', age: 30, headshot: null,
    games_played: 22, ppg: 30.2, rpg: 11.5, apg: 6.5, mpg: 35.5, fgpct: 61.2, fg3pct: 27.5,
    ftpct: 64.5, spg: 1.1, bpg: 1.5, topg: 3.8, pra_avg: 45.2,
    game_id: '401584703', matchup: 'MIL@BOS', opponent_id: '2', opponent_abbrev: 'BOS', // Elite D
    is_home: false, spread: 5.5, over_under: 220.5, // Underdog = must carry
    last_games_pra: [46, 44, 48, 42, 47, 43, 45, 41, 49, 44],
    avg_pra_last_10: 44.9, max_pra_last_10: 49, min_pra_last_10: 41, std_dev_pra: 2.5,
    usage_rate: 33.5, triple_doubles: 2, injury_status: null,
  },
  
  // GAME 4: OKC@CLE - Elite defense vs elite defense (both penalized)
  {
    player_id: '4278078', player_name: 'Shai Gilgeous-Alexander', first_name: 'Shai', last_name: 'Gilgeous-Alexander',
    team_id: '25', team_abbrev: 'OKC', team_name: 'Oklahoma City Thunder', position: 'PG',
    jersey: '2', height: '6\'6"', weight: '195 lbs', age: 26, headshot: null,
    games_played: 23, ppg: 31.5, rpg: 5.5, apg: 6.5, mpg: 34.5, fgpct: 53.2, fg3pct: 35.5,
    ftpct: 87.5, spg: 2.0, bpg: 1.0, topg: 2.5, pra_avg: 44.0,
    game_id: '401584704', matchup: 'OKC@CLE', opponent_id: '5', opponent_abbrev: 'CLE', // BEST D in NBA
    is_home: false, spread: 1.5, over_under: 214.0, // Low total = slow game
    last_games_pra: [45, 42, 48, 41, 46, 40, 44, 43, 47, 42],
    avg_pra_last_10: 43.8, max_pra_last_10: 48, min_pra_last_10: 40, std_dev_pra: 2.6,
    usage_rate: 32.8, triple_doubles: 1, injury_status: null,
  },
  {
    player_id: '3908809', player_name: 'Donovan Mitchell', first_name: 'Donovan', last_name: 'Mitchell',
    team_id: '5', team_abbrev: 'CLE', team_name: 'Cleveland Cavaliers', position: 'SG',
    jersey: '45', height: '6\'1"', weight: '215 lbs', age: 28, headshot: null,
    games_played: 21, ppg: 26.5, rpg: 4.8, apg: 5.2, mpg: 34.5, fgpct: 47.2, fg3pct: 38.5,
    ftpct: 85.5, spg: 1.5, bpg: 0.3, topg: 2.8, pra_avg: 40.8,
    game_id: '401584704', matchup: 'OKC@CLE', opponent_id: '25', opponent_abbrev: 'OKC', // Also elite D
    is_home: true, spread: -1.5, over_under: 214.0,
    last_games_pra: [41, 39, 43, 38, 42, 40, 41, 37, 44, 40],
    avg_pra_last_10: 40.5, max_pra_last_10: 44, min_pra_last_10: 37, std_dev_pra: 2.1,
    usage_rate: 29.5, triple_doubles: 0, injury_status: null,
  },
  
  // GAME 5: ATL@IND - SHOOTOUT! (V2 should LOVE this game)
  {
    player_id: '4432811', player_name: 'Jalen Johnson', first_name: 'Jalen', last_name: 'Johnson',
    team_id: '1', team_abbrev: 'ATL', team_name: 'Atlanta Hawks', position: 'SF',
    jersey: '1', height: '6\'9"', weight: '220 lbs', age: 23, headshot: null,
    games_played: 22, ppg: 20.5, rpg: 10.8, apg: 5.2, mpg: 34.5, fgpct: 51.2, fg3pct: 32.5,
    ftpct: 75.5, spg: 1.2, bpg: 0.8, topg: 2.5, pra_avg: 41.7,
    game_id: '401584705', matchup: 'ATL@IND', opponent_id: '11', opponent_abbrev: 'IND', // Fastest pace
    is_home: false, spread: 3.5, over_under: 242.5, // SHOOTOUT! V2 loves high O/U
    last_games_pra: [48, 40, 44, 38, 43, 41, 42, 39, 52, 46], // Hot streak (last 3: 52,46,39 avg=45.7)
    avg_pra_last_10: 43.3, max_pra_last_10: 52, min_pra_last_10: 38, std_dev_pra: 4.3,
    usage_rate: 26.5, triple_doubles: 1, injury_status: null,
  },
  {
    player_id: '4066421', player_name: 'Tyrese Haliburton', first_name: 'Tyrese', last_name: 'Haliburton',
    team_id: '11', team_abbrev: 'IND', team_name: 'Indiana Pacers', position: 'PG',
    jersey: '0', height: '6\'5"', weight: '185 lbs', age: 24, headshot: null,
    games_played: 20, ppg: 20.5, rpg: 4.0, apg: 10.2, mpg: 34.0, fgpct: 45.5, fg3pct: 38.2,
    ftpct: 85.0, spg: 1.2, bpg: 0.5, topg: 2.8, pra_avg: 38.5,
    game_id: '401584705', matchup: 'ATL@IND', opponent_id: '1', opponent_abbrev: 'ATL', // Fast pace too
    is_home: true, spread: -3.5, over_under: 242.5, // Shootout + home
    last_games_pra: [40, 36, 42, 34, 39, 37, 38, 35, 41, 38], // Cold streak (last 3: 35,41,38 avg=38)
    avg_pra_last_10: 38.0, max_pra_last_10: 42, min_pra_last_10: 34, std_dev_pra: 2.5,
    usage_rate: 27.8, triple_doubles: 3, injury_status: null,
  },
  
  // More players from various games for variety
  {
    player_id: '4432166', player_name: 'Cade Cunningham', first_name: 'Cade', last_name: 'Cunningham',
    team_id: '8', team_abbrev: 'DET', team_name: 'Detroit Pistons', position: 'PG',
    jersey: '2', height: '6\'6"', weight: '220 lbs', age: 23, headshot: null,
    games_played: 22, ppg: 24.5, rpg: 7.2, apg: 9.5, mpg: 36.0, fgpct: 44.8, fg3pct: 35.5,
    ftpct: 82.5, spg: 0.8, bpg: 0.3, topg: 4.2, pra_avg: 43.1,
    game_id: '401584706', matchup: 'DET@NYK', opponent_id: '18', opponent_abbrev: 'NYK',
    is_home: false, spread: 8.5, over_under: 216.5,
    last_games_pra: [44, 41, 46, 40, 45, 42, 43, 39, 44, 41],
    avg_pra_last_10: 42.5, max_pra_last_10: 46, min_pra_last_10: 39, std_dev_pra: 2.2,
    usage_rate: 31.2, triple_doubles: 2, injury_status: null,
  },
  {
    player_id: '3992', player_name: 'James Harden', first_name: 'James', last_name: 'Harden',
    team_id: '12', team_abbrev: 'LAC', team_name: 'Los Angeles Clippers', position: 'SG',
    jersey: '1', height: '6\'5"', weight: '220 lbs', age: 35, headshot: null,
    games_played: 22, ppg: 21.5, rpg: 7.2, apg: 9.2, mpg: 35.5, fgpct: 43.5, fg3pct: 35.8,
    ftpct: 88.2, spg: 1.2, bpg: 0.5, topg: 4.5, pra_avg: 40.5,
    game_id: '401584708', matchup: 'LAC@SAC', opponent_id: '23', opponent_abbrev: 'SAC',
    is_home: false, spread: 1.5, over_under: 225.5,
    last_games_pra: [41, 38, 43, 37, 42, 39, 40, 36, 44, 39],
    avg_pra_last_10: 39.9, max_pra_last_10: 44, min_pra_last_10: 36, std_dev_pra: 2.5,
    usage_rate: 28.8, triple_doubles: 2, injury_status: null,
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
      const { games: mockGames, players: mockPlayers } = generateDynamicMockData(date);
      const v1Predictions = predictAllPlayers(mockPlayers);
      const v2Predictions = predictAllPlayersV2(mockPlayers);
      const comparison = compareModels(v1Predictions, v2Predictions);
      
      return NextResponse.json({
        generated_at: new Date().toISOString(),
        game_date: date,
        num_games: mockGames.length,
        num_players: v1Predictions.length,
        using_mock_data: true,
        data_source: 'mock (dynamic by date)',
        model_version: modelVersion,
        games: mockGames,
        predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
        v2_predictions: modelVersion === 'both' ? v2Predictions : undefined,
        model_comparison: modelVersion === 'both' ? {
          agreementRate: comparison.agreement_rate,
          topPickMatch: comparison.top_pick_matches,
          top5Overlap: comparison.top_5_overlap,
          majorDifferences: comparison.major_differences.map(d => ({
            player: d.player,
            v1Rank: d.v1_rank,
            v2Rank: d.v2_rank,
            diff: Math.abs(d.v1_rank - d.v2_rank),
          })),
        } : undefined,
      } as PredictionResponse);
    }
    
    // Try to fetch real data
    console.log(`[KOTC] Fetching games for ${date}...`);
    let fetchError: string | null = null;
    
    let games: Game[] = [];
    try {
      games = await fetchGames(date);
      console.log(`[KOTC] ESPN returned ${games.length} games`);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'Unknown fetch error';
      console.error(`[KOTC] ESPN games fetch failed:`, fetchError);
    }
    
    if (!games || games.length === 0) {
      console.log('[KOTC] No games found, using mock data. Reason:', fetchError || 'No games scheduled');
      const { games: mockGames, players: mockPlayers } = generateDynamicMockData(date);
      const v1Predictions = predictAllPlayers(mockPlayers);
      const v2Predictions = predictAllPlayersV2(mockPlayers);
      const comparison = compareModels(v1Predictions, v2Predictions);
      
      return NextResponse.json({
        generated_at: new Date().toISOString(),
        game_date: date,
        num_games: mockGames.length,
        num_players: v1Predictions.length,
        using_mock_data: true,
        data_source: 'mock (no games)',
        model_version: modelVersion,
        games: mockGames,
        predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
        v2_predictions: modelVersion === 'both' ? v2Predictions : undefined,
        model_comparison: modelVersion === 'both' ? comparison : undefined,
      } as PredictionResponse);
    }
    
    console.log(`[KOTC] Found ${games.length} games, fetching players...`);
    
    // Fetch player data
    let players: EnhancedPlayerData[] = [];
    try {
      players = await quickFetchPlayers(games);
      console.log(`[KOTC] ESPN returned ${players.length} players`);
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'Player fetch error';
      console.error(`[KOTC] Player fetch failed:`, fetchError);
    }
    
    if (!players || players.length === 0) {
      console.log('[KOTC] No players found, using mock data');
      const { games: fallbackGames, players: fallbackPlayers } = generateDynamicMockData(date);
      const v1Predictions = predictAllPlayers(fallbackPlayers);
      const v2Predictions = predictAllPlayersV2(fallbackPlayers);
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
    
    console.log(`[KOTC] Found ${players.length} valid players, generating predictions...`);
    
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
      debug: {
        games_fetched: games.length,
        players_fetched: players.length,
        teams_with_data: Array.from(new Set(players.map(p => p.team_abbrev))).length,
      }
    } as PredictionResponse);
    
  } catch (error) {
    console.error('API Error:', error);
    
    // Return mock data on error
    const { games: errorGames, players: errorPlayers } = generateDynamicMockData(date);
    const v1Predictions = predictAllPlayers(errorPlayers);
    const v2Predictions = predictAllPlayersV2(errorPlayers);
    
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      game_date: date,
      num_games: errorGames.length,
      num_players: v1Predictions.length,
      using_mock_data: true,
      data_source: 'mock (error fallback)',
      model_version: modelVersion,
      games: errorGames,
      predictions: modelVersion === 'v2' ? v2Predictions : v1Predictions,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as PredictionResponse);
  }
}

// Cache configuration for Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate every 5 minutes
