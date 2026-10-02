import crypto from "crypto";

const ENCRYPTED_PREFIX = "enc:";
const MASTER_KEY_HEX_LENGTH = 64;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const USER_KEY_BYTES = 32;
const HKDF_INFO = "sukoon-chat-v1";
const USER_KEY_CACHE_MAX = 1000;
const userKeyCache = new Map<string, Buffer>();

function getMasterKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY?.trim();

    if (!key) {
        throw new Error("ENCRYPTION_KEY must be set to encrypt sensitive user data");
    }

    if (!new RegExp(`^[a-fA-F0-9]{${MASTER_KEY_HEX_LENGTH}}$`).test(key)) {
        throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
    }

    return Buffer.from(key, "hex");
}

function getUserKey(userId: string): Buffer {
    if (!userId.trim()) {
        throw new Error("userId is required for encryption");
    }

    const cached = userKeyCache.get(userId);
    if (cached) return cached;

    const key = Buffer.from(crypto.hkdfSync(
        "sha256",
        getMasterKey(),
        Buffer.from(userId, "utf-8"),
        Buffer.from(HKDF_INFO, "utf-8"),
        USER_KEY_BYTES
    ));

    if (userKeyCache.size >= USER_KEY_CACHE_MAX) {
        userKeyCache.delete(userKeyCache.keys().next().value!);
    }
    userKeyCache.set(userId, key);

    return key;
}

export function isEncrypted(value: unknown): value is string {
    return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

export function encrypt(value: string, userId: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv("aes-256-gcm", getUserKey(userId), iv, {
        authTagLength: AUTH_TAG_BYTES,
    });

    const ciphertext = Buffer.concat([
        cipher.update(value, "utf-8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
        ENCRYPTED_PREFIX.slice(0, -1),
        iv.toString("hex"),
        authTag.toString("hex"),
        ciphertext.toString("hex"),
    ].join(":");
}

export function decrypt(value: unknown, userId: string): string {
    if (value == null) return "";

    if (!isEncrypted(value)) {
        return typeof value === "string" ? value : JSON.stringify(value);
    }

    const [, ivHex, tagHex, ciphertextHex] = value.split(":");

    if (!ivHex || !tagHex || !ciphertextHex) {
        throw new Error("Invalid encrypted payload format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        throw new Error("Invalid encrypted payload metadata");
    }

    const decipher = crypto.createDecipheriv("aes-256-gcm", getUserKey(userId), iv, {
        authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]).toString("utf-8");
}

export function encryptJson(value: unknown, userId: string): string {
    return encrypt(JSON.stringify(value ?? {}), userId);
}

export function decryptJson<T>(value: unknown, userId: string, fallback: T): T {
    try {
        const plain = decrypt(value, userId);
        if (!plain.trim()) return fallback;
        return JSON.parse(plain) as T;
    } catch (error) {
        console.error(`[Encryption] Failed to decrypt/parse JSON: ${(error as Error).message}`);
        return fallback;
    }
}
