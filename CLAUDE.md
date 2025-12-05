# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TonicWater.io is a full-stack web application that provides gin and tonic pairing recommendations. The application uses a database of 50+ gins with their optimal tonic water, garnish, and detailed reasoning for each pairing.

## Architecture

This is a **Node.js/Express backend with Alpine.js frontend**:

- **Backend**: Express.js REST API serving gin data from JSON database
- **Frontend**: Alpine.js for reactive UI, Tailwind CSS for styling
- **Data Storage**: JSON file-based database ([data/gins.json](data/gins.json))
- **Fonts**: JetBrains Mono (monospace) and Space Grotesk (headers)

## Development Commands

Install dependencies:
```bash
npm install
```

Start production server:
```bash
npm start
```

Start development server with auto-reload:
```bash
npm run dev
```

Access the application at `http://localhost:3000`

## Project Structure

```
Tonicwater_io/
├── server/
│   └── server.js          # Express API server
├── public/
│   └── index.html         # Frontend SPA
├── data/
│   └── gins.json          # Gin pairing database
├── package.json
└── README.md
```

## Backend API ([server/server.js](server/server.js))

The Express server provides three endpoints:

- `GET /api/gins?search=query` - Returns all gins or filtered results
- `GET /api/gins/:name` - Returns specific gin by exact name
- `GET /api/categories` - Returns quick-search category list

The server loads gin data at startup from [data/gins.json](data/gins.json) and caches it in memory.

## Frontend Structure ([public/index.html](public/index.html))

The Alpine.js `tonicApp()` component manages all application state:

**State Properties**:
- `search`: Current search query
- `selected`: Currently displayed gin object
- `filteredGins`: Search results from API
- `categories`: Quick-select categories
- `loading`: API request state
- `error`: Error message display

**Methods**:
- `init()`: Loads categories from API on mount
- `handleSearch()`: Fetches filtered gins from `/api/gins?search=`
- `selectGin(gin)`: Sets selected gin and scrolls to top
- `reset()`: Clears all state

## Data Model ([data/gins.json](data/gins.json))

Each gin object has this exact structure:

```json
{
  "name": "Monkey 47",
  "profile": "Complex Herbal",
  "tonic": "Mediterranean Tonic",
  "garnish": "Sage leaf or Grapefruit zest",
  "why": "The herbal sage bridges the 47 distinct botanicals..."
}
```

## Visual Design System

**Color Palette**:
- Primary: Cyan (`#00f3ff`)
- Accent: Pink (`#ff006e`)
- Background: Dark gradient (`#050510` to `#0a0a2e`)

**Key Effects**:
- **Glassmorphism**: `.glass-panel` and `.glass-card` classes with backdrop-filter blur
- **Animated Bubbles**: 40 SVG circles with staggered rise animations
- **Glow Effects**: Text shadows and border glows on interactive elements
- **Gradient Text**: Cyan-to-pink gradient on logo accent

## Adding New Gins

1. Edit [data/gins.json](data/gins.json)
2. Add new object with all 5 required fields
3. Restart server (`npm start`)
4. Search filters work on both `name` and `profile` fields
