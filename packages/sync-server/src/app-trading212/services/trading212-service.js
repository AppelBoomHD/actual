import axios from 'axios';

import { SecretName, secretsService } from '../../services/secrets-service.js';

const BASE_URL = 'https://live.trading212.com/api/v0';

function getAuthHeaders() {
  const apiKey = secretsService.get(SecretName.trading212_apiKey);
  if (!apiKey) throw new Error('Trading 212 API key not set');
  return {
    Authorization: apiKey,
    Accept: 'application/json',
  };
}

export async function getMetadata() {
  try {
    const res = await axios.get(`${BASE_URL}/equity/account/info`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getAccountCash() {
  try {
    const res = await axios.get(`${BASE_URL}/equity/account/cash`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getPortfolio() {
  try {
    const res = await axios.get(`${BASE_URL}/equity/portfolio`, {
      headers: getAuthHeaders(),
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getTransactions({ startDate, limit } = {}) {
  try {
    const params = {};
    if (startDate) params.time = new Date(startDate).toUTCString();
    if (limit) params.limit = limit;
    const res = await axios.get(`${BASE_URL}/history/transactions`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getOrders({ limit, ticker } = {}) {
  try {
    const params = {};
    if (limit) params.limit = limit;
    if (ticker) params.ticker = ticker;
    const res = await axios.get(`${BASE_URL}/equity/history/orders`, {
      headers: getAuthHeaders(),
      params,
    });
    return res.data;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}
