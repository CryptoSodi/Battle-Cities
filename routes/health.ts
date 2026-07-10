export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'battle-cities',
      runtime: 'node',
    }),
    {
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}
