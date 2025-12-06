// TonicWater SEO Agent - Autonomous Content Generator
// Uses Claude Agent SDK for SEO copywriting and Nano Banana for images

interface Env {
  ARTICLES: DurableObjectNamespace;
  ARTICLE_CACHE: KVNamespace;
  OPENROUTER_API_KEY: string;
  GEMINI_API_KEY: string;
  DATAFORSEO_LOGIN: string;
  DATAFORSEO_PASSWORD: string;
  ADMIN_PASSWORD: string;
  ENVIRONMENT: string;
}

// Environment needs to be passed to Durable Object
interface DOEnv {
  OPENROUTER_API_KEY: string;
  GEMINI_API_KEY: string;
}

interface Article {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  content: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  schemaMarkup: object;
  imageUrl: string;
  imageAlt: string;
  status: 'draft' | 'published';
  createdAt: string;
  publishedAt?: string;
}

interface GenerationTask {
  id: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  topic?: string;
  startedAt: string;
  completedAt?: string;
  articleId?: string;
  error?: string;
}

// ============================================
// Main Worker Export
// ============================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Public article routes
      if (url.pathname === '/api/articles' && request.method === 'GET') {
        return await handleGetArticles(env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/articles/') && request.method === 'GET') {
        const slug = url.pathname.replace('/api/articles/', '');
        return await handleGetArticle(env, slug, corsHeaders);
      }

      // Admin routes (password protected)
      if (url.pathname.startsWith('/admin')) {
        const authResult = await authenticateAdmin(request, env);
        if (!authResult.authenticated) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Admin dashboard
        if (url.pathname === '/admin' || url.pathname === '/admin/') {
          return new Response(getAdminDashboardHTML(), {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        // Trigger article generation
        if (url.pathname === '/admin/api/generate' && request.method === 'POST') {
          const body = await request.json() as { topic?: string };
          return await handleGenerateArticle(env, ctx, body.topic, corsHeaders);
        }

        // Get all articles (including drafts)
        if (url.pathname === '/admin/api/articles' && request.method === 'GET') {
          return await handleGetAllArticles(env, corsHeaders);
        }

        // Update article status
        if (url.pathname.startsWith('/admin/api/articles/') && request.method === 'PUT') {
          const id = url.pathname.replace('/admin/api/articles/', '');
          const body = await request.json() as Partial<Article>;
          return await handleUpdateArticle(env, id, body, corsHeaders);
        }

        // Delete article
        if (url.pathname.startsWith('/admin/api/articles/') && request.method === 'DELETE') {
          const id = url.pathname.replace('/admin/api/articles/', '');
          return await handleDeleteArticle(env, id, corsHeaders);
        }

        // Get generation status
        if (url.pathname === '/admin/api/status' && request.method === 'GET') {
          return await handleGetStatus(env, corsHeaders);
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  // Cron trigger for daily article generation
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron triggered: Starting daily article generation');
    ctx.waitUntil(generateDailyArticle(env));
  },
};

// ============================================
// Authentication
// ============================================
async function authenticateAdmin(request: Request, env: Env): Promise<{ authenticated: boolean }> {
  // Check for password in Authorization header (Basic auth) or query param
  const authHeader = request.headers.get('Authorization');
  const url = new URL(request.url);
  const queryPassword = url.searchParams.get('password');

  let password: string | null = null;

  if (authHeader?.startsWith('Basic ')) {
    const base64 = authHeader.slice(6);
    const decoded = atob(base64);
    password = decoded.split(':')[1] || decoded;
  } else if (authHeader?.startsWith('Bearer ')) {
    password = authHeader.slice(7);
  } else if (queryPassword) {
    password = queryPassword;
  }

  if (!password) {
    return { authenticated: false };
  }

  // Simple password comparison (in production, use hashed comparison)
  return { authenticated: password === env.ADMIN_PASSWORD };
}

// ============================================
// Article Handlers
// ============================================
async function handleGetArticles(env: Env, headers: Record<string, string>): Promise<Response> {
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);
  const response = await stub.fetch('http://internal/articles?status=published');
  const articles = await response.json();

  return new Response(JSON.stringify(articles), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleGetArticle(env: Env, slug: string, headers: Record<string, string>): Promise<Response> {
  // Try cache first
  const cached = await env.ARTICLE_CACHE.get(`article:${slug}`);
  if (cached) {
    return new Response(cached, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);
  const response = await stub.fetch(`http://internal/articles/${slug}`);

  if (response.status === 404) {
    return new Response(JSON.stringify({ error: 'Article not found' }), {
      status: 404,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const article = await response.text();

  // Cache for 5 minutes
  await env.ARTICLE_CACHE.put(`article:${slug}`, article, { expirationTtl: 300 });

  return new Response(article, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleGetAllArticles(env: Env, headers: Record<string, string>): Promise<Response> {
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);
  const response = await stub.fetch('http://internal/articles');
  const articles = await response.json();

  return new Response(JSON.stringify(articles), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleUpdateArticle(env: Env, articleId: string, updates: Partial<Article>, headers: Record<string, string>): Promise<Response> {
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);
  const response = await stub.fetch(`http://internal/articles/${articleId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  // Invalidate cache
  const article = await response.json() as Article;
  await env.ARTICLE_CACHE.delete(`article:${article.slug}`);

  return new Response(JSON.stringify(article), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleDeleteArticle(env: Env, articleId: string, headers: Record<string, string>): Promise<Response> {
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);

  // Get article first to invalidate cache
  const getResponse = await stub.fetch(`http://internal/articles/${articleId}`);
  if (getResponse.status === 200) {
    const article = await getResponse.json() as Article;
    await env.ARTICLE_CACHE.delete(`article:${article.slug}`);
  }

  await stub.fetch(`http://internal/articles/${articleId}`, { method: 'DELETE' });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function handleGetStatus(env: Env, headers: Record<string, string>): Promise<Response> {
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);
  const response = await stub.fetch('http://internal/status');
  const status = await response.json();

  return new Response(JSON.stringify(status), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// ============================================
// Article Generation (via Durable Object Alarm)
// ============================================
async function handleGenerateArticle(env: Env, ctx: ExecutionContext, topic: string | undefined, headers: Record<string, string>): Promise<Response> {
  // Start async generation via Durable Object alarm (longer execution time)
  const taskId = crypto.randomUUID();

  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);

  // Tell DO to start generation - it will use alarm for long-running task
  await stub.fetch('http://internal/start-generation', {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      topic,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      dataforseoLogin: env.DATAFORSEO_LOGIN,
      dataforseoPassword: env.DATAFORSEO_PASSWORD,
    }),
  });

  return new Response(JSON.stringify({ taskId, status: 'started' }), {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

async function generateDailyArticle(env: Env): Promise<void> {
  const taskId = crypto.randomUUID();
  const id = env.ARTICLES.idFromName('articles');
  const stub = env.ARTICLES.get(id);

  await stub.fetch('http://internal/start-generation', {
    method: 'POST',
    body: JSON.stringify({
      taskId,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      geminiApiKey: env.GEMINI_API_KEY,
      dataforseoLogin: env.DATAFORSEO_LOGIN,
      dataforseoPassword: env.DATAFORSEO_PASSWORD,
    }),
  });
}

// ============================================
// Claude Article Generation
// ============================================
interface ClaudeArticleResult {
  title: string;
  metaDescription: string;
  content: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  schemaMarkup: object;
}

async function generateArticleWithClaude(openrouterApiKey: string, topic?: string): Promise<ClaudeArticleResult> {
  const systemPrompt = `You are an expert SEO content writer for tonicwater.io, a premium gin and tonic pairing website.

Write a comprehensive 1500-2000 word article with:
- Engaging introduction with the primary keyword
- Multiple H2 sections with detailed content
- Specific product recommendations and pairing ratios
- Expert tips and sensory descriptions
- FAQ section with 3-4 questions at the end

CRITICAL JSON FORMAT: Return a single-line JSON object. Use \\n for ALL line breaks in the content field. Do NOT use actual newlines inside the JSON.

Example: {"title":"Your Title Here","metaDescription":"Compelling 150-160 char description with keyword","content":"# Main Heading\\n\\nIntro paragraph here...\\n\\n## First Section\\n\\nDetailed content...","primaryKeyword":"target keyword","secondaryKeywords":["related1","related2","related3","related4"],"schemaMarkup":{"@context":"https://schema.org","@type":"Article","headline":"Title","description":"Description"}}`;

  const userPrompt = topic
    ? `Write an SEO article about: ${topic}. Focus on gin and tonic pairing recommendations.`
    : `Write an SEO article about a gin and tonic topic. Pick something specific like a gin brand, tonic comparison, or seasonal recipe.`;

  // Use OpenRouter API (supports multiple models)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openrouterApiKey}`,
      'HTTP-Referer': 'https://tonicwater.io',
      'X-Title': 'TonicWater SEO Agent',
    },
    body: JSON.stringify({
      model: 'x-ai/grok-4.1-fast',  // Using Grok 4.1 Fast for article generation
      max_tokens: 8192,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  // OpenRouter uses OpenAI-compatible format
  const result = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const textContent = result.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('No text content in OpenRouter response');
  }

  // Parse JSON from response (handle markdown code blocks and extract JSON object)
  let jsonText = textContent.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  // Find the JSON object boundaries
  const startBrace = jsonText.indexOf('{');
  if (startBrace === -1) {
    throw new Error(`No JSON object found in response: ${jsonText.substring(0, 200)}...`);
  }

  // Find matching closing brace
  let depth = 0;
  let endBrace = -1;
  for (let i = startBrace; i < jsonText.length; i++) {
    if (jsonText[i] === '{') depth++;
    if (jsonText[i] === '}') depth--;
    if (depth === 0) {
      endBrace = i;
      break;
    }
  }

  if (endBrace === -1) {
    throw new Error(`Incomplete JSON object in response: ${jsonText.substring(0, 300)}...`);
  }

  jsonText = jsonText.substring(startBrace, endBrace + 1);

  try {
    return JSON.parse(jsonText) as ClaudeArticleResult;
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e}. Content: ${jsonText.substring(0, 300)}...`);
  }
}

// ============================================
// DataForSEO Keyword Research
// ============================================
interface KeywordData {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  relatedKeywords: string[];
}

interface DataForSEOCredentials {
  login: string;
  password: string;
}

async function researchKeywords(
  credentials: DataForSEOCredentials,
  seedKeyword: string
): Promise<KeywordData | null> {
  if (!credentials.login || !credentials.password) {
    console.log('DataForSEO credentials not configured, skipping keyword research');
    return null;
  }

  const authToken = btoa(`${credentials.login}:${credentials.password}`);

  try {
    // Use DataForSEO Keywords Data API - Google Ads Search Volume
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify([{
        keywords: [seedKeyword],
        location_code: 2840, // United States
        language_code: 'en',
      }]),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('DataForSEO API error:', error);
      return null;
    }

    const result = await response.json() as {
      tasks: Array<{
        result: Array<{
          keyword: string;
          search_volume: number;
          competition: number;
          cpc: number;
        }>;
      }>;
    };

    const keywordResult = result.tasks?.[0]?.result?.[0];
    if (!keywordResult) {
      console.log('No keyword data returned from DataForSEO');
      return null;
    }

    // Get related keywords using keyword suggestions
    const relatedResponse = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify([{
        keyword: seedKeyword,
        location_code: 2840,
        language_code: 'en',
        limit: 10,
      }]),
    });

    let relatedKeywords: string[] = [];
    if (relatedResponse.ok) {
      const relatedResult = await relatedResponse.json() as {
        tasks: Array<{
          result: Array<{
            items: Array<{
              keyword_data: { keyword: string };
            }>;
          }>;
        }>;
      };
      relatedKeywords = relatedResult.tasks?.[0]?.result?.[0]?.items
        ?.slice(0, 5)
        ?.map(item => item.keyword_data?.keyword)
        ?.filter(Boolean) || [];
    }

    return {
      keyword: keywordResult.keyword,
      searchVolume: keywordResult.search_volume || 0,
      competition: keywordResult.competition || 0,
      cpc: keywordResult.cpc || 0,
      relatedKeywords,
    };
  } catch (error) {
    console.error('DataForSEO request failed:', error);
    return null;
  }
}

// Get trending gin & tonic topics for article generation
async function getTrendingTopics(credentials: DataForSEOCredentials): Promise<string[]> {
  if (!credentials.login || !credentials.password) {
    return getDefaultTopics();
  }

  const authToken = btoa(`${credentials.login}:${credentials.password}`);

  try {
    // Use DataForSEO to find trending related keywords
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify([{
        keyword: 'gin and tonic',
        location_code: 2840,
        language_code: 'en',
        limit: 20,
        filters: [
          ['keyword_info.search_volume', '>', 100],
        ],
        order_by: ['keyword_info.search_volume,desc'],
      }]),
    });

    if (!response.ok) {
      console.error('DataForSEO trending topics error:', await response.text());
      return getDefaultTopics();
    }

    const result = await response.json() as {
      tasks: Array<{
        result: Array<{
          items: Array<{
            keyword: string;
            keyword_info: { search_volume: number };
          }>;
        }>;
      }>;
    };

    const topics = result.tasks?.[0]?.result?.[0]?.items
      ?.map(item => item.keyword)
      ?.filter(Boolean) || [];

    return topics.length > 0 ? topics : getDefaultTopics();
  } catch (error) {
    console.error('Failed to get trending topics:', error);
    return getDefaultTopics();
  }
}

function getDefaultTopics(): string[] {
  return [
    'best gin for gin and tonic',
    'fever tree tonic water review',
    'hendricks gin cocktails',
    'summer gin cocktails',
    'botanical gin guide',
    'gin and tonic garnishes',
    'premium tonic water comparison',
    'gin tasting notes',
    'craft gin brands',
    'gin cocktail recipes',
  ];
}

// ============================================
// Nano Banana (Gemini) Image Generation
// ============================================
interface ImageResult {
  imageUrl: string;
  imageAlt: string;
}

async function generateImageWithNanoBanana(geminiApiKey: string, title: string, keyword: string): Promise<ImageResult> {
  const imagePrompt = `A beautiful, professional photograph of a gin and tonic cocktail for an article titled "${title}".

The image should feature:
- An elegant crystal or highball glass with a perfectly mixed gin and tonic
- Visible ice cubes and bubbles from the tonic
- Appropriate botanical garnishes (citrus, herbs, berries) based on the gin style
- Soft, natural lighting with a sophisticated bar or home setting
- Shallow depth of field for professional look
- Color palette that evokes freshness and premium quality

Style: Editorial food photography, magazine quality, warm ambient lighting`;

  try {
    // Use Imagen 3 model for high-quality image generation
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        instances: [{
          prompt: imagePrompt,
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          personGeneration: 'dont_allow',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Imagen API error:', error);
      // Return placeholder if image generation fails
      return {
        imageUrl: '/images/default-gin-tonic.jpg',
        imageAlt: `${title} - Gin and Tonic Pairing`,
      };
    }

    const result = await response.json() as {
      predictions: Array<{
        bytesBase64Encoded: string;
        mimeType: string;
      }>;
    };

    const prediction = result.predictions?.[0];

    if (prediction?.bytesBase64Encoded) {
      // Store image as base64 data URL (in production, upload to R2 or similar)
      const mimeType = prediction.mimeType || 'image/png';
      const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
      return {
        imageUrl,
        imageAlt: `${title} - Premium Gin and Tonic Pairing Guide`,
      };
    }

    return {
      imageUrl: '/images/default-gin-tonic.jpg',
      imageAlt: `${title} - Gin and Tonic Pairing`,
    };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      imageUrl: '/images/default-gin-tonic.jpg',
      imageAlt: `${title} - Gin and Tonic Pairing`,
    };
  }
}

// ============================================
// Utility Functions
// ============================================
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ============================================
// Admin Dashboard HTML
// ============================================
function getAdminDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TonicWater.io - SEO Agent Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    .glass { background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); }
  </style>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
  <div x-data="adminApp()" x-init="init()" class="container mx-auto px-4 py-8">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
        TonicWater.io SEO Agent
      </h1>
      <p class="text-gray-400 mt-2">Autonomous content generation powered by Claude & Nano Banana</p>
    </header>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="glass rounded-xl p-6 border border-white/10">
        <div class="text-3xl font-bold text-emerald-400" x-text="stats.published"></div>
        <div class="text-gray-400">Published Articles</div>
      </div>
      <div class="glass rounded-xl p-6 border border-white/10">
        <div class="text-3xl font-bold text-yellow-400" x-text="stats.drafts"></div>
        <div class="text-gray-400">Drafts</div>
      </div>
      <div class="glass rounded-xl p-6 border border-white/10">
        <div class="text-3xl font-bold text-cyan-400" x-text="stats.totalWords"></div>
        <div class="text-gray-400">Total Words</div>
      </div>
      <div class="glass rounded-xl p-6 border border-white/10">
        <div class="text-3xl font-bold text-purple-400" x-text="currentTask?.status || 'Idle'"></div>
        <div class="text-gray-400">Agent Status</div>
      </div>
    </div>

    <!-- Generate New Article -->
    <div class="glass rounded-xl p-6 border border-white/10 mb-8">
      <h2 class="text-xl font-semibold mb-4">Generate New Article</h2>
      <div class="flex gap-4">
        <input
          type="text"
          x-model="newTopic"
          placeholder="Enter topic (optional - leave blank for AI to choose)"
          class="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-3 focus:outline-none focus:border-emerald-400"
        >
        <button
          @click="generateArticle()"
          :disabled="generating"
          class="bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
        >
          <span x-show="!generating">Generate Article</span>
          <span x-show="generating" class="flex items-center gap-2">
            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating...
          </span>
        </button>
      </div>
      <p class="text-gray-500 text-sm mt-2">The agent will use Claude to write SEO-optimized content and Nano Banana to generate a featured image.</p>
    </div>

    <!-- Articles List -->
    <div class="glass rounded-xl border border-white/10 overflow-hidden">
      <div class="p-6 border-b border-white/10">
        <h2 class="text-xl font-semibold">Articles</h2>
      </div>
      <div class="divide-y divide-white/10">
        <template x-for="article in articles" :key="article.id">
          <div class="p-6 hover:bg-white/5 transition-colors">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <h3 class="text-lg font-medium" x-text="article.title"></h3>
                  <span
                    class="px-2 py-1 rounded text-xs font-medium"
                    :class="article.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'"
                    x-text="article.status"
                  ></span>
                </div>
                <p class="text-gray-400 text-sm mb-2" x-text="article.metaDescription"></p>
                <div class="flex gap-4 text-sm text-gray-500">
                  <span>Keyword: <span class="text-cyan-400" x-text="article.primaryKeyword"></span></span>
                  <span x-text="new Date(article.createdAt).toLocaleDateString()"></span>
                </div>
              </div>
              <div class="flex gap-2 ml-4">
                <button
                  x-show="article.status === 'draft'"
                  @click="publishArticle(article.id)"
                  class="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Publish
                </button>
                <button
                  x-show="article.status === 'published'"
                  @click="unpublishArticle(article.id)"
                  class="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors"
                >
                  Unpublish
                </button>
                <button
                  @click="deleteArticle(article.id)"
                  class="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </template>
        <div x-show="articles.length === 0" class="p-12 text-center text-gray-500">
          No articles yet. Generate your first one above!
        </div>
      </div>
    </div>
  </div>

  <script>
    function adminApp() {
      return {
        articles: [],
        stats: { published: 0, drafts: 0, totalWords: 0 },
        currentTask: null,
        newTopic: '',
        generating: false,
        password: new URLSearchParams(window.location.search).get('password') || localStorage.getItem('adminPassword') || '',

        async init() {
          if (!this.password) {
            this.password = prompt('Enter admin password:');
            if (this.password) {
              localStorage.setItem('adminPassword', this.password);
            }
          }
          await this.loadArticles();
          await this.loadStatus();
          // Poll for status updates
          setInterval(() => this.loadStatus(), 5000);
        },

        async loadArticles() {
          try {
            const res = await fetch('/admin/api/articles', {
              headers: { 'Authorization': 'Bearer ' + this.password }
            });
            if (res.status === 401) {
              localStorage.removeItem('adminPassword');
              location.reload();
              return;
            }
            this.articles = await res.json();
            this.updateStats();
          } catch (e) {
            console.error('Failed to load articles:', e);
          }
        },

        async loadStatus() {
          try {
            const res = await fetch('/admin/api/status', {
              headers: { 'Authorization': 'Bearer ' + this.password }
            });
            const status = await res.json();
            this.currentTask = status.currentTask;
            if (this.generating && status.currentTask?.status === 'complete') {
              this.generating = false;
              await this.loadArticles();
            }
          } catch (e) {
            console.error('Failed to load status:', e);
          }
        },

        updateStats() {
          this.stats.published = this.articles.filter(a => a.status === 'published').length;
          this.stats.drafts = this.articles.filter(a => a.status === 'draft').length;
          this.stats.totalWords = this.articles.reduce((sum, a) => sum + (a.content?.split(/\\s+/).length || 0), 0);
        },

        async generateArticle() {
          this.generating = true;
          try {
            await fetch('/admin/api/generate', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + this.password,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ topic: this.newTopic || undefined })
            });
            this.newTopic = '';
          } catch (e) {
            console.error('Failed to start generation:', e);
            this.generating = false;
          }
        },

        async publishArticle(id) {
          await this.updateArticle(id, { status: 'published', publishedAt: new Date().toISOString() });
        },

        async unpublishArticle(id) {
          await this.updateArticle(id, { status: 'draft', publishedAt: null });
        },

        async updateArticle(id, updates) {
          try {
            await fetch('/admin/api/articles/' + id, {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + this.password,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updates)
            });
            await this.loadArticles();
          } catch (e) {
            console.error('Failed to update article:', e);
          }
        },

        async deleteArticle(id) {
          if (!confirm('Are you sure you want to delete this article?')) return;
          try {
            await fetch('/admin/api/articles/' + id, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + this.password }
            });
            await this.loadArticles();
          } catch (e) {
            console.error('Failed to delete article:', e);
          }
        }
      };
    }
  </script>
</body>
</html>`;
}

// ============================================
// Durable Object: Articles Storage with Alarm-based Generation
// ============================================

interface PendingGeneration {
  taskId: string;
  topic?: string;
  openrouterApiKey: string;
  geminiApiKey: string;
  dataforseoLogin?: string;
  dataforseoPassword?: string;
}

export class ArticlesDO implements DurableObject {
  private state: DurableObjectState;
  private articles: Map<string, Article> = new Map();
  private tasks: Map<string, GenerationTask> = new Map();
  private pendingGeneration: PendingGeneration | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Article[]>('articles');
      if (stored) {
        stored.forEach(a => this.articles.set(a.id, a));
      }
      const storedTasks = await this.state.storage.get<GenerationTask[]>('tasks');
      if (storedTasks) {
        storedTasks.forEach(t => this.tasks.set(t.id, t));
      }
      // Restore pending generation if any
      const pending = await this.state.storage.get<PendingGeneration>('pendingGeneration');
      if (pending) {
        this.pendingGeneration = pending;
      }
    });
  }

  // Alarm handler - runs with longer execution time (30s)
  async alarm(): Promise<void> {
    if (!this.pendingGeneration) {
      console.log('Alarm triggered but no pending generation');
      return;
    }

    const { taskId, topic, openrouterApiKey, geminiApiKey, dataforseoLogin, dataforseoPassword } = this.pendingGeneration;
    console.log(`Alarm: Starting article generation for task ${taskId}`);

    try {
      // Update status to generating
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'generating';
        this.tasks.set(taskId, task);
        await this.state.storage.put('tasks', Array.from(this.tasks.values()));
      }

      // Determine topic using DataForSEO if no topic provided
      let articleTopic = topic;
      const credentials: DataForSEOCredentials = {
        login: dataforseoLogin || '',
        password: dataforseoPassword || '',
      };

      if (!articleTopic) {
        console.log('No topic provided, using DataForSEO for topic discovery...');
        const trendingTopics = await getTrendingTopics(credentials);
        // Pick a random topic from the list to add variety
        articleTopic = trendingTopics[Math.floor(Math.random() * trendingTopics.length)];
        console.log(`Selected topic from DataForSEO: ${articleTopic}`);
      }

      // Research keywords for better SEO (if DataForSEO is configured)
      const keywordData = await researchKeywords(credentials, articleTopic);
      if (keywordData) {
        console.log(`Keyword data: volume=${keywordData.searchVolume}, competition=${keywordData.competition}, cpc=$${keywordData.cpc}`);
        console.log(`Related keywords: ${keywordData.relatedKeywords.join(', ')}`);
      }

      // Generate article with Grok (this can take 20-30 seconds)
      const articleContent = await generateArticleWithClaude(openrouterApiKey, articleTopic);

      // Generate image with Nano Banana (Gemini)
      console.log('Generating image with Nano Banana...');
      const imageResult = await generateImageWithNanoBanana(geminiApiKey, articleContent.title, articleContent.primaryKeyword);
      console.log('Image generated:', imageResult.imageUrl.substring(0, 50) + '...');

      // Create the article (auto-publish)
      const now = new Date().toISOString();
      const article: Article = {
        id: crypto.randomUUID(),
        slug: slugify(articleContent.title),
        title: articleContent.title,
        metaDescription: articleContent.metaDescription,
        content: articleContent.content,
        primaryKeyword: articleContent.primaryKeyword,
        secondaryKeywords: articleContent.secondaryKeywords,
        schemaMarkup: articleContent.schemaMarkup,
        imageUrl: imageResult.imageUrl,
        imageAlt: imageResult.imageAlt,
        status: 'published',
        createdAt: now,
        publishedAt: now,
      };

      // Save article
      this.articles.set(article.id, article);
      await this.state.storage.put('articles', Array.from(this.articles.values()));

      // Update task as complete
      if (task) {
        task.status = 'complete';
        task.completedAt = new Date().toISOString();
        task.articleId = article.id;
        this.tasks.set(taskId, task);
        await this.state.storage.put('tasks', Array.from(this.tasks.values()));
      }

      console.log(`Article generated successfully: ${article.title}`);
    } catch (error) {
      console.error('Article generation failed:', error);
      const task = this.tasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Unknown error';
        this.tasks.set(taskId, task);
        await this.state.storage.put('tasks', Array.from(this.tasks.values()));
      }
    } finally {
      // Clear pending generation
      this.pendingGeneration = null;
      await this.state.storage.delete('pendingGeneration');
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /start-generation - trigger alarm-based generation
    if (path === '/start-generation' && request.method === 'POST') {
      const body = await request.json() as {
        taskId: string;
        topic?: string;
        openrouterApiKey: string;
        geminiApiKey: string;
        dataforseoLogin?: string;
        dataforseoPassword?: string;
      };

      // Create task record
      const task: GenerationTask = {
        id: body.taskId,
        status: 'pending',
        topic: body.topic,
        startedAt: new Date().toISOString(),
      };
      this.tasks.set(task.id, task);
      await this.state.storage.put('tasks', Array.from(this.tasks.values()));

      // Store pending generation
      this.pendingGeneration = {
        taskId: body.taskId,
        topic: body.topic,
        openrouterApiKey: body.openrouterApiKey,
        geminiApiKey: body.geminiApiKey,
        dataforseoLogin: body.dataforseoLogin,
        dataforseoPassword: body.dataforseoPassword,
      };
      await this.state.storage.put('pendingGeneration', this.pendingGeneration);

      // Schedule alarm to run immediately (100ms from now)
      await this.state.storage.setAlarm(Date.now() + 100);

      console.log(`Scheduled article generation alarm for task ${body.taskId}`);
      return new Response(JSON.stringify({ success: true, taskId: body.taskId }));
    }

    // GET /articles - list all or filtered by status
    if (path === '/articles' && request.method === 'GET') {
      const status = url.searchParams.get('status');
      let articles = Array.from(this.articles.values());
      if (status) {
        articles = articles.filter(a => a.status === status);
      }
      articles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return new Response(JSON.stringify(articles));
    }

    // POST /articles - create new article
    if (path === '/articles' && request.method === 'POST') {
      const article = await request.json() as Article;
      this.articles.set(article.id, article);
      await this.state.storage.put('articles', Array.from(this.articles.values()));
      return new Response(JSON.stringify(article));
    }

    // GET /articles/:idOrSlug - get single article
    if (path.startsWith('/articles/') && request.method === 'GET') {
      const idOrSlug = path.replace('/articles/', '');
      let article = this.articles.get(idOrSlug);
      if (!article) {
        article = Array.from(this.articles.values()).find(a => a.slug === idOrSlug);
      }
      if (!article) {
        return new Response('Not found', { status: 404 });
      }
      return new Response(JSON.stringify(article));
    }

    // PUT /articles/:id - update article
    if (path.startsWith('/articles/') && request.method === 'PUT') {
      const id = path.replace('/articles/', '');
      const article = this.articles.get(id);
      if (!article) {
        return new Response('Not found', { status: 404 });
      }
      const updates = await request.json() as Partial<Article>;
      const updated = { ...article, ...updates };
      this.articles.set(id, updated);
      await this.state.storage.put('articles', Array.from(this.articles.values()));
      return new Response(JSON.stringify(updated));
    }

    // DELETE /articles/:id - delete article
    if (path.startsWith('/articles/') && request.method === 'DELETE') {
      const id = path.replace('/articles/', '');
      this.articles.delete(id);
      await this.state.storage.put('articles', Array.from(this.articles.values()));
      return new Response(JSON.stringify({ success: true }));
    }

    // POST /tasks - create task
    if (path === '/tasks' && request.method === 'POST') {
      const task = await request.json() as GenerationTask;
      this.tasks.set(task.id, task);
      await this.state.storage.put('tasks', Array.from(this.tasks.values()));
      return new Response(JSON.stringify(task));
    }

    // PUT /tasks/:id - update task
    if (path.startsWith('/tasks/') && request.method === 'PUT') {
      const id = path.replace('/tasks/', '');
      const task = this.tasks.get(id);
      if (!task) {
        return new Response('Not found', { status: 404 });
      }
      const updates = await request.json() as Partial<GenerationTask>;
      const updated = { ...task, ...updates };
      this.tasks.set(id, updated);
      await this.state.storage.put('tasks', Array.from(this.tasks.values()));
      return new Response(JSON.stringify(updated));
    }

    // GET /status - get current generation status
    if (path === '/status' && request.method === 'GET') {
      const tasks = Array.from(this.tasks.values())
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      const currentTask = tasks.find(t => t.status === 'generating' || t.status === 'pending');
      return new Response(JSON.stringify({
        currentTask,
        recentTasks: tasks.slice(0, 10),
        articleCount: this.articles.size,
      }));
    }

    return new Response('Not found', { status: 404 });
  }
}
