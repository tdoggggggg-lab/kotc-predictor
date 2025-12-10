// DraftKings KOTC Lineup Optimizer
// Builds optimal lineups based on predictions and salary constraints

import { ScoredPlayer } from './scoring';

export interface DKPlayer extends ScoredPlayer {
  salary: number;
  dk_position: string; // PG, SG, SF, PF, C, G, F, UTIL
}

export interface LineupSlot {
  position: string;
  player: DKPlayer | null;
}

export interface Lineup {
  slots: LineupSlot[];
  total_salary: number;
  remaining_salary: number;
  projected_score: number;
  value_score: number; // Points per $1000
}

export interface OptimizationSettings {
  salary_cap: number;
  roster_size: number;
  positions: string[];
  min_salary_per_player: number;
  max_players_per_team: number;
  model_version: 'v1' | 'v2';
}

// Default KOTC settings (adjust based on actual DK KOTC format)
export const DEFAULT_KOTC_SETTINGS: OptimizationSettings = {
  salary_cap: 50000,
  roster_size: 6,
  positions: ['G', 'G', 'F', 'F', 'UTIL', 'UTIL'],
  min_salary_per_player: 3000,
  max_players_per_team: 3,
  model_version: 'v1'
};

// Position eligibility mapping
const POSITION_ELIGIBILITY: Record<string, string[]> = {
  'PG': ['PG', 'G', 'UTIL'],
  'SG': ['SG', 'G', 'UTIL'],
  'SF': ['SF', 'F', 'UTIL'],
  'PF': ['PF', 'F', 'UTIL'],
  'C': ['C', 'F', 'UTIL'], // C can usually fill F in KOTC
  'G': ['G', 'UTIL'],
  'F': ['F', 'UTIL']
};

// Estimate salary based on projected score (mock - real would come from DK API)
export function estimateSalary(player: ScoredPlayer): number {
  const score = Math.max(player.v1_score, player.v2_score);
  
  // Top tier: $9000-$10000
  if (score >= 80) return 9000 + Math.floor((score - 80) * 50);
  // High tier: $7500-$9000
  if (score >= 65) return 7500 + Math.floor((score - 65) * 100);
  // Mid tier: $5500-$7500
  if (score >= 50) return 5500 + Math.floor((score - 50) * 133);
  // Low tier: $3500-$5500
  if (score >= 35) return 3500 + Math.floor((score - 35) * 133);
  // Value tier: $3000-$3500
  return 3000 + Math.floor(score * 14);
}

// Convert position to DK-eligible positions
export function getDKPosition(position: string): string {
  const pos = position.toUpperCase();
  if (pos === 'PG' || pos === 'SG') return 'G';
  if (pos === 'SF' || pos === 'PF' || pos === 'C') return 'F';
  return pos;
}

// Check if player can fill a position slot
export function canFillPosition(playerPos: string, slotPos: string): boolean {
  const eligible = POSITION_ELIGIBILITY[playerPos.toUpperCase()] || ['UTIL'];
  return eligible.includes(slotPos) || slotPos === 'UTIL';
}

// Add salary estimates to players
export function enrichPlayersWithSalary(players: ScoredPlayer[]): DKPlayer[] {
  return players.map(p => ({
    ...p,
    salary: estimateSalary(p),
    dk_position: getDKPosition(p.position)
  }));
}

