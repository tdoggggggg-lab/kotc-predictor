import { NextRequest, NextResponse } from 'next/server';
import { fetchTodaysGames, fetchPlayersForGames, detectBackToBack } from '@/lib/espn-data';
import { rankPlayers } from '@/lib/scoring';
import { fetchInjuries, getPlayerInjuryStatus, shouldExcludePlayer } from '@/lib/injuries';
import { 
  enrichPlayersWithSalary, 
  generateLineups, 
  DEFAULT_KOTC_SETTINGS,
  OptimizationSettings,
  Lineup 
} from '@/lib/optimizer';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const modelVersion = (searchParams.get('model') || 'v1') as 'v1' | 'v2';
  const lineupCount = parseInt(searchParams.get('count') || '5');
  const salaryCap = parseInt(searchParams.get('salary') || '50000');
  
  try {
    // Fetch all data
    const { games } = await fetchTodaysGames();
    const [injuriesMap, playersResult, b2bResult] = await Promise.all([
      fetchInjuries(),
      fetchPlayersForGames(games),
      detectBackToBack(games)
    ]);
    
    const { players } = playersResult;
    const { teamB2B } = b2bResult;
    
    // Enrich with injuries and B2B
    const enrichedPlayers = players.map(player => {
      const injury = getPlayerInjuryStatus(player.name, player.player_id, injuriesMap);
      return {
        ...player,
        injury_status: injury?.status || 'HEALTHY' as const,
        is_b2b: teamB2B.has(player.team_abbrev),
        opponent_b2b: teamB2B.has(player.opponent_abbrev)
      };
    });
    
    // Filter out injured players
    const healthyPlayers = enrichedPlayers.filter(
      p => !shouldExcludePlayer(p.injury_status || 'HEALTHY')
    );
    
    // Rank and score players
    const { v1, v2 } = rankPlayers(healthyPlayers, 'both');
    const rankedPlayers = modelVersion === 'v2' ? v2 : v1;
    
    // Add salary estimates
    const playersWithSalary = enrichPlayersWithSalary(rankedPlayers);
    
    // Generate optimized lineups
    const settings: OptimizationSettings = {
      ...DEFAULT_KOTC_SETTINGS,
      salary_cap: salaryCap,
      model_version: modelVersion
    };
    
    const lineups = generateLineups(playersWithSalary, lineupCount, settings);
    
    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      settings: {
        salary_cap: salaryCap,
        model_version: modelVersion,
        roster_size: settings.roster_size,
        positions: settings.positions
      },
      lineups,
      available_players: playersWithSalary.slice(0, 30).map(p => ({
        player_id: p.player_id,
        name: p.name,
        team: p.team_abbrev,
        position: p.position,
        dk_position: p.dk_position,
        salary: p.salary,
        projected: modelVersion === 'v2' ? p.v2_score : p.v1_score,
        value: (modelVersion === 'v2' ? p.v2_score : p.v1_score) / (p.salary / 1000),
        injury_status: p.injury_status,
        is_b2b: p.is_b2b
      }))
    });
    
  } catch (error) {
    console.error('[KOTC Optimizer] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
