/**
 * Unit tests for `EventSource`.
 *
 * The cases follow the suite the `eventsource` npm package uses
 * (https://github.com/EventSource/eventsource `test/client.test.ts`) — same
 * SSE semantics: connect/receive/disconnect, reconnection with `Last-Event-ID`
 * after the `retry:` delay, `readyState` through the lifecycle, HTTP 204 ending
 * a stream, fatal failures not being retried, and the last event id persisting
 * across events that omit the `id:` field.
 *
 * Two cases are ours rather than theirs: routing every event name through the
 * JS-visible `dispatchEvent` (what makes regex subscriptions observable) and
 * not delivering exact listeners twice.
 *
 * A real `node:http` server drives a real `fetch`, so the reader, the decoder
 * and the reconnection path are exercised rather than mocked.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';

// The class our transport uses: the `eventsource` peer dependency, reached
// through this package's browser entry.
import { EventSource } from '../src/transports/pubsub/browser';

let server: http.Server | undefined;
const PORT = 45123;

/** Requests seen per endpoint, to assert on reconnection behaviour. */
let requests: Record<string, { lastEventId: string | null }[]> = {};

import { waitFor, waitForSettled } from './utils/wait';

/**
 * Endpoints:
 * - `/counter`      3 events per request, then ends the stream; a 3rd request
 *                   gets 204 so the test cannot loop forever (reconnect test).
 * - `/burst`        exactly 3 events, then 204 (bounded single stream).
 * - `/lifecycle`    one event, then ends with a long `retry:` (readyState test).
 * - `/end-after-one` one event, ends; the reconnect answers 204 (stop).
 * - `/mixed-ids`    an event with `id:` then one without it.
 * - `/identified`   counts connects per `client-id` (explicit-close test).
 * - `/fatal`        HTTP 500 (fatal).
 * - `/wrong-type`   HTTP 200 with the wrong content type (fatal).
 */
function startServer() {
  const handler = (req: any, res: any) => {
    const [path, query] = String(req.url ?? '').split('?', 2)
    const lastEventId = (req.headers['last-event-id'] as string | null) ?? null
    const key = path.replace(/^\//, '')
    const seen = requests[key] ?? [];
    seen.push({ lastEventId });
    requests[key] = seen;

    if (path === '/lifecycle') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('retry: 3000\n\n');
      res.write('id: 1\nevent: counter\ndata: Counter is at 1\n\n');
      res.end(); // ends, then waits 3s before reconnecting
      return;
    }

    if (path === '/counter') {
      if (seen.length > 2) {
        res.writeHead(204); // stop the loop once the test is done
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('retry: 20\n\n');
      const from = lastEventId ? Number(lastEventId) : 0;
      for (let i = from + 1; i <= from + 3; i++) {
        res.write(`id: ${i}\nevent: counter\ndata: Counter is at ${i}\n\n`);
      }
      res.end(); // the server disconnects: the client must reconnect
      return;
    }

    if (path === '/burst') {
      if (seen.length > 1) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (let i = 1; i <= 3; i++) {
        res.write(`id: ${i}\nevent: counter\ndata: Counter is at ${i}\n\n`);
      }
      res.end();
      return;
    }

    if (path === '/end-after-one') {
      if (seen.length === 1) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('retry: 20\n\n');
        res.write('id: 1\nevent: progress\ndata: 10\n\n');
        res.end();
      } else {
        res.writeHead(204); // "stop reconnecting"
        res.end();
      }
      return;
    }

    if (path === '/mixed-ids') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('id: 1\nevent: message\ndata: First, with id\n\n');
      res.write('event: message\ndata: Second, without id\n\n');
      res.end();
      return;
    }

    if (path === '/identified') {
      const clientId = new URLSearchParams(query || '').get('client-id') ?? '';
      const idKey = `identified:${clientId}`;
      const idSeen = requests[idKey] ?? [];
      idSeen.push({ lastEventId });
      requests[idKey] = idSeen;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('retry: 20\n\n');
      res.write(`id: ${idSeen.length}\ndata: ${idSeen.length}\n\n`);
      res.end();
      return;
    }

    if (path === '/fatal') {
      res.writeHead(500, { 'Content-Type': 'text/event-stream' });
      res.end();
      return;
    }

    if (path === '/wrong-type') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('not an event stream');
      return;
    }

    res.writeHead(404);
    res.end();
  };

  server = http.createServer(handler);
  server.listen(PORT);
}

