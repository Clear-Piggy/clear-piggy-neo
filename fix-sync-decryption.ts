// ADD THIS DECRYPT FUNCTION TO workspace-sync-transactions/index.ts

// Helper to decrypt tokens encrypted with AES-GCM
async function decryptToken(encryptedToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('PLAID_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY');
  
  if (!encryptionKey) {
    console.warn('No encryption key found, assuming base64 encoding');
    // Try simple base64 decode
    try {
      const decoded = atob(encryptedToken);
      // Check if it looks like a valid Plaid token
      if (decoded.startsWith('access-')) {
        return decoded;
      }
    } catch (e) {
      console.error('Failed to decode as base64:', e);
    }
    // Return as-is and hope for the best
    return encryptedToken;
  }
  
  try {
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Import the key
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encrypted
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    const token = decoder.decode(decrypted);
    
    console.log('Successfully decrypted token');
    console.log('Token format check:', token.startsWith('access-') ? '✅ Valid' : '⚠️ Unexpected format');
    
    return token;
  } catch (err) {
    console.error('Decryption failed:', err);
    // Try fallback to simple base64
    try {
      const decoded = atob(encryptedToken);
      if (decoded.startsWith('access-')) {
        console.log('Fallback to base64 decode successful');
        return decoded;
      }
    } catch (e) {
      // Ignore
    }
    // Last resort - return as is
    console.error('All decryption attempts failed, returning encrypted token');
    return encryptedToken;
  }
}

// THEN REPLACE LINE 92-103 in workspace-sync-transactions/index.ts with:

// Decrypt the access token
console.log('Decrypting access token for institution:', institution.name);
const accessToken = await decryptToken(institution.plaid_access_token_encrypted);

// Validate the token format
if (!accessToken.startsWith('access-')) {
  console.error(`Invalid token format for ${institution.name}. Token should start with 'access-'`);
  console.error('Token preview:', accessToken.substring(0, 20) + '...');
  totalErrors++;
  continue;
}

console.log('Token decrypted successfully, format validated');