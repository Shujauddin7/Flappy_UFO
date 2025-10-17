// Practice Mode coin management with tamper protection
// As per Plan.md: Earn 1 coin per star, use 10 coins to continue

const COINS_KEY = 'flappy_ufo_coins';
const COINS_HASH_KEY = 'flappy_ufo_coins_hash';
const SALT = 'ufo_secret_2024'; // SALT ensures tamper detection

/**
 * Save coins with hash to prevent manual edits
 */
export function saveCoins(amount: number): void {
    try {
        const hash = btoa(`${amount}_${SALT}`);
        localStorage.setItem(COINS_KEY, amount.toString());
        localStorage.setItem(COINS_HASH_KEY, hash);
    } catch {
        }
}

/**
 * Load coins; reset to 0 if tampered
 */
export function loadCoins(): number {
    try {
        const coins = localStorage.getItem(COINS_KEY) || '0';
        const storedHash = localStorage.getItem(COINS_HASH_KEY);
        const expectedHash = btoa(`${coins}_${SALT}`);

        // If hash doesn't match, coins were tampered - reset to 0
        if (storedHash !== expectedHash) {
            saveCoins(0);
            return 0;
        }

        return Math.max(0, parseInt(coins, 10) || 0);
    } catch {
        return 0;
    }
}

/**
 * Add coins (when collecting stars)
 */
export function addCoins(amount: number): number {
    const currentCoins = loadCoins();
    const newAmount = currentCoins + amount;
    saveCoins(newAmount);
    return newAmount;
}

/**
 * Spend coins (for continues)
 */
export function spendCoins(amount: number): boolean {
    const currentCoins = loadCoins();
    if (currentCoins >= amount) {
        saveCoins(currentCoins - amount);
        return true;
    }
    return false;
}

/**
 * Check if player has enough coins for continue
 */
export function canContinue(): boolean {
    return loadCoins() >= 10; // Need 10 coins to continue as per Plan.md
}

/**
 * Get current coin count
 */
export function getCoins(): number {
    return loadCoins();
}

/**
 * Reset coins to 0 (for sign out or account reset)
 */
export function resetCoins(): void {
    saveCoins(0);
}