const streamUrl = (path: string) => `http://localhost:${PORT}${path}`;

describe('EventSource', () => {
  beforeAll(startServer);
  afterAll(() => {
    server?.close();
    server = undefined;
    requests = {};
  });

  it('can connect, receive message, manually disconnect', async () => {
    // `/lifecycle` keeps the stream open for 3s before reconnecting, so the
    // open state is observable from inside the listener.
    const es = new EventSource(streamUrl('/lifecycle'));
    const received: string[] = [];
    let stateAtFirstEvent: number | undefined;
    es.addEventListener('counter', (event: any) => {
      received.push(event.data);
      if (stateAtFirstEvent === undefined) stateAtFirstEvent = es.readyState;
    });
    await waitForSettled(() => received.length >= 1, { settle: 50, label: 'first counter event received' });
    expect(received).toEqual(['Counter is at 1']);
    expect(stateAtFirstEvent).toBe(EventSource.OPEN);
    es.close();
    expect(es.readyState).toBe(EventSource.CLOSED);
  });

  it('will have correct ready state throughout lifecycle', async () => {
    // `/lifecycle` ends after one event and asks for a 3s reconnect, so the
    // reconnecting state is observable rather than racing a fast reconnect.
    const es = new EventSource(streamUrl('/lifecycle'));
    expect(es.readyState).toBe(EventSource.CONNECTING);
    const states: number[] = [];
    es.addEventListener('counter', () => {
      states.push(es.readyState);
    });
    // Poll for the event *and* the post-stream reconnecting state, so the
    // assertion is not racing a fixed sleep.
    await waitForSettled(
      () => states.length >= 1 && es.readyState === EventSource.CONNECTING,
      { settle: 50, label: 'event seen while OPEN, stream then ended' },
    );
    // The stream is consumed quickly, so OPEN is only visible while it is open.
    expect(states).toEqual([EventSource.OPEN]);
    expect(es.readyState).toBe(EventSource.CONNECTING);
    es.close();
    expect(es.readyState).toBe(EventSource.CLOSED);
  });

  it('will reconnect with last received message id if server disconnects', async () => {
    requests['counter'] = [];
    const received: string[] = [];
    const es = new EventSource(streamUrl('/counter'));
    es.addEventListener('counter', (event: any) => {
      received.push(event.data);
    });
    await waitForSettled(
      () => received.length >= 6 && requests['counter'].length >= 2,
      { settle: 50, label: 'reconnect delivered the second batch of events' },
    );
    es.close();

    const connects = requests['counter'];
    expect(connects.length).toBeGreaterThanOrEqual(2);
    expect(connects[0].lastEventId).toBe(null);
    // The first stream carried ids 1..3, so the reconnect reports id 3.
    expect(connects[1].lastEventId).toBe('3');
    expect(received).toEqual([
      'Counter is at 1',
      'Counter is at 2',
      'Counter is at 3',
      'Counter is at 4',
      'Counter is at 5',
      'Counter is at 6',
    ]);
  });

  it('will not reconnect after explicit close()', async () => {
    const clientId = Math.random().toString(36).slice(2);
    const idKey = `identified:${clientId}`;
    requests[idKey] = [];
    const es = new EventSource(streamUrl(`/identified?client-id=${clientId}`));
    let messages = 0;
    es.addEventListener('message', () => {
      messages++;
      es.close();
    });
    await waitForSettled(
      () => messages >= 1 && es.readyState === EventSource.CLOSED,
      { settle: 100, label: 'message received, then close() stopped the stream' },
    );
    expect(messages).toBe(1);
    expect(es.readyState).toBe(EventSource.CLOSED);
    // The stream ends after one message, so without close() it would reconnect.
    expect(requests[idKey].length).toBe(1);
  });

  it('will close stream on HTTP 204', async () => {
    requests['end-after-one'] = [];
    const es = new EventSource(streamUrl('/end-after-one'));
    let messages = 0;
    es.addEventListener('progress', () => {
      messages++;
    });
    await waitForSettled(
      () => messages >= 1 && requests['end-after-one'].length >= 2 && es.readyState === EventSource.CLOSED,
      { settle: 50, label: '204 ended the stream after the reconnect' },
    );
    expect(messages).toBe(1);
    expect(requests['end-after-one'].length).toBe(2);
    expect(es.readyState).toBe(EventSource.CLOSED);
  });

  it('will not reconnect after a fatal connection failure', async () => {
    requests['fatal'] = [];
    const es = new EventSource(streamUrl('/fatal'));
    await waitFor(
      () => es.readyState === EventSource.CLOSED && requests['fatal'].length >= 1,
      { label: 'fatal failure closed the stream without retrying' },
    );
    expect(es.readyState).toBe(EventSource.CLOSED);
    expect(requests['fatal'].length).toBe(1);
  });

  it('will treat a wrong content type as a fatal failure', async () => {
    requests['wrong-type'] = [];
    const es = new EventSource(streamUrl('/wrong-type'));
    await waitFor(
      () => es.readyState === EventSource.CLOSED && requests['wrong-type'].length >= 1,
      { label: 'wrong content type closed the stream without retrying' },
    );
    expect(es.readyState).toBe(EventSource.CLOSED);
    expect(requests['wrong-type'].length).toBe(1);
  });

  it('message events carry their own id, while reconnection uses the persisted one', async () => {
    const seen: any[] = [];
    const es = new EventSource(streamUrl('/mixed-ids'));
    es.addEventListener('message', (event: any) => {
      seen.push(event);
    });
    await waitForSettled(() => seen.length >= 2, { settle: 50, label: 'both id events received' });
    es.close();
    // The upstream implementation dispatches real `MessageEvent` instances, so
    // the fields are read through their accessors rather than by shape match.
    expect(seen[0].data).toBe('First, with id');
    expect(seen[0].lastEventId).toBe('1');
    expect(seen[1].data).toBe('Second, without id');
    // The last event id persists across events that omit `id:`, per the spec —
    // which is also what a reconnection request carries.
    expect(seen[1].lastEventId).toBe('1');
  });

  // Ours, not upstream's: this is what makes regex subscriptions observable.
  it('routes every event name through the JS-visible dispatchEvent', async () => {
    requests['burst'] = [];
    const seen: string[] = [];
    const es = new EventSource(streamUrl('/burst'));
    // `SseClientPubSubTransport` replaces `dispatchEvent` to match regex
    // patterns against names it was never registered for.
    es.dispatchEvent = (event: any) => {
      seen.push(event.type);
      return true;
    };
    await waitForSettled(
      () => seen.filter((name) => name === 'counter').length >= 3,
      { settle: 50, label: 'dispatchEvent hook saw every event name' },
    );
    es.close();
    // Upstream also announces the connection itself, so the hook sees `open`
    // first — that is exactly why unclaimed names must be filtered by the
    // consumer, not handed to every listener.
    expect(seen[0]).toBe('open');
    expect(seen.filter((name) => name === 'counter')).toHaveLength(3);
  });

  it('delivers exact listeners once when dispatchEvent is replaced', async () => {
    requests['burst'] = [];
    let exact = 0;
    const es = new EventSource(streamUrl('/burst'));
    // Same shape as `SseClientPubSubTransport`: exact listeners live in the
    // `EventTarget` registry, so the replacement has to hand the event back to
    // the inherited dispatch — otherwise they would never fire.
    const inheritedDispatch = es.dispatchEvent;
    es.addEventListener('counter', () => {
      exact++;
    });
    es.dispatchEvent = (event: any) => inheritedDispatch.call(es, event);
    await waitForSettled(() => exact >= 3, { settle: 50, label: 'exact listeners fired for every event' });
    es.close();
    expect(exact).toBe(3);
  });
});
