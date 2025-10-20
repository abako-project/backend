/**
 * Convert base64url string to Uint8Array
 */
export function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binStr = atob(base64);
  const bin = new Uint8Array(binStr.length);
  
  for (let i = 0; i < binStr.length; i++) {
    bin[i] = binStr.charCodeAt(i);
  }
  
  return bin;
}

/**
 * Convert Uint8Array to base64url string
 */
export function uint8ArrayToBase64url(uint8Array: Uint8Array): string {
  const binString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join('');
  const base64 = btoa(binString);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Hash a user ID using SHA-256
 */
export async function hashUserId(userId: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(userId)
      )
    );
  } catch (error) {
    console.error('Error hashing user ID:', error);
    throw new Error('Failed to hash user ID');
  }
} 