# Security Specification — Orange Pro B2B Firestore Rules

## 1. Data Invariants & Master Source of Truth
- **Owner Isolation (PII Protection)**: Every document in `/users/{userId}`, `/users/{userId}/fiches/{ficheId}`, and `/users/{userId}/skills/{skillId}` contains B2B prospect PII (`telephone`, `email`, `contact`) or private commercial configuration. Only the authenticated, email-verified owner (`request.auth.uid == userId` and `request.auth.token.email_verified == true`) can read, list, create, update, or delete their own documents.
- **Master Gate**: Subcollection writes on `/users/{userId}/fiches/{ficheId}` and `/users/{userId}/skills/{skillId}` require the parent workspace document `/users/{userId}` to exist (`exists(...)`), preventing orphaned sub-records.
- **Temporal & Identity Integrity**: `ownerId` and `createdAt` are strictly immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on create/update.
- **Strict Schema & Bounds**: Every string has an explicit `.size()` ceiling, every array has a bounded `.size()` + first-element type check, every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128`), and every write enforces exact `hasAll` / `hasOnly` / `affectedKeys().hasOnly(...)` gates.

## 2. The "Dirty Dozen" Payloads (All MUST return PERMISSION_DENIED)
1. **Unauthenticated read**: Unauthenticated user tries `get` or `list` on `/users/u1/fiches`.
2. **Unverified email write**: Authenticated user with `email_verified: false` tries to create `/users/u1`.
3. **Cross-user PII read**: Verified user `u2` tries `get` on `/users/u1/fiches/mk-1`.
4. **Cross-user list query**: Verified user `u2` tries `list` on `/users/u1/fiches`.
5. **Identity spoofing on create**: Verified user `u1` tries to create `/users/u1/fiches/f1` with `ownerId: "u2"`.
6. **Shadow/Ghost field injection on create**: Verified user `u1` sends `isAdmin: true` in `/users/u1/fiches/f1`.
7. **Shadow/Ghost field injection on update**: Verified user `u1` updates `/users/u1/fiches/f1` adding unknown key `creditLimit: 999999`.
8. **Immutable field tampering**: Verified user `u1` tries to modify `ownerId` or `createdAt` during an update.
9. **Client-forged timestamp**: Verified user `u1` supplies a past/future `updatedAt` instead of `serverTimestamp()` (`request.time`).
10. **ID poisoning**: Verified user `u1` tries to create `/users/u1/fiches/bad$id!with*spaces` or a 200-char document ID.
11. **Oversized string / Denial-of-Wallet**: Verified user `u1` sends a 5,000-char `societe` string or 100-element `villesAll` array.
12. **Invalid enum / orphaned subcollection write**: Verified user `u1` creates a fiche with `secteur: "crypto_scam"` or before parent `/users/u1` exists.
