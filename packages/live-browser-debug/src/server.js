import http from 'node:http';
import { WebSocketServer } from 'ws';
import { DebugState } from './state.js';

function jsonResponse(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(payload));
}

export async function createBridgeServer({ host = '127.0.0.1', port = 46777 } = {}) {
  const bridgeOrigin = `http://${host}:${port}`;
  const wsOrigin = `ws://${host}:${port}/ws`;
  const state = new DebugState({ bridgeOrigin });
  const socketsBySessionId = new Map();

  const server = http.createServer(async (request, response) => {
    try {
      if (!request.url) {
        jsonResponse(response, 404, { error: 'missing-url' });
        return;
      }

      if (request.method === 'OPTIONS') {
        jsonResponse(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && request.url === '/health') {
        jsonResponse(response, 200, { ok: true, bridge_origin: bridgeOrigin, ws_origin: wsOrigin });
        return;
      }

      jsonResponse(response, 404, { error: 'not-found' });
    } catch (error) {
      jsonResponse(response, 500, {
        error: error instanceof Error ? error.message : 'unknown-error',
      });
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'hello', bridge_origin: bridgeOrigin, ws_origin: wsOrigin }));

    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(String(raw));

        if (message.type === 'register') {
          const session = state.registerSession(message.session ?? {});
          socket.sessionId = session.sessionId;
          socketsBySessionId.set(session.sessionId, socket);
          socket.send(JSON.stringify({ type: 'registered', session_id: session.sessionId }));
          return;
        }

        if (message.type === 'heartbeat') {
          const session = state.heartbeat(message);
          socket.sessionId = session.sessionId;
          socketsBySessionId.set(session.sessionId, socket);
          return;
        }

        if (message.type === 'event') {
          state.ingestEvent(message);
          return;
        }

        if (message.type === 'snapshot') {
          state.ingestSnapshot(message);
          return;
        }

        if (message.type === 'command_result') {
          return;
        }
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'unknown-error',
          })
        );
      }
    });

    socket.on('close', () => {
      if (socket.sessionId) {
        socketsBySessionId.delete(socket.sessionId);
      }
    });
  });

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit('connection', websocket, request);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    server,
    state,
    bridgeOrigin,
    wsOrigin,
    sendCommand(sessionId, command, payload = {}) {
      const socket = socketsBySessionId.get(sessionId);
      if (!socket || socket.readyState !== socket.OPEN) {
        throw new Error(`No connected live-browser-debug client for session ${sessionId}`);
      }
      socket.send(
        JSON.stringify({
          type: 'command',
          command,
          request_id: `${command}-${Date.now()}`,
          ...payload,
        })
      );
    },
    close: async () => {
      for (const socket of socketsBySessionId.values()) {
        try {
          socket.close();
        } catch {}
      }
      await new Promise((resolve, reject) => {
        wss.close((error) => (error ? reject(error) : resolve()));
      });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
