/**
 * ESPN NBA Data Fetching Library
 * 
 * Fetches real-time NBA data including:
 * - Today's games with Vegas odds
 * - Team rosters
 * - Player season statistics
 * - Game logs for recent performance
 */

// ESPN API Endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

export interface Game {
  game_id: string;
  game_date: string;
  game_time: string;
  game_status: string;
  home_team_id: string;
  home_team: string;
  home_team_abbrev: string;
  home_team_logo: string;
  away_team_id: string;
  away_team: string;
  away_team_abbrev: string;
  away_team_logo: string;
  matchup: string;
  venue: string;
  spread: number | null;
  over_under: number | null;
  home_moneyline: number | null;
  away_moneyline: number | null;
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  first_name: string;
  last_name: string;
  team_id: string;
  team_abbrev: string;
  team_name: string;
  position: string;
  jersey: string;
  height: string;
  weight: string;
  age: number | null;
  headshot: string | null;
  
  // Season stats
  games_played: number;
  ppg: number;
  rpg: number;
  apg: number;
  mpg: number;
  fgpct: number;
  fg3pct: number;
  ftpct: number;
  spg: number;
  bpg: number;
  topg: number;
  
  // Calculated
  pra_avg: number;
  
  // Game context (added when processing)
  game_id?: string;
  matchup?: string;
  opponent_id?: string;
  opponent_abbrev?: string;
  is_home?: boolean;
  spread?: number | null;
  over_under?: number | null;
}

export interface EnhancedPlayerData extends PlayerStats {
  // Recent performance (last 5-10 games)
  last_games_pra: number[];
  avg_pra_last_10: number;
  max_pra_last_10: number;
  min_pra_last_10: number;
  std_dev_pra: number;
  
  // Advanced metrics (estimated)
  usage_rate: number;
  triple_doubles: number;
  
  // Injury status
  injury_status: string | null;
}

/**
 * Fetch today's NBA games with odds
 */
