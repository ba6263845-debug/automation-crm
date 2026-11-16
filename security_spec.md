# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Identity Isolation**: Every document under `/users/{userId}/public/profile` and `/users/{userId}/private/info` must match `uid == request.auth.uid` on creation and preserve immutable `uid` and `createdAt` across updates.
2. **PII Split Isolation**: Contact fields (`email`, `phone`, `businessAddress`) live exclusively in `/users/{userId}/private/info`, readable and writable only by the owning user (`request.auth.uid == userId`) or a verified admin (`isAdmin()`).
3. **Verified Sessions Only**: All standard write operations require a verified authentication credential (`email_verified == true` for email/Google accounts or verified `phone_number` for Phone Auth).
4. **Server Timestamps & Bounded Strings**: Every `createdAt`/`updatedAt` field must equal `request.time` on write, and every string field enforces explicit `.size()` bounds matching `firebase-blueprint.json`.
5. **No Self-Assigned Admin Roles**: Only bootstrapped or existing admins may create, update, or delete `/admins/{userId}` documents.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Create**: Write `/users/victim_uid/public/profile` with `uid: "victim_uid"` while authenticated as `attacker_uid`. -> Must return `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Create `/users/u1/public/profile` with extra ghost field `isAdmin: true` or `role: "superadmin"`. -> Must return `PERMISSION_DENIED`.
3. **Unverified Email Write**: Create `/users/u1/private/info` using an Email/Password token with `email_verified: false` and no `phone_number`. -> Must return `PERMISSION_DENIED`.
4. **Email Spoof Admin Escalation**: Attempt admin read of `/users/victim/private/info` with `token.email: "gg627263663@gmail.com"` and `token.email_verified: false`. -> Must return `PERMISSION_DENIED`.
5. **PII Read Leak**: Read `/users/victim/private/info` while signed in as `other_user`. -> Must return `PERMISSION_DENIED`.
6. **Public Profile Blanket List**: Attempt collection-level `list` on `/users/{userId}/public` or `/users`. -> Must return `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Create `/users/u1/public/profile` with client-supplied past timestamp in `createdAt`. -> Must return `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Update `/users/u1/public/profile` modifying `createdAt` or `uid`. -> Must return `PERMISSION_DENIED`.
9. **Resource Poisoning (Oversized ID)**: Write to `/users/<200-char-invalid-id!>/public/profile`. -> Must return `PERMISSION_DENIED`.
10. **Value Poisoning (Oversized Display Name)**: Update `/users/u1/public/profile` with 500-char `displayName`. -> Must return `PERMISSION_DENIED`.
11. **Invalid Provider Enum**: Create `/users/u1/public/profile` with `authProvider: "ANON"`. -> Must return `PERMISSION_DENIED`.
12. **Self-Promotion to Admin**: Write `/admins/u1` as non-admin user `u1`. -> Must return `PERMISSION_DENIED`.
