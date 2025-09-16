// Fallback Redis implementation that gracefully fails if package isn't available
export async function getCached<T>(key: string): Promise<T | null> {
  // TODO: Redis implementation temporarily disabled for build
  console.warn(`Redis getCached called for key: ${key} but not implemented`);
  return null;
}

export async function setCached<T>(
  key: string, 
  data: T, 
  expirationSeconds: number = 60
): Promise<void> {
  // TODO: Redis implementation temporarily disabled for build
  console.warn(`Redis setCached called for key: ${key} (${expirationSeconds}s) but not implemented`, data);
}

export async function deleteCached(key: string): Promise<void> {
  // TODO: Redis implementation temporarily disabled for build  
  console.warn(`Redis deleteCached called for key: ${key} but not implemented`);
}

export async function testRedisConnection(): Promise<boolean> {
  // TODO: Redis implementation temporarily disabled for build
  console.warn('Redis testRedisConnection called but not implemented');
  return false;
}