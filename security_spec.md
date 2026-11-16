# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Isolation**: Every document under `/users/{userId}/public/profile`, `/users/{userId}/private/info`, `/users/{userId}/orders/{orderId}`, and `/users/{userId}/rules/{ruleId}` must match `uid == request.auth.uid` on creation and preserve immutable `uid` and `createdAt` across updates.
2. **PII Split Isolation**: Contact and business fields (`email`, `phone`, `businessAddress`, `licenseKey`) live exclusively in `/users/{userId}/private/info`, readable and writable only by the owning user (`request.auth.uid == userId`) or a verified admin (`isAdmin()`).
3. **Verified Sessions Only**: All write operations require a verified authentication credential (`email_verified == true`).
4. **Server Timestamps & Bounded Strings**: Every `createdAt`/`updatedAt` field must equal `request.time` on write, and every string and array field enforces explicit `.size()` bounds matching `firebase-blueprint.json`.
5. **Terminal State Locking**: Orders whose `status` is `'DELIVERED'` or `'CANCELLED'` cannot be mutated by non-admin users once finalized.
6. **Admin-Only License Issuance**: Regular users and customers cannot read, list, create, update, or delete `/licenses/{licenseId}` documents, nor set or mutate `licenseTier` or `licenseKey` fields on `/users/{userId}/private/info`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: Write `/users/victim_uid/public/profile` with `uid: "victim_uid"` while authenticated as `attacker_uid`. -> Must return `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Create `/users/u1/public/profile` with extra ghost field `isAdmin: true` or `role: "superadmin"`. -> Must return `PERMISSION_DENIED`.
3. **Unverified Email Write**: Create `/users/u1/private/info` using a token with `email_verified: false`. -> Must return `PERMISSION_DENIED`.
4. **Email Spoof Admin Escalation**: Attempt admin read of `/users/victim/private/info` with `token.email: "ba6263845@gmail.com"` and `token.email_verified: false`. -> Must return `PERMISSION_DENIED`.
5. **PII Read Leak**: Read `/users/victim/private/info` while signed in as `other_user`. -> Must return `PERMISSION_DENIED`.
6. **Orders Blanket List Leak**: Attempt `list` on `/users/victim/orders` while signed in as `other_user`. -> Must return `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Create `/users/u1/orders/ord1` with client-supplied past timestamp in `createdAt`. -> Must return `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Update `/users/u1/orders/ord1` modifying `createdAt` or `uid`. -> Must return `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized ID)**: Write to `/users/<200-char-invalid-id!>/orders/ord1`. -> Must return `PERMISSION_DENIED`.
10. **Value Poisoning (Oversized Display Name / Item)**: Update `/users/u1/public/profile` with 500-char `displayName`. -> Must return `PERMISSION_DENIED`.
11. **Terminal Order Mutation**: Attempt to update an order with existing `status: "DELIVERED"` back to `"PENDING"` as non-admin. -> Must return `PERMISSION_DENIED`.
12. **Self-Promotion to Admin or License Tampering**: Write `/admins/u1`, read/write `/licenses/lic1`, or update `licenseTier` / `licenseKey` in `/users/u1/private/info` as non-admin user `u1`. -> Must return `PERMISSION_DENIED`.
