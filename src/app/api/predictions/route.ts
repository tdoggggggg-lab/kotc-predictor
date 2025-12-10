import { NextRequest, NextResponse } from 'next/server';
import { fetchTodaysGames, fetchPlayersForGames, detectBackToBack, EnhancedPlayerData } from '@/lib/espn-data';
import { rankPlayers, ScoredPlayer, ModelComparison } from '@/lib/scoring';
import { fetchInjuries, getPlayerInjuryStatus, shouldExcludePlayer, InjuryInfo } from '@/lib/injuries';

export interface PredictionResponse {
  success: boolean;
  generated_at: string;
  
  // Data source info
  data_source: 'live' | 'partial' | 'demo';
  games_source: 'espn' | 'mock';
  players_source: 'espn' | 'mock';
  
  // Game info
  games_count: number;
  games: Array<{
    home: string;
    away: string;
    time: string;
  }>;
  
  // Injury info
  injuries_loaded: boolean;
  injured_players_count: number;
  excluded_players_count: number;
  
  // B2B info
  b2b_teams: string[];
  
  // Predictions
  predictions: ScoredPlayer[];
  v2_predictions?: ScoredPlayer[];
  model_comparison?: ModelComparison;
  
  // Debug info
  debug?: {
    total_players_fetched: number;
    teams_with_data: number;
    mock_player_count: number;
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelVersion = (searchParams.get('model') || 'v1') as 'v1' | 'v2' | 'both';
  const includeInjured = searchParams.get('includeInjured') === 'true';
  
  console.log('[KOTC API] Request received, model:', modelVersion);
  
  try {
    // Fetch games first
    const { games, source: gamesSource } = await fetchTodaysGames();
    console.log(`[KOTC API] Got ${games.length} games from ${gamesSource}`);
    
    // Fetch injuries, players, and B2B in parallel
    const [injuriesMap, playersResult, b2bResult] = await Promise.all([
      fetchInjuries(),
      fetchPlayersForGames(games),
      detectBackToBack(games)
    ]);
    
    const { players, source: playersSource } = playersResult;
    const { teamB2B } = b2bResult;
    
    console.log(`[KOTC API] Got ${players.length} players from ${playersSource}`);
    
    // Merge injury and B2B data with players
    let injuredCount = 0;
    let excludedCount = 0;
    
    const playersWithContext: EnhancedPlayerData[] = players.map(player => {
      // Injury check
      const injury = getPlayerInjuryStatus(player.name, player.player_id, injuriesMap);
      
      // B2B check
      const isB2B = teamB2B.has(player.team_abbrev);
      const oppB2B = teamB2B.has(player.opponent_abbrev);
      
      if (injury) {
        injuredCount++;
        return {
          ...player,
          injury_status: injury.status,
          injury_type: injury.injury_type,
          injury_details: injury.details,
          is_b2b: isB2B,
          opponent_b2b: oppB2B
        };
      }
      
      return {
        ...player,
        injury_status: 'HEALTHY' as const,
        is_b2b: isB2B,
        opponent_b2b: oppB2B
      };
    });
    
    // Filter out OUT/DOUBTFUL players unless requested
    const filteredPlayers = includeInjured 
      ? playersWithContext 
      : playersWithContext.filter(p => {
          const exclude = shouldExcludePlayer(p.injury_status || 'HEALTHY');
          if (exclude) excludedCount++;
          return !exclude;
        });
    
    // Determine overall data source status
    let dataSource: 'live' | 'partial' | 'demo';
    if (gamesSource === 'espn' && playersSource === 'espn') {
      dataSource = 'live';
    } else if (gamesSource === 'espn' || playersSource === 'espn') {
      dataSource = 'partial';
    } else {
      dataSource = 'demo';
    }
    
    // Rank players
    const { v1, v2, comparison } = rankPlayers(filteredPlayers, modelVersion);
    
    const mockCount = filteredPlayers.filter(p => p.is_mock).length;
    
    const response: PredictionResponse = {
      success: true,
      generated_at: new Date().toISOString(),
      
      data_source: dataSource,
      games_source: gamesSource,
      players_source: playersSource,
      
      games_count: games.length,
      games: games.map(g => ({
        home: g.home_team_abbrev,
        away: g.away_team_abbrev,
        time: g.game_time
      })),
      
      injuries_loaded: injuriesMap.size > 0,
      injured_players_count: injuredCount,
      excluded_players_count: excludedCount,
      
      b2b_teams: Array.from(teamB2B),
      
      predictions: modelVersion === 'v2' ? v2.slice(0, 50) : v1.slice(0, 50),
      v2_predictions: modelVersion === 'both' ? v2.slice(0, 50) : undefined,
      model_comparison: modelVersion === 'both' ? comparison : undefined,
      
      debug: {
        total_players_fetched: players.length,
        teams_with_data: new Set(filteredPlayers.map(p => p.team_abbrev)).size,
        mock_player_count: mockCount
      }
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300',
      }
    });
    
  } catch (error) {
    console.error('[KOTC API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data_source: 'demo'
    }, { status: 500 });
  }
}
