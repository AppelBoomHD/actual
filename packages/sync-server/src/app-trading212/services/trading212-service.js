import axios from 'axios';

import { SecretName, secretsService } from '../../services/secrets-service.js';

import { getUsdToEurRate } from './exchange-rate.js';

const BASE_URL = 'https://live.trading212.com/api/v0';

function getAuthHeaders() {
  const apiKey = secretsService.get(SecretName.trading212_apiKey);
  if (!apiKey) throw new Error('Trading 212 API key not set');
  return {
    Authorization: apiKey,
    Accept: 'application/json',
  };
}

function getDate(date) {
  return date.toISOString().split('T')[0];
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

    const usdToEurRate = await getUsdToEurRate();
    const items = (res.data || []).map(p => ({
      ...p,
      internalTransactionId: p.ticker,
      date: getDate(new Date(p.initialFillDate)),
      payeeName: p.ticker,
      amount: p.ticker.includes('US')
        ? p.quantity * p.currentPrice * usdToEurRate
        : p.quantity * p.currentPrice,
      type: 'investment',
      booked: true,
    }));

    return items;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getTransactions({ startDate, limit } = {}) {
  try {
    const params = {};
    if (startDate) params.time = new Date(startDate).toUTCString();
    if (limit) params.limit = limit;
    const url = `${BASE_URL}/history/transactions`;
    let allItems = [];
    let hasNext = true;
    let first = true;
    let paramsString = '';
    while (hasNext) {
      let res;
      if (first) {
        res = await axios.get(url, { headers: getAuthHeaders(), params });
        first = false;
      } else {
        // nextPagePath is a query string for transactions
        res = await axios.get(
          `${BASE_URL}/history/transactions?${paramsString}`,
          { headers: getAuthHeaders() },
        );
      }
      const data = res.data;
      allItems = allItems.concat(data.items || []);
      if (data.nextPagePath) {
        console.log('nextPagePath', data.nextPagePath);
        // nextPagePath is a query string (e.g. limit=50&cursor=...)
        paramsString = data.nextPagePath.startsWith('?')
          ? data.nextPagePath.slice(1)
          : data.nextPagePath;
      } else {
        hasNext = false;
      }
    }

    const items = allItems.map(t => ({
      ...t,
      internalTransactionId: t.reference,
      date: getDate(new Date(t.dateTime)),
      payeeName: t.type,
      amount: t.amount,
      type: 'cash',
      booked: true,
    }));

    return items;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getOrders({ limit, ticker } = {}) {
  try {
    const params = {};
    if (limit) params.limit = limit;
    if (ticker) params.ticker = ticker;
    const url = `${BASE_URL}/equity/history/orders`;
    let allItems = [];
    let hasNext = true;
    let first = true;
    let nextPagePath = '';
    while (hasNext) {
      let res;
      if (first) {
        res = await axios.get(url, { headers: getAuthHeaders(), params });
        first = false;
      } else {
        // nextPagePath is a full path for orders
        res = await axios.get(`${BASE_URL}${nextPagePath}`, {
          headers: getAuthHeaders(),
        });
      }
      const data = res.data;
      allItems = allItems.concat(data.items || []);
      if (data.nextPagePath) {
        nextPagePath = data.nextPagePath.startsWith('/')
          ? data.nextPagePath
          : `/${data.nextPagePath}`;
        nextPagePath = nextPagePath.replace('/api/v0', '');
      } else {
        hasNext = false;
      }
    }

    const items = allItems.reduce((arr, o) => {
      if (o.filledValue) {
        arr.push({
          ...o,
          internalTransactionId: o.fillId,
          date: getDate(new Date(o.dateCreated)),
          payeeName: o.ticker,
          amount: -o.filledValue,
          type: 'order',
          booked: true,
        });
      }
      return arr;
    }, []);

    return items;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}

export async function getDividends({ startDate, limit } = {}) {
  try {
    const params = {};
    if (startDate) params.paidOn = new Date(startDate).toISOString();
    if (limit) params.limit = limit;
    const url = `${BASE_URL}/history/dividends`;
    let allItems = [];
    let hasNext = true;
    let first = true;
    let paramsString = '';
    while (hasNext) {
      let res;
      if (first) {
        res = await axios.get(url, { headers: getAuthHeaders(), params });
        first = false;
      } else {
        res = await axios.get(`${BASE_URL}/history/dividends?${paramsString}`, {
          headers: getAuthHeaders(),
        });
      }
      const data = res.data;
      allItems = allItems.concat(data.items || []);
      if (data.nextPagePath) {
        paramsString = data.nextPagePath.startsWith('?')
          ? data.nextPagePath.slice(1)
          : data.nextPagePath;
      } else {
        hasNext = false;
      }
    }

    const items = allItems.map(d => ({
      ...d,
      internalTransactionId: d.reference,
      date: getDate(new Date(d.paidOn)),
      payeeName: d.ticker || 'Dividend',
      amount: d.amountInEuro,
      type: 'dividend',
      booked: true,
    }));

    return items;
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message);
  }
}
