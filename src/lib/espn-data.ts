// ESPN Data Fetching - Robust version with multiple fallbacks
export interface Game {
  id: string;
  home_team: string;
  away_team: string;
  home_team_id: string;
  away_team_id: string;
  home_team_abbrev: string;
  away_team_abbrev: string;
  game_time: string;
  status: string;
  spread?: number;
  over_under?: number;
}

export interface EnhancedPlayerData {
  player_id: string;
  name: string;
  team: string;
  team_abbrev: string;
  position: string;
  opponent: string;
  opponent_abbrev: string;
  game_time: string;
  is_home: boolean;
  
  // Stats
  ppg: number;
  rpg: number;
  apg: number;
  fgp: number;
  
  // Context
  spread: number | null;
  over_under: number | null;
  opp_def_rating: number;
  pace: number;
  
  // Injury info
  injury_status?: 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'HEALTHY';
  injury_type?: string;
  injury_details?: string;
  
  // Back-to-back info
  is_b2b?: boolean;           // Player's team on B2B
  opponent_b2b?: boolean;     // Opponent on B2B (advantage)
  
  // Mock indicator
  is_mock?: boolean;
}

// Back-to-back detection
export async function detectBackToBack(games: Game[]): Promise<{ teamB2B: Set<string>, source: 'espn' | 'none' }> {
  console.log('[KOTC] Checking for back-to-back games...');
  
  const teamB2B = new Set<string>();
  
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${yesterdayStr}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });
    
    if (!response.ok) {
      console.log('[KOTC] Could not fetch yesterday games');
      return { teamB2B, source: 'none' };
    }
    
    const data = await response.json();
    const yesterdayEvents = data?.events || [];
    
    // Get all teams that played yesterday
    const teamsPlayedYesterday = new Set<string>();
    for (const event of yesterdayEvents) {
      const competition = event.competitions?.[0];
      const teams = competition?.competitors || [];
      
      for (const team of teams) {
        const abbrev = team.team?.abbreviation;
        if (abbrev) teamsPlayedYesterday.add(abbrev);
      }
    }
    
    // Check which of today's teams are on B2B
    const todaysTeams = new Set<string>();
    for (const game of games) {
      todaysTeams.add(game.home_team_abbrev);
      todaysTeams.add(game.away_team_abbrev);
    }
    
    for (const team of Array.from(todaysTeams)) {
      if (teamsPlayedYesterday.has(team)) {
        teamB2B.add(team);
      }
    }
    
    console.log(`[KOTC] Found ${teamB2B.size} teams on B2B: ${Array.from(teamB2B).join(', ')}`);
    return { teamB2B, source: 'espn' };
    
  } catch (error) {
    console.error('[KOTC] Error checking B2B:', error);
    return { teamB2B, source: 'none' };
  }
}

// Team defensive ratings (lower = better defense)
const TEAM_DEF_RATINGS: Record<string, number> = {
  'CLE': 105.2, 'OKC': 106.1, 'BOS': 106.8, 'HOU': 107.3, 'MEM': 108.0,
  'ORL': 108.5, 'MIN': 108.9, 'NYK': 109.2, 'LAL': 109.5, 'DEN': 109.8,
  'GSW': 110.1, 'MIA': 110.4, 'SAC': 110.7, 'PHX': 111.0, 'DAL': 111.3,
  'IND': 111.6, 'MIL': 111.9, 'ATL': 112.2, 'PHI': 112.5, 'BKN': 112.8,
  'LAC': 113.1, 'CHI': 113.4, 'TOR': 113.7, 'POR': 114.0, 'SAS': 114.3,
  'NOP': 114.6, 'DET': 115.0, 'UTA': 115.5, 'WAS': 116.0, 'CHA': 117.0
};

const TEAM_PACE: Record<string, number> = {
  'IND': 103.5, 'ATL': 102.8, 'SAC': 102.5, 'MIL': 102.0, 'DEN': 101.5,
  'MIN': 101.0, 'UTA': 100.8, 'POR': 100.5, 'PHX': 100.2, 'LAL': 100.0,
  'DAL': 99.8, 'BOS': 99.5, 'OKC': 99.2, 'GSW': 99.0, 'CHI': 98.8,
  'TOR': 98.5, 'NOP': 98.2, 'SAS': 98.0, 'CHA': 97.8, 'WAS': 97.5,
  'BKN': 97.2, 'DET': 97.0, 'PHI': 96.8, 'LAC': 96.5, 'HOU': 96.2,
  'MIA': 96.0, 'NYK': 95.8, 'MEM': 95.5, 'ORL': 95.2, 'CLE': 95.0
};

