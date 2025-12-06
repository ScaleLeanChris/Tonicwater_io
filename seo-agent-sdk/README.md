# TonicWater.io SEO Agent (Claude Agent SDK)

An autonomous SEO content generation agent built with the Claude Agent SDK. This agent researches keywords, writes SEO-optimized articles, generates featured images, and manages article storage.

## Architecture

```
seo-agent-sdk/
├── CLAUDE.md                    # System prompt / agent instructions
├── .claude/
│   ├── settings.json            # MCP server configuration
│   └── skills/
│       └── seo-writing/         # SEO writing skill
│           └── SKILL.md
├── src/
│   ├── main.py                  # Main agent entry point
│   └── mcp_servers/
│       ├── dataseo_server.py    # DataForSEO keyword research
│       ├── imagen_server.py     # Imagen image generation
│       └── articles_server.py   # Article storage
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## MCP Servers

### DataForSEO Server
Provides keyword research capabilities:
- `search_keywords(keyword)` - Get search volume, competition, CPC
- `get_related_keywords(keyword)` - Find related keywords
- `get_trending_topics()` - Discover trending gin & tonic topics

### Imagen Server
Provides image generation:
- `generate_image(title, keyword)` - Generate featured images using Imagen 3
- `create_image_prompt(title, topic)` - Create optimized prompts

### Articles Server
Provides article storage:
- `save_article(...)` - Save articles with full SEO metadata
- `get_articles(status, limit)` - List articles
- `get_article(slug)` - Get single article
- `update_article_status(slug, status)` - Publish/unpublish
- `delete_article(slug)` - Remove article

## Setup

### Prerequisites
- Python 3.10+
- Claude API key
- Optional: DataForSEO credentials, Gemini API key

### Installation

```bash
# Clone and navigate to the SDK agent
cd seo-agent-sdk

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
# Edit .env with your API keys
```

### Running

```bash
# Interactive mode
python src/main.py

# Generate article for specific topic
python src/main.py --topic "best gin for gin and tonic"

# Batch mode with default topics
python src/main.py --batch

# Demo mode (shows structure without SDK)
python src/main.py --demo
```

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f seo-agent
```

## Comparison: Cloudflare Worker vs Claude Agent SDK

| Aspect | Cloudflare Worker | Agent SDK |
|--------|-------------------|-----------|
| Runtime | Edge serverless | Local/Cloud Python |
| Execution time | 30s (with DO alarms) | Unlimited |
| Tool integration | Custom API wrappers | MCP servers (standardized) |
| Context management | Manual | Automatic compaction |
| Deployment | Cloudflare | Docker, systemd, any host |
| Cost | Pay per request | Pay per Claude API call |
| Best for | High-traffic APIs | Complex agentic workflows |

## Migration from Cloudflare Worker

The original Cloudflare Worker (`seo-agent/`) remains functional for:
- Production API serving
- Cron-triggered daily generation
- Edge-deployed article delivery

This SDK version (`seo-agent-sdk/`) is designed for:
- Interactive article generation
- Complex multi-step workflows
- Local development and testing
- Batch processing

Both can coexist - the SDK version can be used locally while the Worker handles production traffic.
