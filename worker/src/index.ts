// TonicWater API Worker with Durable Objects and KV Cache

export interface Env {
  GIN_DATA: DurableObjectNamespace;
  GIN_CACHE: KVNamespace;
  ENVIRONMENT: string;
}

// Main Worker Entry Point
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Route to appropriate handler
      if (path === '/api/gins' || path.startsWith('/api/gins/')) {
        response = await handleGins(request, env, url);
      } else if (path === '/api/categories') {
        response = await handleCategories(env);
      } else if (path === '/api/health') {
        response = Response.json({ status: 'ok', environment: env.ENVIRONMENT });
      } else {
        response = Response.json({ error: 'Not found' }, { status: 404 });
      }

      // Add CORS headers to response
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    } catch (error) {
      console.error('Worker error:', error);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

// Handle /api/gins routes
async function handleGins(request: Request, env: Env, url: URL): Promise<Response> {
  const id = env.GIN_DATA.idFromName('gin-database');
  const stub = env.GIN_DATA.get(id);

  // Check KV cache for GET requests
  if (request.method === 'GET') {
    const cacheKey = `gins:${url.pathname}${url.search}`;
    const cached = await env.GIN_CACHE.get(cacheKey);

    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    // Forward to Durable Object
    const response = await stub.fetch(request);
    const data = await response.text();

    // Cache the response for 5 minutes
    await env.GIN_CACHE.put(cacheKey, data, { expirationTtl: 300 });

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  }

  // For mutations, invalidate cache and forward to DO
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    // Invalidate all gin cache entries
    const list = await env.GIN_CACHE.list({ prefix: 'gins:' });
    await Promise.all(list.keys.map((key) => env.GIN_CACHE.delete(key.name)));
  }

  return stub.fetch(request);
}

// Handle /api/categories
async function handleCategories(env: Env): Promise<Response> {
  const cacheKey = 'categories';
  const cached = await env.GIN_CACHE.get(cacheKey);

  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
    });
  }

  const categories = ['Citrus', 'Floral', 'Spicy', 'Dry'];
  const data = JSON.stringify(categories);

  await env.GIN_CACHE.put(cacheKey, data, { expirationTtl: 3600 });

  return new Response(data, {
    headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
  });
}

