// API Route: /api/categories - Proxy to Worker

const WORKER_URL = 'https://tonicwater-api.odd-hill-1be0.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const workerUrl = `${WORKER_URL}/api/categories`;

  const response = await fetch(workerUrl, {
    method: 'GET',
    headers: context.request.headers,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
};
