// Serve the articles listing page
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Fetch the static articles.html page
  const response = await context.env.ASSETS.fetch(new Request(url.origin + '/articles.html'));

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
