import axios from 'axios';

import { globalCacheService } from '../../services/global-cache-service.js';
import { SecretName, secretsService } from '../../services/secrets-service.js';

const API_URL = 'https://openexchangerates.org/api/latest.json';
const BASE = 'USD';
const SYMBOLS = 'EUR';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_KEY = 'usdToEurRate';

export async function getUsdToEurRate() {
  const now = Date.now();
  const cached = globalCacheService.get(CACHE_KEY);
  if (cached && now - cached.updated_at < CACHE_TTL_MS) {
    console.log('cached', cached);
    return Number(cached.value);
  }
  const OER_APP_ID = secretsService.get(SecretName.trading212_oerAppId);
  if (!OER_APP_ID) {
    throw new Error('OER_APP_ID is not set');
  }
  const url = `${API_URL}?app_id=${OER_APP_ID}&base=${BASE}&symbols=${SYMBOLS}`;
  const res = await axios.get(url);
  if (!res.data || !res.data.rates || typeof res.data.rates.EUR !== 'number') {
    throw new Error('Invalid response from exchange rate API');
  }
  const rate = Number(res.data.rates.EUR);
  globalCacheService.set(CACHE_KEY, String(rate));
  return rate;
}
