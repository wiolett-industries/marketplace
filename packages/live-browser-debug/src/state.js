import crypto from 'node:crypto';

const DEFAULT_EVENT_LIMIT = 250;
const DEFAULT_SNAPSHOT_LIMIT = 16;
const RECORDING_EVENT_LIMIT = 3000;
const RECORDING_SNAPSHOT_LIMIT = 120;

function trimBuffer(items, limit) {
  if (items.length <= limit) {
    return items;
  }

  return items.slice(items.length - limit);
}

function nowIso() {
  return new Date().toISOString();
}

function summarizeRecording(session) {
  const events = session.events;
  const redirectCandidates = [...events]
    .filter((event) => event.category === 'navigation' && event.data?.redirectLike)
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
  const redirectEvent =
    redirectCandidates.find((event) => {
      const target = String(event.data?.target ?? '');
      return Boolean(target) && target !== session.url && !['beforeunload', 'pagehide'].includes(String(event.data?.initiator ?? ''));
    }) ??
    redirectCandidates.find((event) => {
      const initiator = String(event.data?.initiator ?? '');
      return !['beforeunload', 'pagehide'].includes(initiator);
    }) ??
    redirectCandidates[0];
  const networkEvents = events.filter((event) => event.category === 'network');
  const errorEvents = events.filter((event) => event.category === 'error');
  const suspiciousRequests = networkEvents.filter((event) => {
    const url = String(event.data?.url ?? '');
    return url.startsWith('http') && session.origin && !url.startsWith(session.origin);
  });

  return {
    session_id: session.sessionId,
    label: session.label,
    title: session.title,
    url: session.url,
    event_count: events.length,
    snapshot_count: session.snapshots.length,
    recording: session.recording,
    redirect: redirectEvent
      ? {
          timestamp: redirectEvent.timestamp,
          target: redirectEvent.data?.target ?? redirectEvent.data?.url ?? null,
          initiator: redirectEvent.data?.initiator ?? null,
        }
      : null,
    suspicious_requests: suspiciousRequests.slice(-10).map((event) => ({
      timestamp: event.timestamp,
      url: event.data?.url ?? null,
      method: event.data?.method ?? null,
      status: event.data?.status ?? null,
    })),
    recent_errors: errorEvents.slice(-10).map((event) => ({
      timestamp: event.timestamp,
      message: event.data?.message ?? null,
      source: event.data?.source ?? null,
    })),
  };
}

export class DebugState {
  constructor({ bridgeOrigin }) {
    this.bridgeOrigin = bridgeOrigin;
    this.sessions = new Map();
    this.activeSessionId = null;
  }

  registerSession(payload) {
    const registeredAt = nowIso();
    const existing = this.sessions.get(payload.session_id);
    const session = {
      sessionId: payload.session_id,
      tabLineageId: payload.tab_lineage_id,
      title: payload.title ?? '',
      url: payload.url ?? '',
      origin: payload.origin ?? '',
      routeHint: payload.route_hint ?? '',
      description: payload.description ?? '',
      mainHeading: payload.main_heading ?? '',
      domFingerprint: payload.dom_fingerprint ?? '',
      attachedAt: existing?.attachedAt ?? registeredAt,
      lastSeenAt: registeredAt,
      visibilityState: payload.visibility_state ?? 'visible',
      focusState: Boolean(payload.focus_state),
      recording: existing?.recording ?? {
        active: false,
        mode: null,
        startedAt: null,
        stopAfterRedirect: false,
      },
      label: existing?.label ?? null,
      events: existing?.events ?? [],
      snapshots: existing?.snapshots ?? [],
    };

    this.sessions.set(session.sessionId, session);
    if (!this.activeSessionId) {
      this.activeSessionId = session.sessionId;
    }

    return session;
  }

  heartbeat(payload) {
    const session = this.requireSession(payload.session_id);
    session.title = payload.title ?? session.title;
    session.url = payload.url ?? session.url;
    session.origin = payload.origin ?? session.origin;
    session.routeHint = payload.route_hint ?? session.routeHint;
    session.description = payload.description ?? session.description;
    session.mainHeading = payload.main_heading ?? session.mainHeading;
    session.domFingerprint = payload.dom_fingerprint ?? session.domFingerprint;
    session.visibilityState = payload.visibility_state ?? session.visibilityState;
    session.focusState = payload.focus_state ?? session.focusState;
    session.lastSeenAt = nowIso();
    return session;
  }

  attach(sessionId) {
    const session = this.requireSession(sessionId);
    this.activeSessionId = sessionId;
    return session;
  }

  labelSession(sessionId, label) {
    const session = this.requireSession(sessionId);
    session.label = label;
    return session;
  }

  listSessions() {
    return [...this.sessions.values()]
      .map((session) => ({
        session_id: session.sessionId,
        tab_lineage_id: session.tabLineageId,
        title: session.title,
        url: session.url,
        origin: session.origin,
        route_hint: session.routeHint,
        description: session.description,
        main_heading: session.mainHeading,
        dom_fingerprint: session.domFingerprint,
        attached_at: session.attachedAt,
        last_seen_at: session.lastSeenAt,
        visibility_state: session.visibilityState,
        focus_state: session.focusState,
        label: session.label,
        recording: session.recording,
        active: session.sessionId === this.activeSessionId,
      }))
      .sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  }

