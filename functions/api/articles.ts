// API Route: /api/articles - Proxy to SEO Agent Worker

const SEO_WORKER_URL = 'https://tonicwater-seo-agent.odd-hill-1be0.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = `${SEO_WORKER_URL}/api/articles${url.search}`;

  const response = await fetch(workerUrl, {
    method: 'GET',
    headers: context.request.headers,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
