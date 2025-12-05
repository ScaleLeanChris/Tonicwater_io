// Serve individual article pages
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Fetch the static article.html page (it handles the slug via JavaScript)
  const response = await context.env.ASSETS.fetch(new Request(url.origin + '/article.html'));

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
