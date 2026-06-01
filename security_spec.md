# Security Spec: UmrahGo AI Agent

## Data Invariants
1. A booking must belong to a valid user.
2. A user can only access their own bookings and profile.
3. Passport data is sensitive and must only be visible to the owner.
4. Agent logs are read-only for users (only agents can write them, but since we use client SDK, we'll allow owners to write their own logs for simulation purposes, or restrict it to a backend agent if we had custom claims, but here we'll assume owner writes for the demo flow).

## The Dirty Dozen Payloads (Target: Access Control & Integrity)
1. **Identity Spoofing**: Attempt to create a booking with `userId: "malicious_user"` while authenticated as `victim_user`.
2. **PII Leak**: Authenticated user attempts to 'get' a booking document belonging to another user.
3. **State Shortcutting**: Attempt to update booking status to `confirmed` without going through the `processing` flow.
4. **ID Poisoning**: Attempt to create a booking with a document ID that is 2KB long.
5. **Timestamp Fraud**: Attempt to set `createdAt` to a past date instead of `request.time`.
6. **Shadow Fields**: Attempt to add `isAdmin: true` to a user profile update.
7. **Orphaned Log**: Attempt to create an agent log for a booking that the user doesn't own.
8. **Malicious Payload**: Injecting raw HTML or script into the `agentName` field.
9. **Quota Exhaustion**: Sending a 1MB string in the `passportNumber` field.
10. **Terminal Lock Breach**: Trying to edit a `confirmed` booking.
11. **Email Spoofing**: Attempting to read a profile where `email_verified` is false (if we mandated verification).
12. **Blanket Query**: Querying `bookings` without a `where('userId', '==', uid)` filter.

## Test Runner: firestore.rules.test.ts
(This is a conceptual test runner for current environment)
- Verify `PERMISSION_DENIED` for cross-user access.
- Verify `PERMISSION_DENIED` for invalid schemas.
- Verify `PERMISSION_DENIED` for immutable field modification.
