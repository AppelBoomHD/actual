import express from 'express';

import { handleError } from '../app-gocardless/util/handle-error.js';
import { SecretName, secretsService } from '../services/secrets-service.js';

import {
  getAccountCash,
  getPortfolio,
  getTransactions,
  getMetadata,
  getOrders,
  getDividends,
} from './services/trading212-service.js';

const app = express();
app.use(express.json());

app.post(
  '/status',
  handleError(async (req, res) => {
    const clientId = secretsService.get(SecretName.pluggyai_clientId);
    const configured = clientId != null;

    res.send({
      status: 'ok',
      data: {
        configured,
      },
    });
  }),
);

app.post(
  '/metadata',
  handleError(async (req, res) => {
    const data = await getMetadata();
    res.send({ status: 'ok', data });
  }),
);

app.post(
  '/cash',
  handleError(async (req, res) => {
    const data = await getAccountCash();
    res.send({ status: 'ok', data });
  }),
);

app.post(
  '/portfolio',
  handleError(async (req, res) => {
    const data = await getPortfolio();
    res.send({ status: 'ok', data });
  }),
);

app.post(
  '/transactions',
  handleError(async (req, res) => {
    const { startDate, limit } = req.body || {};
    const data = await getTransactions({ startDate, limit });
    res.send({ status: 'ok', data });
  }),
);

app.post(
  '/orders',
  handleError(async (req, res) => {
    const { limit, ticker } = req.body || {};
    const data = await getOrders({ limit, ticker });
    res.send({ status: 'ok', data });
  }),
);

app.post(
  '/dividends',
  handleError(async (req, res) => {
    const { startDate, limit } = req.body || {};
    const data = await getDividends({ startDate, limit });
    res.send({ status: 'ok', data });
  }),
);

export { app as handlers };
