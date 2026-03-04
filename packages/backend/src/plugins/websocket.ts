import websocket from '@fastify/websocket';
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';

declare module 'fastify' {
  interface FastifyInstance {
    broadcast: (message: object) => void;
  }
}

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

  // Decorate app with broadcast function
  app.decorate('broadcast', (message: object) => {
    const payload = JSON.stringify(message);
    for (const client of app.websocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });
};

// Use fp to break encapsulation so broadcast decorator propagates to parent
const websocketPlugin = fp(websocketPluginInner, {
  name: 'cowboy-websocket',
});

export default websocketPlugin;
