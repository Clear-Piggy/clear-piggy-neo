// Simple in-memory cache for AI insights
// In production, you might want to use Redis or Supabase tables

interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export function getCachedInsights(workspaceId: string): any | null {
  const cacheKey = `ai-insights-${workspaceId}`;
  const entry = cache.get(cacheKey);
  
  if (!entry) {
    return null;
  }
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

export function setCachedInsights(workspaceId: string, data: any): void {
  const cacheKey = `ai-insights-${workspaceId}`;
  const now = Date.now();
  
  cache.set(cacheKey, {
    data,
    timestamp: now,
    expiresAt: now + CACHE_DURATION
  });
}

export function clearCachedInsights(workspaceId: string): void {
  const cacheKey = `ai-insights-${workspaceId}`;
  cache.delete(cacheKey);
}

// Generate a hash of transaction data to detect changes
export function generateDataHash(transactions: any[]): string {
  const hashString = JSON.stringify(transactions.map(t => ({
    id: t.id,
    date: t.transaction_date,
    amount: t.amount_cents,
    merchant: t.merchant_name
  })));
  
  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return hash.toString();
}