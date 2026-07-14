/**
 * Crypto Helper Module using the Web Crypto API
 * Implements AES-GCM-256 encryption and PBKDF2 key derivation.
 */

// Helper: Convert string to UTF-8 byte array
function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

// Helper: Convert byte array to string
function bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
}

// Helper: Convert array buffer to hex string
function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Helper: Convert hex string to byte array
function hexToBuf(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes.buffer;
}

// Helper: Generate cryptographically secure random bytes
function generateRandomBytes(length) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * Derives an AES-GCM 256-bit key from a password and salt using PBKDF2.
 * @param {string} password 
 * @param {ArrayBuffer} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
    const passwordBytes = stringToBytes(password);
    
    // Import the raw password as a key for PBKDF2
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passwordBytes,
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    // Derive the final AES-GCM key
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false, // Key is not exportable
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a plaintext string with a password.
 * Returns an object containing the salt, iv, and ciphertext as hex strings.
 * @param {string} plaintext 
 * @param {string} password 
 * @returns {Promise<{salt: string, iv: string, ciphertext: string}>}
 */
async function encryptData(plaintext, password) {
    const salt = generateRandomBytes(16);
    const iv = generateRandomBytes(12); // Recommended for AES-GCM
    const key = await deriveKey(password, salt);
    
    const plaintextBytes = stringToBytes(plaintext);
    const encryptedBuf = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        plaintextBytes
    );
    
    return {
        salt: bufToHex(salt),
        iv: bufToHex(iv),
        ciphertext: bufToHex(encryptedBuf)
    };
}

/**
 * Decrypts a ciphertext using a password, salt, and iv.
 * @param {string} ciphertextHex 
 * @param {string} password 
 * @param {string} saltHex 
 * @param {string} ivHex 
 * @returns {Promise<string>}
 */
async function decryptData(ciphertextHex, password, saltHex, ivHex) {
    const salt = hexToBuf(saltHex);
    const iv = hexToBuf(ivHex);
    const ciphertext = hexToBuf(ciphertextHex);
    
    const key = await deriveKey(password, salt);
    
    const decryptedBuf = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        ciphertext
    );
    
    return bytesToString(decryptedBuf);
}
