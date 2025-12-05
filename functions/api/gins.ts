// API Route: /api/gins - Proxy to Worker with Durable Objects

const WORKER_URL = 'https://tonicwater-api.odd-hill-1be0.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const workerUrl = `${WORKER_URL}/api/gins${url.search}`;

  const response = await fetch(workerUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.method !== 'GET' ? context.request.body : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
