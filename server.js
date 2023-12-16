import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import Koa from 'koa';
import { koaBody } from 'koa-body';
import Router from '@koa/router';
import cors from '@koa/cors';

import createDb from './createDb.js';
import getId from './getId.js';

const app = new Koa();
const router = new Router();

const db = createDb();

app
  .use(cors())
  .use(koaBody({
    text: true,
    urlencoded: true,
    miltipart: true,
    json: true,
  }))
  .use(router.routes())
  .use(router.allowedMethods());

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*' };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request);
    }

    ctx.response.status = 204;
  }

  return false;
});

const server = http.createServer(app);
const wsServer = new WebSocketServer({ server });
wsServer.on('connection', (ws) => {
  ws.send(JSON.stringify(db.slice(-10)));
  ws.on('message', (msg, isBinary) => {
    const message = JSON.parse(msg);

    if (message.type === 'lazyload') {
      [...wsServer.clients]
        .filter((o) => o.readyState === WebSocket.OPEN)
        .forEach((o) => {
          const { lastId } = message;
          if (lastId <= 1) return;
          const from = lastId - 11 >= 0 ? lastId - 11 : 0;
          const rs = db.slice(from, lastId - 1);
          o.send(JSON.stringify(rs), { binary: isBinary });
        });
      return;
    }

    const data = {
      id: getId(),
      message: message.message,
      attachments: message.attachments,
    };

    db.push(data);
    [...wsServer.clients]
      .filter((o) => o.readyState === WebSocket.OPEN)
      .forEach((o) => {
        o.send(JSON.stringify(data), { binary: isBinary });
      });
    // }
  });
});

const port = process.env.PORT || 3030;

const bootstrap = async () => {
  try {
    server.listen(port, () => console.log(`Server has been started on http://localhost:${port}`));
  } catch (error) {
    console.error(error);
  }
};

bootstrap();
