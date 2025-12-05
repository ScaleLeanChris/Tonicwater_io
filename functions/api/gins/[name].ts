// API Route: /api/gins/:name - Proxy to Worker with Durable Objects

const WORKER_URL = 'https://tonicwater-api.odd-hill-1be0.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const name = context.params.name as string;
  const workerUrl = `${WORKER_URL}/api/gins/${encodeURIComponent(name)}`;

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