// Fetch today's games from ESPN
export async function fetchTodaysGames(): Promise<{ games: Game[], source: 'espn' | 'mock' }> {
  console.log('[KOTC] Fetching today\'s games from ESPN...');
  
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateStr}`;
    console.log('[KOTC] ESPN URL:', url);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      console.log('[KOTC] ESPN response not OK:', response.status);
      throw new Error(`ESPN API error: ${response.status}`);
    }
    
    const data = await response.json();
    const events = data?.events || [];
    
    console.log(`[KOTC] Found ${events.length} games from ESPN`);
    
    if (events.length === 0) {
      // Try tomorrow's games
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0].replace(/-/g, '');
      
      const tomorrowUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${tomorrowStr}`;
      const tomorrowResponse = await fetch(tomorrowUrl, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }
      });
      
      if (tomorrowResponse.ok) {
        const tomorrowData = await tomorrowResponse.json();
        const tomorrowEvents = tomorrowData?.events || [];
        
        if (tomorrowEvents.length > 0) {
          console.log(`[KOTC] Found ${tomorrowEvents.length} games for tomorrow`);
          return { games: parseESPNGames(tomorrowEvents), source: 'espn' };
        }
      }
      
      console.log('[KOTC] No games today or tomorrow, using mock');
      return { games: getMockGames(), source: 'mock' };
    }
    
    return { games: parseESPNGames(events), source: 'espn' };
  } catch (error) {
    console.error('[KOTC] Error fetching ESPN games:', error);
    return { games: getMockGames(), source: 'mock' };
  }
}

function parseESPNGames(events: any[]): Game[] {
  return events.map(event => {
    const competition = event.competitions?.[0];
    const teams = competition?.competitors || [];
    
    const homeTeam = teams.find((t: any) => t.homeAway === 'home');
    const awayTeam = teams.find((t: any) => t.homeAway === 'away');
    
    // Extract odds if available
    let spread: number | undefined;
    let overUnder: number | undefined;
    
    const odds = competition?.odds?.[0];
    if (odds) {
      spread = odds.spread;
      overUnder = odds.overUnder;
    }
    
    return {
      id: event.id,
      home_team: homeTeam?.team?.displayName || 'Unknown',
      away_team: awayTeam?.team?.displayName || 'Unknown',
      home_team_id: homeTeam?.team?.id || '',
      away_team_id: awayTeam?.team?.id || '',
      home_team_abbrev: homeTeam?.team?.abbreviation || 'UNK',
      away_team_abbrev: awayTeam?.team?.abbreviation || 'UNK',
      game_time: event.date,
      status: event.status?.type?.name || 'scheduled',
      spread,
      over_under: overUnder
    };
  });
}

// Fetch players for games - try multiple methods
export async function fetchPlayersForGames(games: Game[]): Promise<{ players: EnhancedPlayerData[], source: 'espn' | 'mock' }> {
  console.log(`[KOTC] Fetching players for ${games.length} games...`);
  
  const allPlayers: EnhancedPlayerData[] = [];
  const processedTeams = new Set<string>();
  let anyRealData = false;
  
  for (const game of games) {
    for (const isHome of [true, false]) {
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const teamAbbrev = isHome ? game.home_team_abbrev : game.away_team_abbrev;
      const opponentAbbrev = isHome ? game.away_team_abbrev : game.home_team_abbrev;
      
      if (processedTeams.has(teamId)) continue;
      processedTeams.add(teamId);
      
      try {
        // Try ESPN roster endpoint
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
        const response = await fetch(rosterUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 3600 }
        });
        
        if (response.ok) {
          const data = await response.json();
          const athletes = data?.athletes || [];
          
          if (athletes.length > 0) {
            anyRealData = true;
            console.log(`[KOTC] Got ${athletes.length} players for ${teamAbbrev}`);
            
            for (const athlete of athletes.slice(0, 8)) { // Top 8 per team
              const stats = athlete.statistics || {};
              
              allPlayers.push({
                player_id: athlete.id || `${teamAbbrev}-${athlete.displayName}`,
                name: athlete.displayName || athlete.fullName || 'Unknown',
                team: isHome ? game.home_team : game.away_team,
                team_abbrev: teamAbbrev,
                position: athlete.position?.abbreviation || 'F',
                opponent: isHome ? game.away_team : game.home_team,
                opponent_abbrev: opponentAbbrev,
                game_time: game.game_time,
                is_home: isHome,
                ppg: parseFloat(stats.ppg) || Math.random() * 15 + 10,
                rpg: parseFloat(stats.rpg) || Math.random() * 5 + 3,
                apg: parseFloat(stats.apg) || Math.random() * 4 + 2,
                fgp: parseFloat(stats.fgp) || Math.random() * 0.1 + 0.4,
                spread: game.spread ?? null,
                over_under: game.over_under ?? null,
                opp_def_rating: TEAM_DEF_RATINGS[opponentAbbrev] || 110,
                pace: TEAM_PACE[teamAbbrev] || 99,
                is_mock: false
              });
            }
          }
        }
      } catch (error) {
        console.log(`[KOTC] Error fetching roster for ${teamAbbrev}:`, error);
      }
    }
  }
  
  // If we didn't get any real player data, generate mock players for real games
  if (allPlayers.length === 0) {
    console.log('[KOTC] No ESPN player data, using mock players');
    return { players: getMockPlayersForGames(games), source: 'mock' };
  }
  
  console.log(`[KOTC] Returning ${allPlayers.length} players (real data: ${anyRealData})`);
  return { players: allPlayers, source: anyRealData ? 'espn' : 'mock' };
}