  startRecording(sessionId, options = {}) {
    const session = this.requireSession(sessionId);
    session.recording = {
      active: true,
      mode: options.mode ?? 'recording',
      startedAt: nowIso(),
      stopAfterRedirect: Boolean(options.stopAfterRedirect),
      durationMs: options.durationMs ?? 30000,
    };
    return session.recording;
  }

  stopRecording(sessionId) {
    const session = this.requireSession(sessionId);
    session.recording = {
      ...session.recording,
      active: false,
      stoppedAt: nowIso(),
      stopAfterRedirect: false,
    };
    return session.recording;
  }

  ingestEvent(payload) {
    const session = this.requireSession(payload.session_id);
    const event = {
      id: payload.event?.id ?? crypto.randomUUID(),
      timestamp: payload.event?.timestamp ?? nowIso(),
      category: payload.event?.category ?? 'misc',
      type: payload.event?.type ?? 'unknown',
      data: payload.event?.data ?? {},
    };
    session.events = trimBuffer(
      [...session.events, event],
      session.recording.active ? RECORDING_EVENT_LIMIT : DEFAULT_EVENT_LIMIT
    );
    session.lastSeenAt = nowIso();

    if (
      session.recording.active &&
      session.recording.stopAfterRedirect &&
      event.category === 'navigation' &&
      event.data?.redirectLike
    ) {
      this.stopRecording(session.sessionId);
    }

    return event;
  }

  ingestSnapshot(payload) {
    const session = this.requireSession(payload.session_id);
    const snapshot = {
      id: payload.snapshot?.id ?? crypto.randomUUID(),
      timestamp: payload.snapshot?.timestamp ?? nowIso(),
      kind: payload.snapshot?.kind ?? 'state',
      data: payload.snapshot?.data ?? {},
    };
    session.snapshots = trimBuffer(
      [...session.snapshots, snapshot],
      session.recording.active ? RECORDING_SNAPSHOT_LIMIT : DEFAULT_SNAPSHOT_LIMIT
    );
    session.lastSeenAt = nowIso();
    return snapshot;
  }

  getTimeline(sessionId, { limit } = {}) {
    const session = this.requireSession(sessionId);
    return limit ? session.events.slice(-limit) : session.events;
  }

  getLogs(sessionId, { limit } = {}) {
    return this.getTimeline(sessionId, { limit }).filter((event) => event.category === 'console' || event.category === 'error');
  }

  getNetwork(sessionId, { limit } = {}) {
    return this.getTimeline(sessionId, { limit }).filter((event) => event.category === 'network');
  }

  getDomSnapshot(sessionId, lookup = {}) {
    const session = this.requireSession(sessionId);
    if (lookup.snapshotId) {
      return session.snapshots.find((snapshot) => snapshot.id === lookup.snapshotId) ?? null;
    }
    if (lookup.atEventId) {
      const event = session.events.find((entry) => entry.id === lookup.atEventId);
      if (!event) {
        return null;
      }
      return this.#closestSnapshot(session, Date.parse(event.timestamp));
    }
    if (lookup.atTimestamp) {
      return this.#closestSnapshot(session, Date.parse(lookup.atTimestamp));
    }
    return session.snapshots.at(-1) ?? null;
  }

  getVisualSnapshot(sessionId, lookup = {}) {
    const snapshot = this.getDomSnapshot(sessionId, lookup);
    if (!snapshot) {
      return null;
    }
    if (snapshot.kind === 'visual' || snapshot.data?.visual) {
      return snapshot;
    }
    return null;
  }

  getRecordingSummary(sessionId) {
    const session = this.requireSession(sessionId);
    return summarizeRecording(session);
  }

  cleanupStatus() {
    return {
      bridge_origin: this.bridgeOrigin,
      sessions: this.listSessions(),
      cleanup_note:
        'Remove the temporary live-browser-debug patch markers from the frontend app and reload the dev server when debugging is finished.',
    };
  }

  status() {
    return {
      bridge_origin: this.bridgeOrigin,
      active_session_id: this.activeSessionId,
      session_count: this.sessions.size,
      sessions: this.listSessions(),
    };
  }

  requireSession(sessionId) {
    const targetId = sessionId ?? this.activeSessionId;
    if (!targetId) {
      throw new Error('No live browser debug session is attached.');
    }
    const session = this.sessions.get(targetId);
    if (!session) {
      throw new Error(`Unknown live browser debug session: ${targetId}`);
    }
    return session;
  }

  #closestSnapshot(session, targetTimeMs) {
    if (!Number.isFinite(targetTimeMs) || session.snapshots.length === 0) {
      return session.snapshots.at(-1) ?? null;
    }

    let best = session.snapshots[0];
    let bestDistance = Math.abs(Date.parse(best.timestamp) - targetTimeMs);

    for (const snapshot of session.snapshots.slice(1)) {
      const distance = Math.abs(Date.parse(snapshot.timestamp) - targetTimeMs);
      if (distance < bestDistance) {
        best = snapshot;
        bestDistance = distance;
      }
    }

    return best;
  }
}
