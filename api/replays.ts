declare const require: any;

const replayStore = require('../server/replayStore');

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id !== null) {
    const record = await replayStore.readRecord(id);
    if (record === null) {
      return json({ error: 'Replay not found' }, 404);
    }

    return json({ item: record });
  }

  const guestId = url.searchParams.get('guestId');
  if (!replayStore.isValidGuestId(guestId)) {
    return json({ error: 'Missing guestId' }, 400);
  }

  return json({ items: await replayStore.listSummaries(guestId) });
}

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    !replayStore.isValidGuestId(body?.guestId) ||
    !replayStore.isValidReplay(body?.replay)
  ) {
    return json({ error: 'Invalid replay payload' }, 400);
  }

  const record = await replayStore.createRecord(body.guestId, body.replay);

  return json({ item: replayStore.toSummary(record) }, 201);
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}
