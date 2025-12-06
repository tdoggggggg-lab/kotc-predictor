# 👑 King of the Court Predictor

A DraftKings NBA PRA prediction model for the "King of the Court" contest.

## What is King of the Court?

Every Tuesday during NBA season, DraftKings runs a contest where the player with the highest combined Points + Rebounds + Assists (PRA) across ALL NBA games wins. If you placed a $5+ bet on that player, you share in a $1M prize pool!

## Features

- **Real-Time Data** - Fetches live games, odds, and player stats from ESPN API
- **Two Prediction Models**:
  - **V1**: Weighted scoring (5 factors)
  - **V2**: ML-based with sigmoid transformations and interaction terms
- **Date Picker** - Check predictions for upcoming Tuesdays 📅
- **Player Comparison** - Compare up to 3 players side-by-side ⚖️
- **Refresh Button** - Update data without page reload 🔄
- **Historical Tracker** - See all past KOTC winners and model accuracy
- **Backtesting** - Test model against historical results
- **Automatic Fallback** - Uses curated mock data when APIs unavailable

## Data Sources

| Source | Data Provided | Status |
|--------|---------------|--------|
| ESPN Scoreboard API | Games, times, venues | ✅ Live |
| ESPN Odds API | Spreads, O/U, moneylines | ✅ Live |
| ESPN Team Roster API | Player rosters | ✅ Live |
| ESPN Athlete API | Season stats | ✅ Live |

## Deploy to Vercel

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/kotc-predictor)

### Option 2: Manual Deploy

1. **Unzip the project**
```bash
unzip kotc-predictor.zip
cd kotc-predictor
```

2. **Install dependencies**
```bash
npm install
```

3. **Run locally**
```bash
npm run dev
```

4. **Deploy to Vercel**
```bash
npx vercel --prod
```

## API Endpoints

### GET /api/predictions

Returns predictions for today's games.

**Query Parameters:**
- `date` - Date in YYYY-MM-DD format (default: today)
- `mock` - Set to `true` to force mock data

**Response:**
```json
{
  "generated_at": "2024-12-06T12:00:00Z",
  "game_date": "2024-12-06",
  "num_games": 5,
  "num_players": 45,
  "using_mock_data": false,
  "data_source": "ESPN API",
  "games": [...],
  "predictions": [...]
}
```

### GET /api/backtest

Runs the model against historical King of the Court winners.

**Response:**
```json
{
  "success": true,
  "summary": {
    "dates_tested": 7,
    "winner_hit_rate": 28.6,
    "top_3_hit_rate": 57.1,
    "top_5_hit_rate": 85.7,
    "avg_winner_rank": 3.2
  },
  "report": "..."
}
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **ESPN API** - Real-time NBA data (no auth required)

## Model Details

### Model V1 (Weighted Scoring)
The original model calculates a "Ceiling Score" (0-100) for each player:

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| Recent PRA | 30% | Last 10 game weighted average |
| Ceiling | 25% | Max PRA potential + triple-double history |
| Volume | 20% | Usage rate + minutes played |
| Matchup | 15% | Spread as proxy for game script |
| Environment | 10% | Over/under, blowout risk |

### Model V2 (ML-Based) 🆕
An advanced model using machine learning principles:

| Feature Category | Weight | Components |
|------------------|--------|------------|
| Player Skill | 40% | PRA avg, ceiling, TD potential, consistency |
| Usage Metrics | 25% | Usage rate, minutes, touches proxy |
| Game Context | 25% | Total, spread, home advantage, pace |
| Trends | 10% | Recent form, hot streak |

**V2 Improvements:**
- Non-linear sigmoid transformations for feature scoring
- Interaction terms (e.g., high usage + close game = boost)
- Calibrated probability outputs
- Smarter handling of game context

## Historical Winners

Typical winning PRA: **52-64 points**
- Luka Dončić (64 PRA) - Opening night 2024
- Anthony Edwards (53 PRA) - December 2024

## Project Structure

```
kotc-predictor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── predictions/route.ts  # Predictions API (V1 & V2)
│   │   │   └── backtest/route.ts     # Backtest API
│   │   ├── history/page.tsx          # Historical results page
│   │   ├── page.tsx                  # Main UI
│   │   ├── layout.tsx                # Root layout
│   │   └── globals.css               # Styles
│   └── lib/
│       ├── espn-data.ts              # ESPN data fetching
│       ├── prediction-model.ts       # V1 scoring algorithm
│       ├── ml-model-v2.ts            # V2 ML model
│       ├── backtest.ts               # Historical backtesting
│       └── historical-data.ts        # KOTC winner history
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Future Enhancements

- [x] ~~XGBoost ML model~~ ✅ V2 ML Model Complete
- [x] ~~Backtesting module~~ ✅ Complete
- [x] ~~Historical accuracy tracker~~ ✅ Complete
- [ ] Real XGBoost training with scraped historical data
- [ ] Injury data integration (RotoWire, CBS Sports)
- [ ] Player comparison tool
- [ ] Email/SMS alerts for top picks
- [ ] Confidence intervals on predictions

---

Built for DraftKings King of the Court 🏀👑
