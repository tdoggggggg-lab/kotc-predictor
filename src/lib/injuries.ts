// NBA Injury Tracking
// Fetches injury data from ESPN and flags players

export type InjuryStatus = 'OUT' | 'DOUBTFUL' | 'QUESTIONABLE' | 'PROBABLE' | 'HEALTHY';

export interface InjuryInfo {
  player_name: string;
  player_id?: string;
  team: string;
  team_abbrev: string;
  status: InjuryStatus;
  injury_type: string; // e.g., "Knee", "Ankle", "Rest"
  details?: string;
  return_date?: string;
}

// Fetch injuries from ESPN
export async function fetchInjuries(): Promise<Map<string, InjuryInfo>> {
  console.log('[KOTC] Fetching NBA injuries...');
  
  const injuries = new Map<string, InjuryInfo>();
  
  try {
    // ESPN injuries endpoint
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 900 } // Cache 15 minutes
    });
    
    if (!response.ok) {
      console.log('[KOTC] ESPN injuries API error:', response.status);
      return injuries;
    }
    
    const data = await response.json();
    
    // ESPN returns injuries grouped by team
    const teams = data?.injuries || [];
    
    for (const team of teams) {
      const teamAbbrev = team.team?.abbreviation || '';
      const teamName = team.team?.displayName || '';
      const teamInjuries = team.injuries || [];
      
      for (const injury of teamInjuries) {
        const athlete = injury.athlete || {};
        const playerName = athlete.displayName || '';
        const playerId = athlete.id || '';
        
        // Parse status
        const statusText = (injury.status || '').toUpperCase();
        let status: InjuryStatus = 'HEALTHY';
        
        if (statusText.includes('OUT')) status = 'OUT';
        else if (statusText.includes('DOUBTFUL')) status = 'DOUBTFUL';
        else if (statusText.includes('QUESTIONABLE')) status = 'QUESTIONABLE';
        else if (statusText.includes('PROBABLE')) status = 'PROBABLE';
        else if (statusText.includes('DAY-TO-DAY')) status = 'QUESTIONABLE';
        
        const injuryInfo: InjuryInfo = {
          player_name: playerName,
          player_id: playerId,
          team: teamName,
          team_abbrev: teamAbbrev,
          status,
          injury_type: injury.type?.description || injury.details?.type || 'Unknown',
          details: injury.longComment || injury.shortComment || '',
          return_date: injury.details?.returnDate
        };
        
        // Key by normalized player name for matching
        const key = normalizePlayerName(playerName);
        injuries.set(key, injuryInfo);
        
        // Also key by player ID if available
        if (playerId) {
          injuries.set(playerId, injuryInfo);
        }
      }
    }
    
    console.log(`[KOTC] Found ${injuries.size} injured players`);
    
  } catch (error) {
    console.error('[KOTC] Error fetching injuries:', error);
  }
  
  return injuries;
}

// Normalize player name for matching
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z]/g, ''); // Remove non-letters
}

// Get injury status for a player
export function getPlayerInjuryStatus(
  playerName: string,
  playerId: string | undefined,
  injuries: Map<string, InjuryInfo>
): InjuryInfo | null {
  // Try by ID first
  if (playerId && injuries.has(playerId)) {
    return injuries.get(playerId)!;
  }
  
  // Try by normalized name
  const key = normalizePlayerName(playerName);
  if (injuries.has(key)) {
    return injuries.get(key)!;
  }
  
  return null;
}

// Score adjustment based on injury status
export function getInjuryScoreAdjustment(status: InjuryStatus): number {
  switch (status) {
    case 'OUT':
      return -1000; // Effectively remove from rankings
    case 'DOUBTFUL':
      return -500; // Likely not playing
    case 'QUESTIONABLE':
      return -15; // Risky pick
    case 'PROBABLE':
      return -3; // Minor concern
    case 'HEALTHY':
    default:
      return 0;
  }
}

// Check if player should be excluded from predictions
export function shouldExcludePlayer(status: InjuryStatus): boolean {
  return status === 'OUT' || status === 'DOUBTFUL';
}

// Get display color for injury status
export function getInjuryStatusColor(status: InjuryStatus): string {
  switch (status) {
    case 'OUT':
      return 'text-red-500';
    case 'DOUBTFUL':
      return 'text-red-400';
    case 'QUESTIONABLE':
      return 'text-yellow-400';
    case 'PROBABLE':
      return 'text-yellow-300';
    case 'HEALTHY':
    default:
      return 'text-green-400';
  }
}

// Get injury badge text
export function getInjuryBadge(status: InjuryStatus): string {
  switch (status) {
    case 'OUT':
      return 'OUT';
    case 'DOUBTFUL':
      return 'DTD';
    case 'QUESTIONABLE':
      return 'GTD';
    case 'PROBABLE':
      return 'PROB';
    default:
      return '';
  }
}
