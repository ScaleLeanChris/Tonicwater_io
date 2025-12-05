// API Route: /api/articles/:slug - Proxy to SEO Agent Worker

const SEO_WORKER_URL = 'https://tonicwater-seo-agent.odd-hill-1be0.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const slug = context.params.slug as string;
  const workerUrl = `${SEO_WORKER_URL}/api/articles/${encodeURIComponent(slug)}`;

  const response = await fetch(workerUrl, {
    method: 'GET',
    headers: context.request.headers,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