// Durable Object Class
export class GinDataDO implements DurableObject {
  private state: DurableObjectState;
  private ginsData: GinPairing[] = [];
  private tonicLinks: Record<string, string> = {};
  private initialized = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async initialize() {
    if (this.initialized) return;

    const storedGins = await this.state.storage.get<GinPairing[]>('gins');
    const storedLinks = await this.state.storage.get<Record<string, string>>('tonicLinks');

    if (storedGins && storedLinks) {
      this.ginsData = storedGins;
      this.tonicLinks = storedLinks;
    } else {
      this.ginsData = DEFAULT_GINS;
      this.tonicLinks = DEFAULT_TONIC_LINKS;
      await this.state.storage.put('gins', this.ginsData);
      await this.state.storage.put('tonicLinks', this.tonicLinks);
    }

    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/gins
    if (path === '/api/gins' && request.method === 'GET') {
      const search = url.searchParams.get('search');
      let results = this.ginsData;

      if (search) {
        const searchLower = search.toLowerCase();
        results = this.ginsData.filter(
          (gin) =>
            gin.name.toLowerCase().includes(searchLower) ||
            gin.profile.toLowerCase().includes(searchLower)
        );
      }

      return Response.json(results.map((gin) => this.addAmazonLink(gin)));
    }

    // GET /api/gins/:name
    if (path.startsWith('/api/gins/') && request.method === 'GET') {
      const name = decodeURIComponent(path.replace('/api/gins/', ''));
      const gin = this.ginsData.find(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      );

      if (!gin) {
        return Response.json({ error: 'Gin not found' }, { status: 404 });
      }

      return Response.json(this.addAmazonLink(gin));
    }

    // POST /api/gins - Add new gin
    if (path === '/api/gins' && request.method === 'POST') {
      const newGin = (await request.json()) as GinPairing;

      if (!newGin.name || !newGin.profile || !newGin.tonic || !newGin.garnish || !newGin.why) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Check for duplicate
      if (this.ginsData.some((g) => g.name.toLowerCase() === newGin.name.toLowerCase())) {
        return Response.json({ error: 'Gin already exists' }, { status: 409 });
      }

      this.ginsData.push(newGin);
      await this.state.storage.put('gins', this.ginsData);

      return Response.json({ success: true, gin: this.addAmazonLink(newGin) }, { status: 201 });
    }

    // PUT /api/gins/:name - Update gin
    if (path.startsWith('/api/gins/') && request.method === 'PUT') {
      const name = decodeURIComponent(path.replace('/api/gins/', ''));
      const index = this.ginsData.findIndex(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      );

      if (index === -1) {
        return Response.json({ error: 'Gin not found' }, { status: 404 });
      }

      const updates = (await request.json()) as Partial<GinPairing>;
      this.ginsData[index] = { ...this.ginsData[index], ...updates };
      await this.state.storage.put('gins', this.ginsData);

      return Response.json({ success: true, gin: this.addAmazonLink(this.ginsData[index]) });
    }

    // DELETE /api/gins/:name - Delete gin
    if (path.startsWith('/api/gins/') && request.method === 'DELETE') {
      const name = decodeURIComponent(path.replace('/api/gins/', ''));
      const index = this.ginsData.findIndex(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      );

      if (index === -1) {
        return Response.json({ error: 'Gin not found' }, { status: 404 });
      }

      const deleted = this.ginsData.splice(index, 1)[0];
      await this.state.storage.put('gins', this.ginsData);

      return Response.json({ success: true, deleted: deleted.name });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  private addAmazonLink(gin: GinPairing): GinPairing & { amazonLink: string } {
    return {
      ...gin,
      amazonLink:
        this.tonicLinks[gin.tonic] ||
        `https://www.amazon.com/s?k=${encodeURIComponent(gin.tonic)}`,
    };
  }
}

// Types
interface GinPairing {
  name: string;
  profile: string;
  tonic: string;
  garnish: string;
  why: string;
}

// Default Data
const DEFAULT_TONIC_LINKS: Record<string, string> = {
  'Mediterranean Tonic': 'https://www.amazon.com/s?k=fever+tree+mediterranean+tonic',
  'Elderflower Tonic': 'https://www.amazon.com/s?k=fever+tree+elderflower+tonic',
  'Premium Indian Tonic': 'https://www.amazon.com/s?k=fever+tree+premium+indian+tonic',
  'Indian Tonic': 'https://www.amazon.com/s?k=fever+tree+indian+tonic+water',
  'Light Tonic': 'https://www.amazon.com/s?k=fever+tree+light+tonic',
  'Aromatic Tonic': 'https://www.amazon.com/s?k=fever+tree+aromatic+tonic',
  'Ginger Ale': 'https://www.amazon.com/s?k=fever+tree+ginger+ale',
  'Lemon Tonic': 'https://www.amazon.com/s?k=fever+tree+lemon+tonic',
};

const DEFAULT_GINS: GinPairing[] = [
  { name: 'Monkey 47', profile: 'Complex Herbal', tonic: 'Mediterranean Tonic', garnish: 'Sage leaf or Grapefruit zest', why: 'The herbal sage bridges the 47 distinct botanicals without overpowering the woody, grassy notes.' },
  { name: "Hendrick's", profile: 'Cucumber & Rose', tonic: 'Elderflower Tonic', garnish: 'Cucumber ribbon', why: 'Enhances the signature cucumber infusion and bridges the floral rose notes.' },
  { name: 'The Botanist', profile: 'Floral Islay', tonic: 'Premium Indian Tonic', garnish: 'Thyme sprig & Lemon peel', why: 'A clean tonic allows the 22 foraged Islay herbs to shine; thyme highlights the savory undercurrents.' },
  { name: 'Tanqueray No. Ten', profile: 'Fresh Citrus Heart', tonic: 'Mediterranean Tonic', garnish: 'Pink Grapefruit slice', why: 'Unlike standard Tanqueray, No. Ten uses whole fresh fruits. Mediterranean tonic reduces bitterness and emphasizes the citrus.' },
  { name: 'Roku Gin', profile: 'Japanese Yuzu & Sakura', tonic: 'Light Tonic', garnish: 'Ginger slice', why: 'The delicate sakura and tea notes are easily drowned by heavy quinine; a lighter tonic preserves the Japanese craftsmanship.' },
  { name: 'Bombay Sapphire', profile: 'Light Spiced', tonic: 'Aromatic Tonic', garnish: 'Lime wedge & Mint', why: 'The peppery notes of grains of paradise pair well with the angostura bark in aromatic tonics.' },
  { name: 'Gin Mare', profile: 'Mediterranean Savory', tonic: 'Mediterranean Tonic', garnish: 'Rosemary sprig & Olive', why: 'Ideally paired with savory herbs to match its basil, thyme, and arbequina olive distillation.' },
  { name: 'Empress 1908', profile: 'Color Changing', tonic: 'Elderflower Tonic', garnish: 'Grapefruit slice', why: 'The butterfly pea blossom is earthy; elderflower adds sweetness while the acid from grapefruit triggers the color change.' },
  { name: 'Malfy Con Limone', profile: 'Zesty Italian Lemon', tonic: 'Mediterranean Tonic', garnish: 'Fresh Basil & Lemon', why: "A 'lemon on lemon' approach tastes like lemonade; basil adds a sophisticated Italian herbal twist." },
  { name: 'Drumshanbo Gunpowder', profile: 'Spiced Tea', tonic: 'Premium Indian Tonic', garnish: 'Red Grapefruit wedge', why: 'The gunpowder tea finish is dry; grapefruit brings out the bitterness while sweetening the citrus mid-palate.' },
  { name: 'Opihr Oriental Spiced', profile: 'Heavy Spice', tonic: 'Ginger Ale', garnish: 'Orange peel & Chili', why: 'A very bold gin; ginger enhances the cubeb and cardamom spice profile better than bitter tonic.' },
  { name: 'Plymouth Gin', profile: 'Earthy & Sweet', tonic: 'Aromatic Tonic', garnish: 'Lemon twist', why: 'Plymouth has a distinct earthy rootiness that stands up well to the bitters in aromatic tonic.' },
  { name: 'Sipsmith London Dry', profile: 'Classic Juniper', tonic: 'Indian Tonic', garnish: 'Lime wedge', why: 'The quintessential G&T. A dry, quinine-heavy tonic matches the bold juniper punch.' },
  { name: 'Beefeater 24', profile: 'Tea & Citrus', tonic: 'Mediterranean Tonic', garnish: 'Grapefruit wedge', why: 'The Japanese Sencha tea blend pairs beautifully with the lower bitterness of Mediterranean tonic.' },
  { name: 'Aviation', profile: 'Lavender', tonic: 'Elderflower Tonic', garnish: 'Orange peel', why: 'Suppresses the juniper to let the sarsaparilla and lavender notes float to the top.' },
  { name: 'Nordés', profile: 'Vinous & Floral', tonic: 'Mediterranean Tonic', garnish: 'White Grapes', why: 'Made with an Albariño wine base; grapes highlight the wine notes rather than clashing citrus.' },
  { name: 'Ki No Bi', profile: 'Kyoto Dry', tonic: 'Light Tonic', garnish: 'Yuzu peel', why: 'An incredibly delicate spirit with hinoki wood chips; requires a light touch to not mask the woody flavors.' },
  { name: 'Barr Hill', profile: 'Raw Honey', tonic: 'Lemon Tonic', garnish: 'Lemon wheel', why: 'The gin is distilled with raw honey; the acidity of a lemon tonic cuts through the viscosity and sweetness.' },
  { name: 'St. George Terroir', profile: 'Forest Floor', tonic: 'Indian Tonic', garnish: 'Sage & Bay Leaf', why: 'Tastes like a pine forest; herbal garnishes reinforce the Douglas Fir distillation.' },
  { name: 'Four Pillars Rare Dry', profile: 'Australian Spiced', tonic: 'Mediterranean Tonic', garnish: 'Orange slice', why: 'Uses whole oranges in distillation; the tonic complements the Tasmanian pepperberry spice.' },
  { name: "Ford's Gin", profile: 'Versatile Dry', tonic: 'Indian Tonic', garnish: 'Lemon & Lime', why: 'Designed specifically for mixing; a classic dual-citrus garnish hits the high and low notes.' },
  { name: 'Citadelle', profile: 'French Floral', tonic: 'Indian Tonic', garnish: 'Cinnamon stick', why: 'Has 19 botanicals including violet; cinnamon brings out the baking spice undertones.' },
  { name: 'Ungava', profile: 'Arctic Tundra', tonic: 'Indian Tonic', garnish: 'Grapefruit wedge', why: 'Uses wild rose hips and cloudberry; grapefruit tartness balances the unique tea-like tannins.' },
  { name: "Bobby's Schiedam", profile: 'Indonesian Spice', tonic: 'Indian Tonic', garnish: 'Orange & Cloves', why: "Heavily influenced by clove and lemongrass; the garnish mimics the gin's signature flavor profile." },
  { name: 'Silent Pool', profile: 'Floral Honey', tonic: 'Elderflower Tonic', garnish: 'Orange peel', why: 'Chamomile and local honey notes are amplified by the floral sweetness of elderflower tonic.' },
  { name: 'Brockmans', profile: 'Dark Berry', tonic: 'Ginger Ale', garnish: 'Blackberries', why: 'More like a fruit spirit; berries enhance the blueberry/blackberry infusion.' },
  { name: 'No. 3 London Dry', profile: 'Crisp Pine', tonic: 'Indian Tonic', garnish: 'Grapefruit slice', why: 'Voted best gin in the world multiple times; grapefruit matches the 3 fruit and 3 spice balance.' },
  { name: "Martin Miller's", profile: 'Cucumber Fresh', tonic: 'Elderflower Tonic', garnish: 'Strawberry & Pepper', why: 'Blended with Icelandic water; strawberry brings out the melon-like cucumber notes.' },
  { name: 'Kyrö Napue', profile: 'Rye & Cranberry', tonic: 'Indian Tonic', garnish: 'Cranberries & Rosemary', why: 'A Finnish rye gin; cranberries highlight the tart, meadowsweet botanicals.' },
  { name: 'Hernö', profile: 'Swedish Floral', tonic: 'Indian Tonic', garnish: 'Lemon zest & Pepper', why: 'Winner of many awards; the pepper adds a bite to the incredibly smooth, floral palette.' },
  { name: 'Brooklyn Gin', profile: 'Hand-cracked Citrus', tonic: 'Indian Tonic', garnish: 'Lime wheel', why: 'Uses fresh hand-cracked citrus peels; simple lime maintains the fresh, zesty integrity.' },
  { name: 'Cotswolds Dry', profile: 'Lavender & Bay', tonic: 'Indian Tonic', garnish: 'Grapefruit & Bay leaf', why: 'Non-chill filtered (cloudy); bay leaf pulls out the savory middle notes.' },
  { name: 'Nikka Coffey Gin', profile: 'Sansho & Yuzu', tonic: 'Indian Tonic', garnish: 'Apple slice', why: 'Distilled in Coffey stills; apple highlights the fruity esters of the unique distillation process.' },
  { name: 'Scapegrace Black', profile: 'Berry & Earth', tonic: 'Indian Tonic', garnish: 'Green Apple slice', why: 'Naturally black gin that turns purple; apple provides a crisp contrast to the aronia berry sweetness.' },
  { name: 'Gray Whale', profile: 'Coastal Saline', tonic: 'Mediterranean Tonic', garnish: 'Lime & Mint', why: 'Contains sea kelp and almonds; mint freshens the saline, coastal profile.' },
  { name: 'Isle of Harris', profile: 'Sugar Kelp', tonic: 'Indian Tonic', garnish: 'Red Grapefruit', why: 'Infused with sugar kelp; grapefruit acidity cuts through the subtle maritime sweetness.' },
  { name: "Hayman's Old Tom", profile: 'Sweet Victorian', tonic: 'Lemon Tonic', garnish: 'Lemon peel', why: 'Old Tom style is sweeter than London Dry; lemon tonic balances the sugar with acid.' },
  { name: 'Bols Genever', profile: 'Malty', tonic: 'Ginger Ale', garnish: 'Orange slice', why: 'The precursor to gin (whiskey-like); pairs better with ginger than quinine.' },
  { name: 'Glendalough Rose', profile: 'Fresh Rose', tonic: 'Elderflower Tonic', garnish: 'Lime wedge', why: 'Distilled with fresh rose petals; elderflower creates a bouquet in a glass.' },
  { name: 'Malfy Gin Rosa', profile: 'Pink Grapefruit', tonic: 'Mediterranean Tonic', garnish: 'Rosemary', why: 'Explosion of grapefruit; rosemary adds the necessary savory constraint to prevent it tasting like juice.' },
  { name: 'Tanqueray Rangpur', profile: 'Lime Intense', tonic: 'Indian Tonic', garnish: 'Lime & Ginger', why: 'Distilled with Rangpur limes; ginger adds heat to the extreme citrus profile.' },
  { name: 'Whitley Neill Rhubarb', profile: 'Tart Confectionery', tonic: 'Ginger Ale', garnish: 'Orange slice', why: 'Very sweet and nostalgic; ginger ale turns it into a refreshing highball rather than a bitter G&T.' },
  { name: 'Chase GB', profile: 'Potato Base / Dry', tonic: 'Indian Tonic', garnish: 'Ginger slice', why: "Made from potatoes (vodka base); ginger creates a 'Moscow Mule' hybrid vibe." },
  { name: 'Caorunn', profile: 'Scottish Apple', tonic: 'Indian Tonic', garnish: 'Red Apple slice', why: 'Uses coul blush apples; an apple garnish is non-negotiable to taste the spirit correctly.' },
  { name: 'Jaisalmer', profile: 'Indian Botanicals', tonic: 'Indian Tonic', garnish: 'Orange & Basil', why: 'Uses Vetiver and Cubeb pepper; basil highlights the herbaceous Indian roots.' },
  { name: 'Iron Balls', profile: 'Tropical Thai', tonic: 'Light Tonic', garnish: 'Pineapple & Basil', why: 'Distilled from coconut and pineapple; leans into a tropical profile that fights with bitter quinine.' },
  { name: "Ferdinand's Saar", profile: 'Riesling Infused', tonic: 'Mediterranean Tonic', garnish: 'White Grapes', why: 'Infused with Slate Riesling; grapes emphasize the wine character.' },
  { name: 'Bloom', profile: 'Chamomile', tonic: 'Elderflower Tonic', garnish: 'Strawberries', why: 'Extremely floral and delicate; strawberries add a summer garden finish.' },
  { name: 'Generic: Citrus', profile: 'Any Lemon/Orange Gin', tonic: 'Mediterranean Tonic', garnish: 'Fresh Basil or Thyme', why: 'For citrus-heavy gins, avoid adding more citrus. Use herbs to provide a savory contrast.' },
  { name: 'Generic: Floral', profile: 'Any Modern/Flower Gin', tonic: 'Elderflower Tonic', garnish: 'Cucumber or Berries', why: 'Floral gins are delicate. A harsh bitter tonic will crush the petals. Elderflower bridges the gap.' },
  { name: 'Generic: Spiced', profile: 'Any Winter/Spiced Gin', tonic: 'Indian Tonic', garnish: 'Orange Slice', why: 'Spiced gins often lack brightness. The sugars in the orange slice help lift the heavy clove notes.' },
  { name: 'Generic: Dry', profile: 'Any Classic London Dry', tonic: 'Indian Tonic', garnish: 'Lime Wedge', why: 'The classic chemistry: Quinine (bitter) + Juniper (pine) + Lime (sour) = The perfect triangle of flavor.' },
];
