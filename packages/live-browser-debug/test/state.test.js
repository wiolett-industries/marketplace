import test from 'node:test';
import assert from 'node:assert/strict';
import { DebugState } from '../src/state.js';

test('sessions can be labeled and attached independently', () => {
  const state = new DebugState({ bridgeOrigin: 'http://127.0.0.1:46777' });
  state.registerSession({
    session_id: 'a',
    tab_lineage_id: 'lineage-1',
    title: 'Admin',
    url: 'http://localhost:3000/admin',
    origin: 'http://localhost:3000',
    route_hint: '/admin',
    description: 'Admin dashboard',
    main_heading: 'Admin',
    dom_fingerprint: 'abc',
  });
  state.registerSession({
    session_id: 'b',
    tab_lineage_id: 'lineage-2',
    title: 'Admin',
    url: 'http://localhost:3000/admin?client=2',
    origin: 'http://localhost:3000',
    route_hint: '/admin?client=2',
    description: 'Admin dashboard for client 2',
    main_heading: 'Admin',
    dom_fingerprint: 'xyz',
  });

  state.labelSession('b', 'client-two');
  state.attach('b');

  const sessions = state.listSessions();
  assert.equal(sessions.length, 2);
  assert.equal(sessions.find((session) => session.session_id === 'b')?.label, 'client-two');
  assert.equal(state.status().active_session_id, 'b');
});

test('redirect watch stops recording when redirect-like navigation arrives', () => {
  const state = new DebugState({ bridgeOrigin: 'http://127.0.0.1:46777' });
  state.registerSession({
    session_id: 'a',
    tab_lineage_id: 'lineage-1',
    title: 'Login',
    url: 'http://localhost:3000/login',
    origin: 'http://localhost:3000',
    route_hint: '/login',
    description: 'Login page',
    main_heading: 'Login',
    dom_fingerprint: 'abc',
  });

  state.startRecording('a', { mode: 'redirect-watch', stopAfterRedirect: true });
  state.ingestEvent({
    session_id: 'a',
    event: {
      timestamp: new Date().toISOString(),
      category: 'navigation',
      type: 'location.assign',
      data: {
        target: 'https://malicious.example',
        redirectLike: true,
        initiator: 'location.assign',
      },
    },
  });

  assert.equal(state.status().sessions[0].recording.active, false);
  const summary = state.getRecordingSummary('a');
  assert.equal(summary.redirect.target, 'https://malicious.example');
});

test('recording summary prefers explicit redirect target over beforeunload target', () => {
  const state = new DebugState({ bridgeOrigin: 'http://127.0.0.1:46777' });
  state.registerSession({
    session_id: 'a',
    tab_lineage_id: 'lineage-1',
    title: 'Login',
    url: 'http://localhost:3000/login',
    origin: 'http://localhost:3000',
    route_hint: '/login',
    description: 'Login page',
    main_heading: 'Login',
    dom_fingerprint: 'abc',
  });

  state.ingestEvent({
    session_id: 'a',
    event: {
      timestamp: '2026-04-19T10:00:00.000Z',
      category: 'navigation',
      type: 'timer-navigation-intent',
      data: {
        target: 'https://malicious.example/landing',
        initiator: 'location.assign',
        redirectLike: true,
      },
    },
  });
  state.ingestEvent({
    session_id: 'a',
    event: {
      timestamp: '2026-04-19T10:00:01.000Z',
      category: 'navigation',
      type: 'beforeunload',
      data: {
        target: 'http://localhost:3000/login',
        initiator: 'beforeunload',
        redirectLike: true,
      },
    },
  });

  const summary = state.getRecordingSummary('a');
  assert.equal(summary.redirect.target, 'https://malicious.example/landing');
  assert.equal(summary.redirect.initiator, 'location.assign');
});
