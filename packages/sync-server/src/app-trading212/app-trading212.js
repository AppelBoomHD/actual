import express from 'express';

import { handleError } from '../app-gocardless/util/handle-error.js';
import { SecretName, secretsService } from '../services/secrets-service.js';

import {
  getAccountCash,
  getPortfolio,
  getTransactions,
  getMetadata,
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

app.post('/metadata', async (req, res) => {
  try {
    const data = await getMetadata();
    res.send({ status: 'ok', data });
  } catch (e) {
    res.send({ status: 'error', error: e.message });
  }
});

app.post('/cash', async (req, res) => {
  try {
    const data = await getAccountCash();
    res.send({ status: 'ok', data });
  } catch (e) {
    res.send({ status: 'error', error: e.message });
  }
});

app.post('/portfolio', async (req, res) => {
  try {
    const data = await getPortfolio();
    res.send({ status: 'ok', data });
  } catch (e) {
    res.send({ status: 'error', error: e.message });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const { startDate, limit } = req.body || {};
    const data = await getTransactions({ startDate, limit });
    res.send({ status: 'ok', data });
  } catch (e) {
    res.send({ status: 'error', error: e.message });
  }
});

export { app as handlers };