export async function fetchGames(date?: string): Promise<Game[]> {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const dateFormatted = dateStr.replace(/-/g, '');
  
  try {
    const url = `${ESPN_BASE}/scoreboard?dates=${dateFormatted}`;
    const response = await fetch(url, { 
      next: { revalidate: 300 },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`ESPN scoreboard error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const events = data.events || [];
    
    const games: Game[] = events.map((event: any) => {
      const competition = event.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      
      const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
      const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];
      
      // Extract odds
      const odds = competition.odds?.[0] || {};
      
      return {
        game_id: event.id,
        game_date: dateStr,
        game_time: event.status?.type?.shortDetail || 'TBD',
        game_status: event.status?.type?.name || 'STATUS_SCHEDULED',
        home_team_id: home?.team?.id || '',
        home_team: home?.team?.displayName || '',
        home_team_abbrev: home?.team?.abbreviation || '',
        home_team_logo: home?.team?.logo || '',
        away_team_id: away?.team?.id || '',
        away_team: away?.team?.displayName || '',
        away_team_abbrev: away?.team?.abbreviation || '',
        away_team_logo: away?.team?.logo || '',
        matchup: `${away?.team?.abbreviation}@${home?.team?.abbreviation}`,
        venue: competition.venue?.fullName || 'TBD',
        spread: odds.spread ? parseFloat(odds.spread) : null,
        over_under: odds.overUnder ? parseFloat(odds.overUnder) : null,
        home_moneyline: odds.homeTeamOdds?.moneyLine || null,
        away_moneyline: odds.awayTeamOdds?.moneyLine || null,
      };
    });
    
    return games;
  } catch (error) {
    console.error('Error fetching games:', error);
    return [];
  }
}

/**
 * Fetch team roster with player stats
 */
export async function fetchTeamRoster(teamId: string): Promise<PlayerStats[]> {
  try {
    const url = `${ESPN_BASE}/teams/${teamId}/roster`;
    const response = await fetch(url, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`ESPN roster error for team ${teamId}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const athletes = data.athletes || [];
    const teamInfo = data.team || {};
    
    const players: PlayerStats[] = [];
    
    for (const athlete of athletes) {
      // Get detailed stats from athlete endpoint
      const fetchedStats = await fetchPlayerStats(athlete.id);
      
      // Merge with defaults to ensure all fields are defined
      const stats = {
        games_played: fetchedStats.games_played ?? 0,
        ppg: fetchedStats.ppg ?? 0,
        rpg: fetchedStats.rpg ?? 0,
        apg: fetchedStats.apg ?? 0,
        mpg: fetchedStats.mpg ?? 0,
        fgpct: fetchedStats.fgpct ?? 0,
        fg3pct: fetchedStats.fg3pct ?? 0,
        ftpct: fetchedStats.ftpct ?? 0,
        spg: fetchedStats.spg ?? 0,
        bpg: fetchedStats.bpg ?? 0,
        topg: fetchedStats.topg ?? 0,
        pra_avg: fetchedStats.pra_avg ?? 0,
      };
      
      players.push({
        player_id: athlete.id,
        player_name: athlete.fullName || `${athlete.firstName} ${athlete.lastName}`,
        first_name: athlete.firstName || '',
        last_name: athlete.lastName || '',
        team_id: teamId,
        team_abbrev: teamInfo.abbreviation || '',
        team_name: teamInfo.displayName || '',
        position: athlete.position?.abbreviation || '',
        jersey: athlete.jersey || '',
        height: athlete.displayHeight || '',
        weight: athlete.displayWeight || '',
        age: athlete.age || null,
        headshot: athlete.headshot?.href || null,
        ...stats,
      });
    }
    
    return players;
  } catch (error) {
    console.error(`Error fetching roster for team ${teamId}:`, error);
    return [];
  }
}

/**
 * Fetch individual player statistics
 */
export async function fetchPlayerStats(playerId: string): Promise<Partial<PlayerStats>> {
  try {
    const url = `${ESPN_BASE}/athletes/${playerId}`;
    const response = await fetch(url, {
      next: { revalidate: 1800 }, // Cache for 30 minutes
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return getDefaultStats();
    }
    
    const data = await response.json();
    const stats = data.athlete?.statistics || [];
    
    // Find season averages
    const seasonStats = stats.find((s: any) => s.type === 'total') || 
                        stats.find((s: any) => s.name === 'Regular Season') ||
                        stats[0] || {};
    
    const statMap: Record<string, number> = {};
    (seasonStats.statistics || []).forEach((stat: any) => {
      statMap[stat.name?.toLowerCase() || stat.abbreviation?.toLowerCase()] = parseFloat(stat.value) || 0;
    });
    
    const ppg = statMap['points'] || statMap['pts'] || 0;
    const rpg = statMap['rebounds'] || statMap['reb'] || 0;
    const apg = statMap['assists'] || statMap['ast'] || 0;
    
    return {
      games_played: statMap['games played'] || statMap['gp'] || 0,
      ppg,
      rpg,
      apg,
      mpg: statMap['minutes'] || statMap['min'] || 0,
      fgpct: statMap['field goal pct'] || statMap['fg%'] || 0,
      fg3pct: statMap['3-point pct'] || statMap['3p%'] || 0,
      ftpct: statMap['free throw pct'] || statMap['ft%'] || 0,
      spg: statMap['steals'] || statMap['stl'] || 0,
      bpg: statMap['blocks'] || statMap['blk'] || 0,
      topg: statMap['turnovers'] || statMap['to'] || 0,
      pra_avg: ppg + rpg + apg,
    };
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return getDefaultStats();
  }
}

/**
 * Fetch player's recent game logs
 */
export async function fetchPlayerGameLog(playerId: string, limit: number = 10): Promise<number[]> {
  try {
    // ESPN game log endpoint
    const url = `${ESPN_BASE}/athletes/${playerId}/gamelog`;
    const response = await fetch(url, {
      next: { revalidate: 1800 },
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const games = data.events || data.games || [];
    
    const praValues: number[] = [];
    
    for (const game of games.slice(0, limit)) {
      const stats = game.statistics || game.stats || [];
      let points = 0, rebounds = 0, assists = 0;
      
      for (const stat of stats) {
        const name = (stat.name || stat.abbreviation || '').toLowerCase();
        const value = parseFloat(stat.value) || 0;
        
        if (name === 'pts' || name === 'points') points = value;
        if (name === 'reb' || name === 'rebounds') rebounds = value;
        if (name === 'ast' || name === 'assists') assists = value;
      }
      
      praValues.push(points + rebounds + assists);
    }
    
    return praValues;
  } catch (error) {
    console.error(`Error fetching game log for player ${playerId}:`, error);
    return [];
  }
}

/**
 * Get all players for today's games with enhanced stats
 */
export async function fetchAllPlayersForGames(games: Game[]): Promise<EnhancedPlayerData[]> {
  const allPlayers: EnhancedPlayerData[] = [];
  const processedTeams = new Set<string>();
  
  for (const game of games) {
    for (const teamKey of ['home', 'away'] as const) {
      const teamId = teamKey === 'home' ? game.home_team_id : game.away_team_id;
      
      if (!teamId || processedTeams.has(teamId)) continue;
      processedTeams.add(teamId);
      
      // Fetch roster
      const roster = await fetchTeamRoster(teamId);
      
      // Process each player
      for (const player of roster) {
        // Fetch recent game logs
        const lastGamesPra = await fetchPlayerGameLog(player.player_id, 10);
        
        // Calculate derived stats
        const avgPra = lastGamesPra.length > 0 
          ? lastGamesPra.reduce((a, b) => a + b, 0) / lastGamesPra.length 
          : player.pra_avg;
        
        const maxPra = lastGamesPra.length > 0 ? Math.max(...lastGamesPra) : Math.round(player.pra_avg * 1.3);
        const minPra = lastGamesPra.length > 0 ? Math.min(...lastGamesPra) : Math.round(player.pra_avg * 0.7);
        
        // Calculate standard deviation
        const stdDev = lastGamesPra.length > 1
          ? Math.sqrt(lastGamesPra.reduce((sum, val) => sum + Math.pow(val - avgPra, 2), 0) / lastGamesPra.length)
          : player.pra_avg * 0.15;
        
        // Estimate usage rate based on scoring + assists
        const estimatedUsage = Math.min(35, Math.max(15, 
          (player.ppg / 1.2) + (player.apg * 0.8)
        ));
        
        // Add game context
        const isHome = teamId === game.home_team_id;
        
        allPlayers.push({
          ...player,
          game_id: game.game_id,
          matchup: game.matchup,
          opponent_id: isHome ? game.away_team_id : game.home_team_id,
          opponent_abbrev: isHome ? game.away_team_abbrev : game.home_team_abbrev,
          is_home: isHome,
          spread: game.spread,
          over_under: game.over_under,
          
          // Enhanced stats
          last_games_pra: lastGamesPra.length > 0 ? lastGamesPra : generateEstimatedPra(player.pra_avg, 10),
          avg_pra_last_10: Math.round(avgPra * 10) / 10,
          max_pra_last_10: maxPra,
          min_pra_last_10: minPra,
          std_dev_pra: Math.round(stdDev * 10) / 10,
          usage_rate: Math.round(estimatedUsage * 10) / 10,
          triple_doubles: estimateTripleDoubles(player),
          injury_status: null, // Would need separate injury feed
        });
      }
      
      // Rate limiting - wait between team requests
      await delay(300);
    }
  }
  
  // Filter to players with meaningful stats (likely to play)
  return allPlayers.filter(p => p.mpg >= 10 && p.games_played >= 3);
}

/**
 * Quick fetch - gets games and uses estimated stats (faster, less API calls)
 */
export async function quickFetchPlayers(games: Game[]): Promise<EnhancedPlayerData[]> {
  const allPlayers: EnhancedPlayerData[] = [];
  const processedTeams = new Set<string>();
  
  for (const game of games) {
    for (const teamKey of ['home', 'away'] as const) {
      const teamId = teamKey === 'home' ? game.home_team_id : game.away_team_id;
      
      if (!teamId || processedTeams.has(teamId)) continue;
      processedTeams.add(teamId);
      
      try {
        // Just fetch roster with basic stats
        const url = `${ESPN_BASE}/teams/${teamId}/roster`;
        const response = await fetch(url, {
          next: { revalidate: 3600 },
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) continue;
        
        const data = await response.json();
        const athletes = data.athletes || [];
        const teamInfo = data.team || {};
        
        const isHome = teamId === game.home_team_id;
        
        for (const athlete of athletes) {
          // Parse stats from roster response
          const parsedStats = parseAthleteStats(athlete);
          
          // Ensure all stats have values
          const stats = {
            games_played: parsedStats.games_played ?? 0,
            ppg: parsedStats.ppg ?? 0,
            rpg: parsedStats.rpg ?? 0,
            apg: parsedStats.apg ?? 0,
            mpg: parsedStats.mpg ?? 0,
            fgpct: parsedStats.fgpct ?? 0,
            fg3pct: parsedStats.fg3pct ?? 0,
            ftpct: parsedStats.ftpct ?? 0,
            spg: parsedStats.spg ?? 0,
            bpg: parsedStats.bpg ?? 0,
            topg: parsedStats.topg ?? 0,
          };
          
          if (stats.mpg < 10) continue; // Skip low-minute players
          
          const praAvg = stats.ppg + stats.rpg + stats.apg;
          
          allPlayers.push({
            player_id: athlete.id,
            player_name: athlete.fullName || `${athlete.firstName} ${athlete.lastName}`,
            first_name: athlete.firstName || '',
            last_name: athlete.lastName || '',
            team_id: teamId,
            team_abbrev: teamInfo.abbreviation || '',
            team_name: teamInfo.displayName || '',
            position: athlete.position?.abbreviation || '',
            jersey: athlete.jersey || '',
            height: athlete.displayHeight || '',
            weight: athlete.displayWeight || '',
            age: athlete.age || null,
            headshot: athlete.headshot?.href || null,
            
            ...stats,
            pra_avg: praAvg,
            
            // Game context
            game_id: game.game_id,
            matchup: game.matchup,
            opponent_id: isHome ? game.away_team_id : game.home_team_id,
            opponent_abbrev: isHome ? game.away_team_abbrev : game.home_team_abbrev,
            is_home: isHome,
            spread: game.spread,
            over_under: game.over_under,
            
            // Estimated enhanced stats
            last_games_pra: generateEstimatedPra(praAvg, 10),
            avg_pra_last_10: praAvg,
            max_pra_last_10: Math.round(praAvg * 1.25),
            min_pra_last_10: Math.round(praAvg * 0.75),
            std_dev_pra: Math.round(praAvg * 0.12 * 10) / 10,
            usage_rate: Math.min(35, Math.max(15, (stats.ppg / 1.2) + (stats.apg * 0.8))),
            triple_doubles: estimateTripleDoubles(stats),
            injury_status: null,
          });
        }
        
        await delay(200);
      } catch (error) {
        console.error(`Error processing team ${teamId}:`, error);
      }
    }
  }
  
  return allPlayers.sort((a, b) => b.pra_avg - a.pra_avg);
}

// Helper functions

function getDefaultStats(): Partial<PlayerStats> {
  return {
    games_played: 0,
    ppg: 0,
    rpg: 0,
    apg: 0,
    mpg: 0,
    fgpct: 0,
    fg3pct: 0,
    ftpct: 0,
    spg: 0,
    bpg: 0,
    topg: 0,
    pra_avg: 0,
  };
}

function parseAthleteStats(athlete: any): Partial<PlayerStats> {
  const stats = athlete.statistics || [];
  
  // Try to find per-game averages
  let ppg = 0, rpg = 0, apg = 0, mpg = 0, gp = 0;
  let fgpct = 0, fg3pct = 0, ftpct = 0, spg = 0, bpg = 0, topg = 0;
  
  for (const stat of stats) {
    const name = (stat.name || stat.abbreviation || '').toLowerCase();
    const value = parseFloat(stat.displayValue || stat.value) || 0;
    
    if (name.includes('point') || name === 'pts') ppg = value;
    if (name.includes('rebound') || name === 'reb') rpg = value;
    if (name.includes('assist') || name === 'ast') apg = value;
    if (name.includes('minute') || name === 'min') mpg = value;
    if (name.includes('game') || name === 'gp') gp = value;
    if (name === 'fg%' || name.includes('field goal')) fgpct = value;
    if (name === '3p%' || name.includes('3-point')) fg3pct = value;
    if (name === 'ft%' || name.includes('free throw')) ftpct = value;
    if (name.includes('steal') || name === 'stl') spg = value;
    if (name.includes('block') || name === 'blk') bpg = value;
    if (name.includes('turnover') || name === 'to') topg = value;
  }
  
  return {
    games_played: gp,
    ppg,
    rpg,
    apg,
    mpg,
    fgpct,
    fg3pct,
    ftpct,
    spg,
    bpg,
    topg,
  };
}

function generateEstimatedPra(avgPra: number, count: number): number[] {
  const pras: number[] = [];
  const variance = avgPra * 0.15;
  
  for (let i = 0; i < count; i++) {
    // Generate somewhat realistic variance
    const randomFactor = (Math.random() - 0.5) * 2 * variance;
    pras.push(Math.max(0, Math.round(avgPra + randomFactor)));
  }
  
  return pras;
}

function estimateTripleDoubles(player: Partial<PlayerStats>): number {
  const ppg = player.ppg || 0;
  const rpg = player.rpg || 0;
  const apg = player.apg || 0;
  
  // Rough estimation based on how close they are to triple-double averages
  if (ppg >= 20 && rpg >= 8 && apg >= 8) return 8;
  if (ppg >= 18 && rpg >= 7 && apg >= 7) return 4;
  if ((rpg >= 10 && apg >= 6) || (apg >= 10 && rpg >= 6)) return 2;
  if (ppg >= 15 && (rpg >= 6 || apg >= 6)) return 1;
  return 0;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  fetchGames,
  fetchTeamRoster,
  fetchPlayerStats,
  fetchPlayerGameLog,
  fetchAllPlayersForGames,
  quickFetchPlayers,
};
