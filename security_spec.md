# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. Only verified store administrators (bootstrapped owner email `AzozSindi23@gmail.com` with `email_verified == true`, or a UID present in `/admins/{uid}` with `email_verified == true`) may create, update, or delete `/site_settings/banner` or `/admins/{userId}`.
2. Storefront visitors (authenticated or unauthenticated) may ONLY `get` the single public document `/site_settings/banner`. Listing `/site_settings` or reading arbitrary setting IDs is denied.
3. Every write to `/site_settings/banner` MUST pass `isValidBannerConfig(incoming())`: strict allowlist of keys (`isActive`, `text`, `ctaLabel`, `ctaTarget`, `theme`, `dismissible`, `updatedAt`, `updatedBy`), exact types, bounded string lengths (`text` 1..140, `ctaLabel` 0..40), strict enums (`ctaTarget`, `theme`), `updatedBy == request.auth.uid`, and `updatedAt == request.time`.
4. Path variables `{settingId}` and `{userId}` MUST pass `isValidId(...)` (`^[a-zA-Z0-9_\-]+$`, `size() <= 128`).
5. `/admins/{userId}` can never be self-assigned by non-admins; only existing verified admins can add/remove other admins.

## 2. The "Dirty Dozen" Attack Payloads (All Must Yield `PERMISSION_DENIED`)
1. Unauthenticated write to `/site_settings/banner`.
2. Signed-in non-admin user attempts to `set` or `update` `/site_settings/banner`.
3. Spoofed admin email where `request.auth.token.email == 'AzozSindi23@gmail.com'` but `email_verified == false`.
4. Self-privilege escalation: non-admin user attempts `create` on `/admins/{request.auth.uid}` with `{ "role": "admin" }`.
5. Shadow field injection on `/site_settings/banner` (e.g., adding `"isVerified": true` or `"extraScript": "<script>"`).
6. Oversized `text` string (> 140 characters, e.g., 10KB DoW payload) written to `/site_settings/banner`.
7. Empty `text` (`""`) or wrong type (`text: 123`) written to `/site_settings/banner`.
8. Invalid `ctaTarget` enum value (`"https://evil.example.com"`) injected to hijack banner clicks.
9. Invalid `theme` enum value (`"neon-purple"`) written to `/site_settings/banner`.
10. Spoofed `updatedBy` UID (`"other-uid" != request.auth.uid`) or client-forged `updatedAt` timestamp (`!= request.time`).
11. Unauthorized `list` query on `/site_settings` or `/admins` by unauthenticated or non-admin users.
12. Path poisoning: attempting to read/write `/site_settings/../../evil` or 1.5KB document ID failing `isValidId()`.