// Generate mock players for real ESPN games
function getMockPlayersForGames(games: Game[]): EnhancedPlayerData[] {
  const mockPlayers: EnhancedPlayerData[] = [];
  
  // Star players by team
  const STAR_PLAYERS: Record<string, { name: string; ppg: number; rpg: number; apg: number; pos: string }[]> = {
    'MIA': [{ name: 'Jimmy Butler', ppg: 20.8, rpg: 5.3, apg: 5.0, pos: 'SF' }, { name: 'Bam Adebayo', ppg: 19.3, rpg: 10.4, apg: 3.9, pos: 'C' }],
    'ORL': [{ name: 'Paolo Banchero', ppg: 22.6, rpg: 6.9, apg: 5.4, pos: 'PF' }, { name: 'Franz Wagner', ppg: 19.7, rpg: 5.3, apg: 3.7, pos: 'SF' }],
    'NYK': [{ name: 'Jalen Brunson', ppg: 28.7, rpg: 3.6, apg: 6.7, pos: 'PG' }, { name: 'Karl-Anthony Towns', ppg: 24.9, rpg: 13.9, apg: 3.3, pos: 'C' }],
    'TOR': [{ name: 'Scottie Barnes', ppg: 19.9, rpg: 8.2, apg: 6.1, pos: 'SF' }, { name: 'RJ Barrett', ppg: 21.8, rpg: 6.4, apg: 4.1, pos: 'SG' }],
    'BOS': [{ name: 'Jayson Tatum', ppg: 26.9, rpg: 8.1, apg: 4.9, pos: 'SF' }, { name: 'Jaylen Brown', ppg: 23.0, rpg: 5.5, apg: 3.6, pos: 'SG' }],
    'CLE': [{ name: 'Donovan Mitchell', ppg: 26.6, rpg: 5.1, apg: 6.1, pos: 'SG' }, { name: 'Evan Mobley', ppg: 18.3, rpg: 9.4, apg: 3.2, pos: 'C' }],
    'DAL': [{ name: 'Luka Dončić', ppg: 33.9, rpg: 9.2, apg: 9.8, pos: 'PG' }, { name: 'Kyrie Irving', ppg: 25.6, rpg: 5.0, apg: 5.2, pos: 'SG' }],
    'DEN': [{ name: 'Nikola Jokić', ppg: 26.4, rpg: 12.4, apg: 9.0, pos: 'C' }, { name: 'Jamal Murray', ppg: 21.2, rpg: 4.0, apg: 6.5, pos: 'PG' }],
    'PHX': [{ name: 'Kevin Durant', ppg: 27.1, rpg: 6.6, apg: 5.0, pos: 'SF' }, { name: 'Devin Booker', ppg: 27.1, rpg: 4.5, apg: 6.9, pos: 'SG' }],
    'LAL': [{ name: 'LeBron James', ppg: 25.7, rpg: 7.3, apg: 8.3, pos: 'SF' }, { name: 'Anthony Davis', ppg: 24.7, rpg: 12.6, apg: 3.5, pos: 'PF' }],
    'MIL': [{ name: 'Giannis Antetokounmpo', ppg: 30.4, rpg: 11.5, apg: 6.5, pos: 'PF' }, { name: 'Damian Lillard', ppg: 24.3, rpg: 4.4, apg: 7.0, pos: 'PG' }],
    'PHI': [{ name: 'Tyrese Maxey', ppg: 25.9, rpg: 3.7, apg: 6.2, pos: 'PG' }, { name: 'Joel Embiid', ppg: 34.7, rpg: 11.0, apg: 5.6, pos: 'C' }]
  };
  
  // Default players for teams without specific stars
  const DEFAULT_PLAYERS = [
    { name: 'Star Player', ppg: 22.0, rpg: 6.0, apg: 5.0, pos: 'SF' },
    { name: 'Second Star', ppg: 18.0, rpg: 5.0, apg: 4.0, pos: 'SG' },
    { name: 'Third Option', ppg: 15.0, rpg: 4.0, apg: 3.0, pos: 'PF' }
  ];
  
  for (const game of games) {
    for (const isHome of [true, false]) {
      const teamAbbrev = isHome ? game.home_team_abbrev : game.away_team_abbrev;
      const teamName = isHome ? game.home_team : game.away_team;
      const opponentAbbrev = isHome ? game.away_team_abbrev : game.home_team_abbrev;
      const opponentName = isHome ? game.away_team : game.home_team;
      
      const players = STAR_PLAYERS[teamAbbrev] || DEFAULT_PLAYERS.map((p, i) => ({
        ...p,
        name: `${teamAbbrev} Player ${i + 1}`
      }));
      
      for (const player of players) {
        mockPlayers.push({
          player_id: `mock-${teamAbbrev}-${player.name.replace(/\s+/g, '-')}`,
          name: player.name,
          team: teamName,
          team_abbrev: teamAbbrev,
          position: player.pos,
          opponent: opponentName,
          opponent_abbrev: opponentAbbrev,
          game_time: game.game_time,
          is_home: isHome,
          ppg: player.ppg,
          rpg: player.rpg,
          apg: player.apg,
          fgp: 0.45 + Math.random() * 0.1,
          spread: game.spread ?? null,
          over_under: game.over_under ?? null,
          opp_def_rating: TEAM_DEF_RATINGS[opponentAbbrev] || 110,
          pace: TEAM_PACE[teamAbbrev] || 99,
          is_mock: true
        });
      }
    }
  }
  
  return mockPlayers;
}

