const MAX_BODY_CHARS = 20000;
const MAX_VISUAL_CHARS = 250000;
const MAX_QUEUED_MESSAGES = 1000;

function createHash(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function escapeInlineScript(source) {
  return source.replace(/<\/script/gi, '<\\/script');
}

function buildInlineClientSource(wsOrigin) {
  return String.raw`(() => {
  if (window.__WIOLETT_LIVE_BROWSER_DEBUG__) {
    return;
  }

  const BRIDGE_WS_ORIGIN = ${JSON.stringify(wsOrigin)};
  const HEARTBEAT_MS = 5000;
  const SNAPSHOT_DEBOUNCE_MS = 500;
  const DEBUG = {
    ready: false,
    registering: false,
    wsOrigin: BRIDGE_WS_ORIGIN,
    socket: null,
    sessionId: (globalThis.crypto?.randomUUID?.() ?? "session-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
    lineageId: sessionStorage.getItem("__wiolett_live_browser_debug_lineage") || (globalThis.crypto?.randomUUID?.() ?? "lineage-" + Date.now() + "-" + Math.random().toString(16).slice(2)),
    lastMutationAt: 0,
    mutationCount: 0,
    queuedMessages: [],
  };
  sessionStorage.setItem("__wiolett_live_browser_debug_lineage", DEBUG.lineageId);
  window.__WIOLETT_LIVE_BROWSER_DEBUG__ = DEBUG;

  function nowIso() {
    return new Date().toISOString();
  }

  function truncateString(value, limit) {
    const text = String(value ?? "");
    if (text.length <= limit) {
      return { text, truncated: false };
    }
    return { text: text.slice(0, limit), truncated: true };
  }

  function describePage() {
    const heading = document.querySelector("h1,h2,[role='heading']");
    const metaDescription = document.querySelector('meta[name="description"]')?.content || "";
    const routeHint = location.pathname + location.search + location.hash;
    const shellSummary = Array.from(document.querySelectorAll("main,header,nav,aside,footer"))
      .slice(0, 8)
      .map((node) => [node.tagName.toLowerCase(), node.id || "", node.className || ""].join(":"))
      .join("|");
    const mainHeading = heading?.textContent?.trim()?.slice(0, 200) || "";
    const description = metaDescription || mainHeading || document.title || routeHint;
    const domFingerprint = ${createHash.toString()}(document.title + "|" + routeHint + "|" + shellSummary + "|" + mainHeading);
    return {
      session_id: DEBUG.sessionId,
      tab_lineage_id: DEBUG.lineageId,
      title: document.title,
      url: location.href,
      origin: location.origin,
      route_hint: routeHint,
      description,
      main_heading: mainHeading,
      dom_fingerprint: domFingerprint,
      visibility_state: document.visibilityState,
      focus_state: document.hasFocus(),
    };
  }

  function enqueue(message) {
    DEBUG.queuedMessages.push(message);
    if (DEBUG.queuedMessages.length > ${MAX_QUEUED_MESSAGES}) {
      DEBUG.queuedMessages.splice(0, DEBUG.queuedMessages.length - ${MAX_QUEUED_MESSAGES});
    }
  }

  function flushQueue() {
    if (!DEBUG.socket || DEBUG.socket.readyState !== WebSocket.OPEN || !DEBUG.ready) {
      return;
    }
    while (DEBUG.queuedMessages.length > 0) {
      DEBUG.socket.send(JSON.stringify(DEBUG.queuedMessages.shift()));
    }
  }

  function sendMessage(type, payload = {}) {
    const message = { type, ...payload };
    if (!DEBUG.socket || DEBUG.socket.readyState !== WebSocket.OPEN || !DEBUG.ready) {
      enqueue(message);
      return;
    }
    DEBUG.socket.send(JSON.stringify(message));
  }

  function emitEvent(category, type, data = {}) {
    sendMessage("event", {
      session_id: DEBUG.sessionId,
      event: {
        timestamp: nowIso(),
        category,
        type,
        data,
      },
    });
  }

  function emitSnapshot(kind, data = {}) {
    sendMessage("snapshot", {
      session_id: DEBUG.sessionId,
      snapshot: {
        timestamp: nowIso(),
        kind,
        data,
      },
    });
  }

  function buildStateSnapshot(reason) {
    return {
      reason,
      page: describePage(),
      storage: {
        local_keys: Object.keys(localStorage).slice(0, 100),
        session_keys: Object.keys(sessionStorage).slice(0, 100),
      },
    };
  }

  function buildDomSnapshot(reason) {
    const bodyHtml = document.body ? document.body.outerHTML : document.documentElement.outerHTML;
    const serialized = truncateString(bodyHtml, ${MAX_BODY_CHARS});
    return {
      reason,
      page: describePage(),
      html: serialized.text,
      html_truncated: serialized.truncated,
    };
  }

  function buildVisualSnapshot(reason) {
    const html = document.documentElement.outerHTML;
    const serialized = truncateString(html, ${MAX_VISUAL_CHARS});
    const escaped = serialized.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 1280, 1280);
    const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 720, 720);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui; white-space: pre-wrap; font-size: 10px; background: white; color: black;">' + escaped + '</div></foreignObject></svg>';
    return {
      reason,
      approximate: true,
      truncated: serialized.truncated,
      format: "image/svg+xml",
      data_url: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    };
  }

  let snapshotTimer = null;
  function scheduleSnapshots(reason) {
    if (snapshotTimer) {
      return;
    }
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      emitSnapshot("state", buildStateSnapshot(reason));
      emitSnapshot("dom", buildDomSnapshot(reason));
      emitSnapshot("visual", buildVisualSnapshot(reason));
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  function safePatchLocationMethod(methodName) {
    const locationPrototype =
      globalThis.Location?.prototype ||
      Object.getPrototypeOf(window.location);
    if (!locationPrototype) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(locationPrototype, methodName);
    const original = descriptor?.value;
    if (typeof original !== "function") {
      return;
    }

    try {
      Object.defineProperty(locationPrototype, methodName, {
        configurable: true,
        writable: true,
        value: function patchedLocationMethod(target) {
          emitEvent("navigation", "location." + methodName, {
            target: String(target),
            initiator: "location." + methodName,
            redirectLike: true,
          });
          scheduleSnapshots("location." + methodName);
          return original.apply(this, arguments);
        },
      });
    } catch {}
  }

  function installHooks() {
    ["log", "info", "warn", "error"].forEach((level) => {
      const original = console[level];
      console[level] = function patchedConsole(...args) {
        emitEvent("console", level, {
          args: args.map((value) => {
            try {
              return typeof value === "string" ? value : JSON.stringify(value);
            } catch {
              return String(value);
            }
          }),
        });
        return original.apply(this, args);
      };
    });

    window.addEventListener("error", (event) => {
      emitEvent("error", "window-error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
      scheduleSnapshots("window-error");
    });

    window.addEventListener("unhandledrejection", (event) => {
      emitEvent("error", "unhandledrejection", {
        message: String(event.reason?.message || event.reason),
      });
      scheduleSnapshots("unhandledrejection");
    });

    const originalFetch = window.fetch;
    window.fetch = async function patchedFetch(input, init) {
      const startedAt = performance.now();
      const requestUrl = typeof input === "string" ? input : input?.url;
      if (typeof requestUrl === "string" && requestUrl.startsWith("http://127.0.0.1:46779")) {
        return originalFetch.apply(this, arguments);
      }

      const method = init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET";
      let requestBody = init?.body ?? null;
      if (typeof requestBody !== "string" && requestBody != null) {
        requestBody = String(requestBody);
      }
      try {
        const response = await originalFetch.apply(this, arguments);
        let responseBody = null;
        try {
          responseBody = await response.clone().text();
        } catch {}
        emitEvent("network", "fetch", {
          url: requestUrl,
          method,
          status: response.status,
          ok: response.ok,
          duration_ms: Math.round(performance.now() - startedAt),
          request_body: truncateString(requestBody, ${MAX_BODY_CHARS}),
          response_body: truncateString(responseBody, ${MAX_BODY_CHARS}),
          redirectLike: response.redirect,
        });
        if (response.redirect) {
          scheduleSnapshots("fetch-redirect");
        }
        return response;
      } catch (error) {
        emitEvent("network", "fetch-error", {
          url: requestUrl,
          method,
          duration_ms: Math.round(performance.now() - startedAt),
          message: String(error?.message || error),
        });
        scheduleSnapshots("fetch-error");
        throw error;
      }
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__wiolettDebugMethod = method;
      this.__wiolettDebugUrl = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      const startedAt = performance.now();
      this.addEventListener("loadend", () => {
        if (typeof this.__wiolettDebugUrl === "string" && this.__wiolettDebugUrl.startsWith("http://127.0.0.1:46779")) {
          return;
        }
        emitEvent("network", "xhr", {
          url: this.__wiolettDebugUrl,
          method: this.__wiolettDebugMethod || "GET",
          status: this.status,
          duration_ms: Math.round(performance.now() - startedAt),
          request_body: truncateString(typeof body === "string" ? body : body == null ? "" : String(body), ${MAX_BODY_CHARS}),
          response_body: truncateString(typeof this.responseText === "string" ? this.responseText : "", ${MAX_BODY_CHARS}),
        });
      });
      return originalSend.apply(this, arguments);
    };

    safePatchLocationMethod("assign");
    safePatchLocationMethod("replace");

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    history.pushState = function patchedPushState(state, unused, url) {
      emitEvent("navigation", "history.pushState", {
        target: url == null ? location.href : String(url),
        initiator: "history.pushState",
        redirectLike: false,
      });
      return originalPushState(state, unused, url);
    };
    history.replaceState = function patchedReplaceState(state, unused, url) {
      emitEvent("navigation", "history.replaceState", {
        target: url == null ? location.href : String(url),
        initiator: "history.replaceState",
        redirectLike: false,
      });
      return originalReplaceState(state, unused, url);
    };

    const originalOpenWindow = window.open;
    window.open = function patchedWindowOpen(url) {
      emitEvent("navigation", "window.open", {
        target: url == null ? null : String(url),
        initiator: "window.open",
        redirectLike: true,
      });
      return originalOpenWindow.apply(this, arguments);
    };

    function detectNavigationIntent(source) {
      if (typeof source !== "string") {
        return null;
      }
      const patterns = [
        {
          regex: /location\.(assign|replace)\(\s*(['"])([^'"]+)\2\s*\)/,
          initiatorPrefix: "location.",
        },
        {
          regex: /window\.open\(\s*(['"])([^'"]+)\1/,
          initiatorPrefix: "window.open",
        },
        {
          regex: /location\.href\s*=\s*(['"])([^'"]+)\1/,
          initiatorPrefix: "location.href",
        },
        {
          regex: /window\.location\s*=\s*(['"])([^'"]+)\1/,
          initiatorPrefix: "window.location",
        },
      ];

      for (const pattern of patterns) {
        const match = source.match(pattern.regex);
        if (!match) {
          continue;
        }

        if (pattern.initiatorPrefix === "window.open") {
          return {
            target: match[2],
            initiator: "window.open",
          };
        }

        if (pattern.initiatorPrefix === "location." && match[1] && match[3]) {
          return {
            target: match[3],
            initiator: pattern.initiatorPrefix + match[1],
          };
        }

        if (match[2]) {
          return {
            target: match[2],
            initiator: pattern.initiatorPrefix,
          };
        }
      }

      return null;
    }

    const originalSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function patchedSetTimeout(callback, delay) {
      try {
        const intent = detectNavigationIntent(String(callback));
        if (intent) {
          emitEvent("navigation", "timer-navigation-intent", {
            target: intent.target,
            initiator: intent.initiator,
            scheduled_by: "setTimeout",
            delay_ms: Number(delay) || 0,
            redirectLike: true,
            scheduled: true,
          });
        }
      } catch {}
      return originalSetTimeout(callback, delay);
    };

    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = function patchedSetInterval(callback, delay) {
      try {
        const intent = detectNavigationIntent(String(callback));
        if (intent) {
          emitEvent("navigation", "interval-navigation-intent", {
            target: intent.target,
            initiator: intent.initiator,
            scheduled_by: "setInterval",
            delay_ms: Number(delay) || 0,
            redirectLike: true,
            scheduled: true,
          });
        }
      } catch {}
      return originalSetInterval(callback, delay);
    };

    document.addEventListener("click", (event) => {
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor) {
        return;
      }
      emitEvent("navigation", "anchor-click", {
        target: anchor.href,
        initiator: "anchor",
        redirectLike: true,
      });
    }, true);

    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form || !form.action) {
        return;
      }
      emitEvent("navigation", "form-submit", {
        target: form.action,
        initiator: "form",
        redirectLike: true,
      });
    }, true);

    const refreshMeta = document.querySelector('meta[http-equiv="refresh"]');
    if (refreshMeta) {
      emitEvent("navigation", "meta-refresh", {
        target: refreshMeta.content,
        initiator: "meta-refresh",
        redirectLike: true,
      });
    }

    const mutationObserver = new MutationObserver((records) => {
      DEBUG.mutationCount += records.length;
      DEBUG.lastMutationAt = Date.now();
      clearTimeout(mutationObserver.__wiolettTimer);
      mutationObserver.__wiolettTimer = setTimeout(() => {
        emitEvent("dom", "mutation-burst", {
          mutations: DEBUG.mutationCount,
        });
        DEBUG.mutationCount = 0;
        scheduleSnapshots("mutation-burst");
      }, SNAPSHOT_DEBOUNCE_MS);
    });
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: false,
    });

    function patchStorage(storage, storageName) {
      ["setItem", "removeItem", "clear"].forEach((methodName) => {
        const original = storage[methodName];
        storage[methodName] = function patchedStorage() {
          emitEvent("storage", storageName + "." + methodName, {
            args: Array.from(arguments).slice(0, 2).map((value) => String(value)),
          });
          return original.apply(this, arguments);
        };
      });
    }
    patchStorage(window.localStorage, "localStorage");
    patchStorage(window.sessionStorage, "sessionStorage");

    document.addEventListener("visibilitychange", () => {
      emitEvent("lifecycle", "visibilitychange", {
        state: document.visibilityState,
      });
    });

    window.addEventListener("beforeunload", () => {
      emitEvent("navigation", "beforeunload", {
        target: location.href,
        initiator: "beforeunload",
        redirectLike: true,
      });
      emitSnapshot("state", buildStateSnapshot("beforeunload"));
      emitSnapshot("dom", buildDomSnapshot("beforeunload"));
    });

    window.addEventListener("pagehide", () => {
      emitEvent("navigation", "pagehide", {
        target: location.href,
        initiator: "pagehide",
        redirectLike: true,
      });
    });
  }

  function handleCommand(message) {
    if (message.command === "snapshot_now") {
      const reason = message.reason || "command";
      emitSnapshot("state", buildStateSnapshot(reason));
      emitSnapshot("dom", buildDomSnapshot(reason));
      emitSnapshot("visual", buildVisualSnapshot(reason));
      sendMessage("command_result", {
        session_id: DEBUG.sessionId,
        request_id: message.request_id ?? null,
        ok: true,
      });
    }
  }

  function connect() {
    const socket = new WebSocket(BRIDGE_WS_ORIGIN);
    DEBUG.socket = socket;

    socket.addEventListener("open", () => {
      DEBUG.registering = true;
      socket.send(JSON.stringify({
        type: "register",
        session: describePage(),
      }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "registered") {
          DEBUG.ready = true;
          DEBUG.registering = false;
          flushQueue();
          emitSnapshot("state", buildStateSnapshot("initial"));
          emitSnapshot("dom", buildDomSnapshot("initial"));
          emitSnapshot("visual", buildVisualSnapshot("initial"));
        } else if (message.type === "command") {
          handleCommand(message);
        }
      } catch {}
    });

    socket.addEventListener("close", () => {
      DEBUG.ready = false;
    });

    socket.addEventListener("error", () => {});
  }

  installHooks();
  connect();
  setInterval(() => {
    sendMessage("heartbeat", describePage());
  }, HEARTBEAT_MS);
})();`;
}

function buildInlineClientScriptTag(wsOrigin) {
  return `<script>\n${escapeInlineScript(buildInlineClientSource(wsOrigin))}\n</script>`;
}

export { buildInlineClientSource, buildInlineClientScriptTag };