// Greedy lineup builder
export function buildLineup(
  players: DKPlayer[],
  settings: OptimizationSettings = DEFAULT_KOTC_SETTINGS
): Lineup {
  const slots: LineupSlot[] = settings.positions.map(pos => ({
    position: pos,
    player: null
  }));
  
  const usedPlayers = new Set<string>();
  const teamCounts: Record<string, number> = {};
  let totalSalary = 0;
  
  // Sort players by value (score per $1000)
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = settings.model_version === 'v2' ? a.v2_score : a.v1_score;
    const scoreB = settings.model_version === 'v2' ? b.v2_score : b.v1_score;
    const valueA = scoreA / (a.salary / 1000);
    const valueB = scoreB / (b.salary / 1000);
    return valueB - valueA;
  });
  
  // Fill each slot
  for (const slot of slots) {
    for (const player of sortedPlayers) {
      // Skip if already used
      if (usedPlayers.has(player.player_id)) continue;
      
      // Skip if team limit reached
      const teamCount = teamCounts[player.team_abbrev] || 0;
      if (teamCount >= settings.max_players_per_team) continue;
      
      // Skip if would exceed salary cap
      if (totalSalary + player.salary > settings.salary_cap) continue;
      
      // Check position eligibility
      if (!canFillPosition(player.dk_position, slot.position)) continue;
      
      // Add player to slot
      slot.player = player;
      usedPlayers.add(player.player_id);
      teamCounts[player.team_abbrev] = teamCount + 1;
      totalSalary += player.salary;
      break;
    }
  }
  
  // Calculate totals
  const projectedScore = slots.reduce((sum, slot) => {
    if (!slot.player) return sum;
    const score = settings.model_version === 'v2' 
      ? slot.player.v2_score 
      : slot.player.v1_score;
    return sum + score;
  }, 0);
  
  return {
    slots,
    total_salary: totalSalary,
    remaining_salary: settings.salary_cap - totalSalary,
    projected_score: projectedScore,
    value_score: totalSalary > 0 ? projectedScore / (totalSalary / 1000) : 0
  };
}

// Generate multiple lineup variations
export function generateLineups(
  players: DKPlayer[],
  count: number = 5,
  settings: OptimizationSettings = DEFAULT_KOTC_SETTINGS
): Lineup[] {
  const lineups: Lineup[] = [];
  const usedCombos = new Set<string>();
  
  // Generate variations by locking different top players
  const topPlayers = [...players]
    .sort((a, b) => {
      const scoreA = settings.model_version === 'v2' ? a.v2_score : a.v1_score;
      const scoreB = settings.model_version === 'v2' ? b.v2_score : b.v1_score;
      return scoreB - scoreA;
    })
    .slice(0, 20);
  
  // Primary lineup (best value)
  const primary = buildLineup(players, settings);
  const primaryKey = primary.slots.map(s => s.player?.player_id || '').sort().join(',');
  lineups.push(primary);
  usedCombos.add(primaryKey);
  
  // Generate variations by excluding top players one at a time
  for (let i = 0; i < Math.min(count - 1, topPlayers.length); i++) {
    const excludePlayer = topPlayers[i];
    const filteredPlayers = players.filter(p => p.player_id !== excludePlayer.player_id);
    
    const lineup = buildLineup(filteredPlayers, settings);
    const key = lineup.slots.map(s => s.player?.player_id || '').sort().join(',');
    
    if (!usedCombos.has(key) && lineup.slots.every(s => s.player !== null)) {
      lineups.push(lineup);
      usedCombos.add(key);
    }
    
    if (lineups.length >= count) break;
  }
  
  // Sort by projected score
  return lineups.sort((a, b) => b.projected_score - a.projected_score);
}

// Validate a lineup
export function validateLineup(lineup: Lineup, settings: OptimizationSettings): string[] {
  const errors: string[] = [];
  
  // Check all slots filled
  const emptySlots = lineup.slots.filter(s => !s.player).length;
  if (emptySlots > 0) {
    errors.push(`${emptySlots} empty roster slot(s)`);
  }
  
  // Check salary
  if (lineup.total_salary > settings.salary_cap) {
    errors.push(`Over salary cap by $${lineup.total_salary - settings.salary_cap}`);
  }
  
  // Check team limits
  const teamCounts: Record<string, number> = {};
  for (const slot of lineup.slots) {
    if (!slot.player) continue;
    teamCounts[slot.player.team_abbrev] = (teamCounts[slot.player.team_abbrev] || 0) + 1;
  }
  
  for (const [team, count] of Object.entries(teamCounts)) {
    if (count > settings.max_players_per_team) {
      errors.push(`Too many players from ${team} (${count}/${settings.max_players_per_team})`);
    }
  }
  
  return errors;
}
