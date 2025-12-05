# TonicWater.io 🍸

The perfect gin & tonic pairing algorithm. A web application that helps you discover the ideal tonic water and garnish for your favorite gin.

## Features

- 🔍 Search through 50+ gin brands
- 🎯 Smart pairing algorithm with detailed reasoning
- ❤️ Save favorites (persisted in localStorage)
- 🕐 Recently viewed history
- 📤 Shareable pairing links
- 🍸 Cocktail recipe with ratios and glass recommendations
- 🎲 "Surprise Me" random selection
- 🌊 Mood-based discovery (Refreshing, Bold, Sweet, Herbal, Exotic)
- 🛒 Amazon links for tonic water
- 🎨 Beautiful glassmorphic UI with animated bubbles

## Tech Stack

### Frontend
- **Alpine.js** - Lightweight reactive framework
- **Tailwind CSS** - Utility-first styling
- **Custom CSS** - Glassmorphism effects and animations

### Backend (Cloudflare)
- **Cloudflare Pages** - Static site hosting with edge functions
- **Cloudflare Workers** - Serverless API endpoints
- **Durable Objects** - Persistent, globally distributed data storage

### Local Development
- **Node.js/Express** - Local development server
- **JSON file storage** - Local data persistence

---

## Deployment: Cloudflare Pages

### Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. Node.js 18+ installed
3. Wrangler CLI (`npm install -g wrangler`)

### Setup

1. **Clone and install dependencies:**
```bash
git clone <your-repo-url>
cd Tonicwater_io
npm install
```

2. **Login to Cloudflare:**
```bash
wrangler login
```

3. **Create a new Pages project:**
```bash
wrangler pages project create tonicwater-io
```

4. **Deploy:**
```bash
npm run deploy
```

### Cloudflare Dashboard Setup

After deploying, you need to configure the Durable Object binding:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → tonicwater-io
2. Click **Settings** → **Functions**
3. Under **Durable Object bindings**, add:
   - Variable name: `GIN_DATA`
   - Durable Object namespace: Create new → `GinDataDO`

4. Redeploy for changes to take effect:
```bash
npm run deploy
```

### Custom Domain (Optional)

1. In Cloudflare Dashboard → Pages → tonicwater-io → Custom domains
2. Add your domain (e.g., `tonicwater.io`)
3. Follow DNS configuration instructions

---

## Local Development

### Express Server (Recommended for quick testing)

```bash
npm install
npm start
# Visit http://localhost:3000
```

### With Nodemon (auto-reload)

```bash
npm run dev
```

### With Wrangler (simulates Cloudflare environment)

```bash
npm run dev:cf
# Visit http://localhost:8788
```

---

## Project Structure

```
Tonicwater_io/
├── public/
│   └── index.html          # Frontend SPA
├── functions/
│   ├── _middleware.ts      # CORS middleware
│   └── api/
│       ├── _gin-data.ts    # Durable Object class
│       ├── gins.ts         # GET/POST /api/gins
│       ├── gins/[name].ts  # GET /api/gins/:name
│       └── categories.ts   # GET /api/categories
├── server/
│   └── server.js           # Local Express server
├── data/
│   ├── gins.json           # Gin database (local)
│   └── tonic-links.json    # Amazon links mapping
├── wrangler.toml           # Cloudflare configuration
├── package.json
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gins` | Get all gins |
| GET | `/api/gins?search=query` | Search gins by name or profile |
| GET | `/api/gins/:name` | Get specific gin by name |
| GET | `/api/categories` | Get quick-select categories |
| POST | `/api/gins` | Add a new gin (requires body) |

### Example Response

```json
{
  "name": "Monkey 47",
  "profile": "Complex Herbal",
  "tonic": "Mediterranean Tonic",
  "garnish": "Sage leaf or Grapefruit zest",
  "why": "The herbal sage bridges the 47 distinct botanicals...",
  "amazonLink": "https://www.amazon.com/s?k=fever+tree+mediterranean+tonic"
}
```

---

## Adding New Gins

### Via API (Cloudflare)
```bash
curl -X POST https://tonicwater.io/api/gins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Gin",
    "profile": "Flavor Profile",
    "tonic": "Recommended Tonic",
    "garnish": "Garnish",
    "why": "Pairing explanation"
  }'
```

### Local Development
Edit `data/gins.json` directly and restart the server.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Local server port | `3000` |
| `ENVIRONMENT` | Deployment environment | `production` |

---

## License

MIT
