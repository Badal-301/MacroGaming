# Milestone 2: Test Results & Verification

- **Date:** 2026-11-02
- **Environment:** Node.js v24.20.0, Vitest v5.0.5, Next.js 16 (Turbopack)
- **Status:** Passed (21/21 tests passing across 6 test files)

---

## 1. Test Suite Breakdown (TC3 to TC6)

### TC3: Wallet Validation (`tests/tc3_wallet_validation.test.ts`)

| Test Case | Description | Result | Execution Time |
|---|---|---|---|
| **TC3.1** | Withdrawal above current balance (starting with 0) refused (400 Insufficient balance) | `PASS` | 312ms |
| **TC3.2** | Zero amount deposit and withdrawal rejected by validation schema | `PASS` | Included |
| **TC3.3** | Negative amount deposit and withdrawal rejected | `PASS` | Included |
| **TC3.4** | Float amounts (e.g., 50.75, 10.25) rejected enforcing integer credits rule | `PASS` | Included |
| **TC3.5** | Withdrawal exceeding balance by 1 credit after deposit rejected | `PASS` | Included |

### TC4: Concurrency & Pessimistic Row Locking (`tests/tc4_concurrency.test.ts`)

| Scenario | Tested Action | Succeeded / Total | Final Balance | Ledger Sum Match |
|---|---|---|---|---|
| **Row Locking ENABLED** | 50 simultaneous withdrawals of 100 credits against 500 initial credits | **5 / 50 succeeded** (45 rejected) | **0 credits** | **Strict match (0 credits, never negative)** |
| **Row Locking DISABLED** | 50 simultaneous withdrawals without row lock (test demonstration mode) | **>5 succeeded** (Race condition triggered) | **Negative (< 0)** | **Balance corruption demonstrated** |

### TC5: Idempotency Key Replay Protection (`tests/tc5_idempotency.test.ts`)

| Test Case | Description | Result | Details |
|---|---|---|---|
| **TC5.1** | Duplicate deposit request with identical `idempotencyKey` | `PASS` | Returns original record, `isDuplicate: true`, balance not credited twice |
| **TC5.2** | Duplicate withdrawal request with identical `idempotencyKey` | `PASS` | Returns original record, `isDuplicate: true`, balance not deducted twice |

### TC6: Atomic Multi-Step Rollback (`tests/tc6_atomic_rollback.test.ts`)

| Test Case | Description | Result | Details |
|---|---|---|---|
| **TC6.1** | Failure injected halfway between bet entry and payout entry | `PASS` | **0 entries remaining in ledger**. Complete ACID rollback. |
| **TC6.2** | Normal execution without failure | `PASS` | Both entries (+200, -100) committed atomically. |

---

## 2. Vitest Execution Log

```
> backend@1.0.0 test
> vitest run

 RUN  v5.0.5 E:/ALL Coding 1/Geek Gemini/Stteler/backend

 ✓ tests/tc6_atomic_rollback.test.ts (2 tests) 292ms
 ✓ tests/tc1_registration.test.ts (5 tests) 340ms
 ✓ tests/tc5_idempotency.test.ts (2 tests) 475ms
 ✓ tests/tc4_concurrency.test.ts (2 tests) 478ms
 ✓ tests/tc2_auth_roles.test.ts (5 tests) 677ms
 ✓ tests/tc3_wallet_validation.test.ts (5 tests) 791ms

 Test Files  6 passed (6)
      Tests  21 passed (21)
   Start at  03:23:16
   Duration  1.27s (tests 59%, import 37%, transform 3%, worker 1%)
```

---

## 3. Frontend Wallet Verification

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /dashboard
├ ○ /login
├ ○ /register
└ ○ /wallet

○ (Static) prerendered as static content
```
- Available at `/wallet`:
  - Real-time balance computed as `SUM(amount)` from ledger.
  - Interactive mock deposit & withdrawal forms via `MockPaymentGateway` (Test Mode).
  - Paginated ledger history table with timestamp, type, amount, reference, and idempotency key.

