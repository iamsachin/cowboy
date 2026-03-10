import websocket from '@fastify/websocket';
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import type { WebSocketEventPayload } from '@cowboy/shared';

declare module 'fastify' {
  interface FastifyInstance {
    broadcastEvent: (event: WebSocketEventPayload) => void;
  }
}

let seq = 0;

const websocketPluginInner: FastifyPluginAsync = async (app: FastifyInstance) => {
  await app.register(websocket);

  // WebSocket route for live updates
  app.get('/api/ws', { websocket: true }, (socket) => {
    app.log.info('WebSocket client connected');

    socket.on('close', () => {
      app.log.info('WebSocket client disconnected');
    });

    // Send initial connected confirmation
    socket.send(JSON.stringify({ type: 'connected' }));
  });

  // Decorate app with typed broadcastEvent function
  app.decorate('broadcastEvent', (event: WebSocketEventPayload) => {
    const payload = JSON.stringify({ ...event, seq: ++seq });
    for (const client of app.websocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });
};

// Use fp to break encapsulation so broadcastEvent decorator propagates to parent
const websocketPlugin = fp(websocketPluginInner, {
  name: 'cowboy-websocket',
});

export default websocketPlugin;

// Export for testing — allows resetting the sequence counter
export function _resetSeqForTest(): void {
  seq = 0;
}