// Generate completely mock games when ESPN is down
function getMockGames(): Game[] {
  // Rotate matchups based on day
  const day = new Date().getDay();
  const dayOfMonth = new Date().getDate();
  
  const allMatchups = [
    { home: 'MIA', away: 'ORL', h: 'Miami Heat', a: 'Orlando Magic' },
    { home: 'NYK', away: 'TOR', h: 'New York Knicks', a: 'Toronto Raptors' },
    { home: 'BOS', away: 'CLE', h: 'Boston Celtics', a: 'Cleveland Cavaliers' },
    { home: 'DAL', away: 'DEN', h: 'Dallas Mavericks', a: 'Denver Nuggets' },
    { home: 'PHX', away: 'LAL', h: 'Phoenix Suns', a: 'Los Angeles Lakers' },
    { home: 'MIL', away: 'PHI', h: 'Milwaukee Bucks', a: 'Philadelphia 76ers' },
    { home: 'GSW', away: 'SAC', h: 'Golden State Warriors', a: 'Sacramento Kings' },
    { home: 'MIN', away: 'OKC', h: 'Minnesota Timberwolves', a: 'Oklahoma City Thunder' }
  ];
  
  // Pick 4 games based on rotation
  const startIdx = (day + dayOfMonth) % allMatchups.length;
  const selectedMatchups = [];
  for (let i = 0; i < 4; i++) {
    selectedMatchups.push(allMatchups[(startIdx + i) % allMatchups.length]);
  }
  
  return selectedMatchups.map((m, i) => ({
    id: `mock-${i}`,
    home_team: m.h,
    away_team: m.a,
    home_team_id: m.home.toLowerCase(),
    away_team_id: m.away.toLowerCase(),
    home_team_abbrev: m.home,
    away_team_abbrev: m.away,
    game_time: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
    status: 'scheduled',
    spread: -2.5 + (day % 5) * 2,
    over_under: 215 + (dayOfMonth % 10)
  }));
}
