import fs from 'node:fs';

import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import actuator from 'express-actuator';
import rateLimit from 'express-rate-limit';

import { bootstrap } from './account-db.js';
import * as accountApp from './app-account.js';
import * as adminApp from './app-admin.js';
import * as goCardlessApp from './app-gocardless/app-gocardless.js';
import * as openidApp from './app-openid.js';
import * as pluggai from './app-pluggyai/app-pluggyai.js';
import * as secretApp from './app-secrets.js';
import * as simpleFinApp from './app-simplefin/app-simplefin.js';
import * as syncApp from './app-sync.js';
import * as trading212App from './app-trading212/app-trading212.js';
import { config } from './load-config.js';

const app = express();

process.on('unhandledRejection', reason => {
  console.log('Rejection:', reason);
});

app.disable('x-powered-by');
app.use(cors());
app.set('trust proxy', config.get('trustedProxies'));
if (process.env.NODE_ENV !== 'development') {
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 500,
      legacyHeaders: false,
      standardHeaders: true,
    }),
  );
}

app.use(
  bodyParser.json({ limit: `${config.get('upload.fileSizeLimitMB')}mb` }),
);
app.use(
  bodyParser.raw({
    type: 'application/actual-sync',
    limit: `${config.get('upload.fileSizeSyncLimitMB')}mb`,
  }),
);
app.use(
  bodyParser.raw({
    type: 'application/encrypted-file',
    limit: `${config.get('upload.syncEncryptedFileSizeLimitMB')}mb`,
  }),
);

app.use('/sync', syncApp.handlers);
app.use('/account', accountApp.handlers);
app.use('/gocardless', goCardlessApp.handlers);
app.use('/simplefin', simpleFinApp.handlers);
app.use('/pluggyai', pluggai.handlers);
app.use('/secret', secretApp.handlers);
app.use('/trading212', trading212App.handlers);

app.use('/admin', adminApp.handlers);
app.use('/openid', openidApp.handlers);

app.get('/mode', (req, res) => {
  res.send(config.get('mode'));
});

app.use(actuator()); // Provides /health, /metrics, /info

// The web frontend
app.use((req, res, next) => {
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
if (process.env.NODE_ENV === 'development') {
  console.log(
    'Running in development mode - Proxying frontend routes to React Dev Server',
  );

  // Imported within Dev block to allow dev dependency in package.json (reduces package size in production)
  const httpProxyMiddleware = await import('http-proxy-middleware');

  app.use(
    httpProxyMiddleware.createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true,
    }),
  );
} else {
  console.log('Running in production mode - Serving static React app');

  app.use(express.static(config.get('webRoot'), { index: false }));
  app.get('/*', (req, res) =>
    res.sendFile(config.get('webRoot') + '/index.html'),
  );
}

function parseHTTPSConfig(value: string) {
  if (value.startsWith('-----BEGIN')) {
    return value;
  }
  return fs.readFileSync(value);
}

export async function run() {
  const portVal = config.get('port');
  const port = typeof portVal === 'string' ? parseInt(portVal) : portVal;
  const hostname = config.get('hostname');
  const openIdConfig = config?.getProperties()?.openId;
  if (
    openIdConfig?.discoveryURL ||
    // @ts-expect-error FIXME no types for config yet
    openIdConfig?.issuer?.authorization_endpoint
  ) {
    console.log('OpenID configuration found. Preparing server to use it');
    try {
      const { error } = await bootstrap({ openId: openIdConfig }, true);
      if (error) {
        console.log(error);
      } else {
        console.log('OpenID configured!');
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (config.get('https.key') && config.get('https.cert')) {
    const https = await import('node:https');
    const httpsOptions = {
      ...config.get('https'),
      key: parseHTTPSConfig(config.get('https.key')),
      cert: parseHTTPSConfig(config.get('https.cert')),
    };
    https.createServer(httpsOptions, app).listen(port, hostname);
  } else {
    app.listen(port, hostname);
  }

  // Signify to any parent process that the server has started. Used in electron desktop app
  // @ts-ignore-error electron types
  process.parentPort?.postMessage({ type: 'server-started' });

  console.log(
    'Listening on ' + config.get('hostname') + ':' + config.get('port') + '...',
  );
}
