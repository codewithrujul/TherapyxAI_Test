# Sukoon Data Encryption

Sensitive conversation fields are encrypted at the backend database boundary with Node.js `crypto`.

## Encrypted columns

- `chat_messages.user_msg`
- `chat_messages.ai_reply`
- `session_summaries.summary`
- `session_summaries.memories`

Metadata such as user IDs, session IDs, timestamps, modes, and mood scores stays plaintext for querying.

## Environment

Add this to Railway and local `Backend/.env`:

```bash
ENCRYPTION_KEY=<64-char hex string>
```

Generate once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Critical: once this key is used in production, do not change it. Changing it makes encrypted rows unreadable.

## How it works

- Master key: `ENCRYPTION_KEY`, 32 bytes encoded as 64 hex characters.
- Per-user key: `hkdfSync('sha256', masterKey, userId, 'sukoon-chat-v1', 32)`.
- Encryption: AES-256-GCM with a random 12-byte IV per value.
- Stored format: `enc:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
- Legacy plaintext rows still decrypt as-is because only `enc:` values are treated as encrypted.

## Backfill existing plaintext rows

Preview:

```bash
npx ts-node scripts/encryptExistingSensitiveData.ts --dry-run
```

Encrypt existing plaintext rows:

```bash
npx ts-node scripts/encryptExistingSensitiveData.ts
```

Run this after `ENCRYPTION_KEY` is set. New writes are encrypted automatically.

