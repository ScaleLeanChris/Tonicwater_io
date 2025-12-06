// Serve the shopping guide page
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Fetch the static shop.html page
  const response = await context.env.ASSETS.fetch(new Request(url.origin + '/shop.html'));

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'text/html',
    },
  });
};
