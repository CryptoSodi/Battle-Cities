declare const require: any;

const replayIdentity = require('../server/replayIdentity');
const replayStore = require('../server/replayStore');

export async function GET(request: Request): Promise<Response> {
  const replayGuest = replayIdentity.resolveReplayGuest(
    request.headers.get('cookie') || '',
  );
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id !== null) {
    const record = await replayStore.readRecord(id, replayGuest.guestId);
    if (record === null) {
      return json({ error: 'Replay not found' }, 404, replayGuest.setCookie);
    }

    return json({ item: record }, 200, replayGuest.setCookie);
  }

  return json(
    { items: await replayStore.listSummaries(replayGuest.guestId) },
    200,
    replayGuest.setCookie,
  );
}

export async function POST(request: Request): Promise<Response> {
  const replayGuest = replayIdentity.resolveReplayGuest(
    request.headers.get('cookie') || '',
  );
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, replayGuest.setCookie);
  }

  if (!replayStore.isValidReplay(body?.replay)) {
    return json(
      { error: 'Invalid replay payload' },
      400,
      replayGuest.setCookie,
    );
  }

  const record = await replayStore.createRecord(
    replayGuest.guestId,
    body.replay,
  );

  return json(
    { item: replayStore.toSummary(record) },
    201,
    replayGuest.setCookie,
  );
}

function json(
  body: any,
  status = 200,
  setCookie: string | null = null,
): Response {
  const headers = new Headers({
    'content-type': 'application/json',
  });
  if (setCookie !== null) {
    headers.set('set-cookie', setCookie);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
