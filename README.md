# Educational Gaming Platform (Virtual Currency Only)

> **MANDATORY NOTICE:** Educational simulation only. No real money, payment gateway, or actual cash payouts are involved. All wagering is conducted strictly using test credits to demonstrate secure, concurrency-safe, and cryptographically verifiable transaction architecture.

---

## 1. Project Overview

This full-stack application simulates an online transaction platform with games as the domain. Developed as a college project, its primary objective is to demonstrate enterprise-grade engineering principles:
1. **Append-Only Accounting:** Balances are never stored as mutable columns. The available balance is always the dynamic sum of immutable ledger entries.
2. **Pessimistic Row-Level Concurrency:** Strict `SELECT ... FOR UPDATE` row locks prevent race conditions and double-spending under high concurrent load.
3. **Provably Fair Commit-Reveal Cryptography:** Out-of-band SHA-256 seed commitments and HMAC-SHA256 deterministic outcome derivations guarantee zero operator manipulation.
4. **Zero-Trust Client Boundary:** The browser is strictly untrusted. The server governs all calculations, validations, seed reveals, and permissions.
5. **Responsible Gaming by Design:** Server-enforced loss streak cooling-off, session bet ceilings, and irreversible self-exclusion periods.
6. **Asynchronous Fraud & Bot Detection:** An isolated Python Isolation Forest machine learning pipeline flags automated bots and behavioral anomalies without blocking the critical transaction request path.

---

## 2. Tech Stack

| Domain | Technology Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js 16 (React, Tailwind CSS, TypeScript) | Strict-mode typed components, responsive layouts, client-side real-time state |
| **Backend** | Node.js + Express + Socket.io (TypeScript) | High-throughput asynchronous event loop hosting HTTP endpoints & WebSockets on the same port |
| **Database** | PostgreSQL with Prisma ORM 6 | Parameterized queries immune to SQL injection, explicit row-locking transactions |
| **Real-time Layer** | Socket.io | Authenticated handshakes, per-user room routing, instant multi-tab sync (< 1ms delay) |
| **Caching & Limits**| Redis / In-Memory Mock Fallback | Sliding window rate limiting counters per IP and account |
| **Password Hashing**| Argon2id | Memory-hard cryptographic hashing (64MB RAM, 3 iterations) resisting GPU cracking |
| **Tokens & Auth**   | JSON Web Tokens (JWT) + SHA-256 Refresh Hashes | 15-minute access tokens with rotating single-use refresh tokens and reuse invalidation |
| **Validation**      | Zod | Strict schema validation rejecting unknown or injected body properties |
| **Cryptography**    | Node.js built-in `crypto` module only | `randomBytes`, `createHash('sha256')`, `createHmac('sha256')` |
| **Anomaly Detection**| Python 3.11+, scikit-learn, pandas | Multi-feature Isolation Forest bot classifier running in a dedicated container |
| **Automated Tests** | Vitest & Python | 13 test suites (TC1 to TC13) covering concurrency, crypto verification, and fraud detection |

---

## 3. Repository Architecture

```text
Stteler/
├── backend/                     # Node.js backend Web Service (Render / Docker)
│   ├── prisma/
│   │   ├── schema.prisma        # 7-table schema with indexes and relations
│   │   └── seed.ts              # Database seed script (Admin, Players, Ledger, Fraud)
│   ├── src/
│   │   ├── config/              # Typed environment variables & protection thresholds
│   │   ├── db/                  # Prisma client & in-memory testing abstraction
│   │   ├── middlewares/         # JWT auth guards, Zod validators, Redis rate limiters
│   │   ├── modules/
│   │   │   ├── auth/            # Registration, Argon2id login, refresh rotation
│   │   │   ├── wallet/          # ACID ledger transactions, mock gateway, idempotency
│   │   │   ├── fairness/        # SHA-256 commit-reveal & HMAC-SHA256 calculations
│   │   │   ├── games/
│   │   │   │   ├── dice/        # Provably Fair Classic Dice (0.00 – 99.99)
│   │   │   │   └── blackjack/   # Provably Fair Blackjack (Fisher-Yates deck shuffle)
│   │   │   ├── protection/      # Cooldowns, session bet caps, self-exclusion
│   │   │   ├── realtime/        # Socket.io authenticated rooms & live event emitter
│   │   │   └── admin/           # Administrative risk overview & user management
│   │   ├── app.ts               # Express application pipeline & security headers
│   │   └── server.ts            # HTTP + Socket.io server entrypoint
│   ├── tests/                   # Automated Vitest test suites (TC1 to TC12) + Benchmark
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                    # Next.js frontend Web Service (Render / Docker)
│   ├── src/
│   │   ├── app/                 # Next.js App Router (Dashboard, Wallet, Dice, Blackjack, Verify, Settings, Admin)
│   │   ├── components/          # Educational banner, navigation bar, card graphics
│   │   └── context/             # AuthContext with automated Socket.io sync hook
│   ├── Dockerfile
│   └── package.json
│
├── fraud/                       # Dedicated Python Anomaly Detection Service
│   ├── detector.py              # Behavioral feature engineering & Isolation Forest model
│   ├── synthetic_data.py        # 200-account generator with 20 injected bot behaviors
│   ├── evaluate.py              # Statistical evaluation script (Precision, Recall, Latency)
│   ├── Dockerfile
│   └── requirements.txt
│
├── docs/                        # Formal academic documentation & diagrams
│   ├── architecture.md          # System architecture & Trust Boundary diagram (Mermaid)
│   ├── er_diagram.md            # Seven-table entity relationship diagram (Mermaid)
│   ├── bet_flow.md              # 7-step transaction execution sequence & rollback path
│   └── results/                 # Verified real numbers from actual test runs
│       ├── milestone1_results.md
│       ├── milestone2_results.md
│       ├── milestone3_results.md
│       ├── milestone4_results.md
│       └── performance_results.md
│
├── docker-compose.yml           # Multi-container orchestration (5 services)
├── render.yaml                  # 1-click Render Blueprint specification
├── .env.example                 # Environment configuration template
└── README.md
```

---

## 4. Provably Fair Protocol: Step-by-Step Worked Example

The platform eliminates operator bias using an audited **Commit-Reveal** cryptographic scheme:

### Worked Example:
1. **Commitment Phase (Pre-Bet):**
   - The server creates a secret 32-byte seed:
     ```text
     Server Seed: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
     ```
   - The server computes its SHA-256 hash and publishes it to the client *before* the bet is placed:
     ```text
     Server Seed Hash: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
     Nonce: 1
     ```
2. **Player Input Phase:**
   - The player supplies their own entropy (client seed) and picks a target:
     ```text
     Client Seed: "player_custom_seed_42"
     Target: Roll under 50.00
     ```
3. **Outcome Calculation (Server-Side):**
   - The server computes HMAC-SHA256 over message `${clientSeed}:${nonce}`:
     ```text
     HMAC Message: "player_custom_seed_42:1"
     HMAC Output: "4a2b9f81cd45... (64 hex characters)"
     ```
   - Extract the first 4 bytes (`4a2b9f81`), convert to unsigned 32-bit integer:
     $$\text{Integer} = \text{0x4A2B9F81} = 1,244,372,865$$
   - Divide by $2^{32} = 4,294,967,296$:
     $$\text{Float} = \frac{1,244,372,865}{4,294,967,296} \approx 0.289727...$$
   - Scale to range $[0.00, 99.99]$:
     $$\text{Roll} = \lfloor 0.289727 \times 10,000 \rfloor / 100 = 28.97$$
4. **Settlement & Revelation:**
   - Because $28.97 < 50.00$, the player wins.
   - The server reveals the plaintext `serverSeed`.
   - Any player can navigate to `/verify` to recompute the SHA-256 hash and re-derive the roll of `28.97`.

---

## 5. Mathematical Game Analysis

### Game 1: Classic Dice
- **Range:** $0.00$ to $99.99$ ($10,000$ discrete values).
- **Rule:** Roll Under Target ($1.00 \le \text{target} \le 98.00$).
- **House Edge:** Fixed constant at **$1.00\%$** (`DICE_HOUSE_EDGE = 0.01`).
- **Payout Multiplier Formula:**
  $$\text{Multiplier} = \frac{100 - \text{House Edge}}{\text{Target}} = \frac{99}{\text{Target}}$$
- **Expected Value ($EV$):**
  $$EV = P(\text{Win}) \times \text{Multiplier} - P(\text{Loss}) \times 1$$
  $$EV = \left(\frac{\text{Target}}{100}\right) \times \left(\frac{99}{\text{Target}}\right) - \left(1 - \frac{\text{Target}}{100}\right) = 0.99 - 1 = -0.01 \text{ (or } -1.00\%)$$

### Game 2: Provably Fair Blackjack
- **Deck Structure:** Standard 52-card deck shuffled with Fisher-Yates HMAC cursors.
- **Rules:** Dealer stands on all 17s; player natural 21 pays **3:2** ($\text{bet} \times 2.5$).
- **Theoretical House Edge:** $\approx 0.50\%$ with basic strategy.

---

## 6. How to Run the Project

### Option A: Local Development

#### Prerequisites
- Node.js v20+ or v24+
- Python 3.10+
- PostgreSQL & Redis (optional if running in standalone test mode)

#### 1. Setup Backend
```bash
cd backend
npm install
npx prisma generate
npm run build
npm start # Starts API & WebSockets on port 4000
```

#### 2. Setup Frontend
```bash
cd ../frontend
npm install
npm run build
npm start # Starts Next.js on port 3000
```

#### 3. Run Automated Tests
```bash
cd ../backend
npm test # Runs all 13 Vitest suites (TC1 to TC13)
```

#### 4. Run System Benchmark & Load Test
```bash
cd ../backend
npx tsx tests/benchmark.ts
```

#### 5. Run Python Fraud Detection Evaluation
```bash
cd ../fraud
python evaluate.py
```

---

### Option B: Docker Compose (All Services)

To run the entire platform with PostgreSQL, Redis, Backend, Frontend, and the Fraud container:

```bash
docker compose up --build
```

Access the applications:
- **Frontend Web UI:** `http://localhost:3000`
- **Backend API & WebSockets:** `http://localhost:4000`
- **Database Connection:** `postgresql://postgres:postgrespassword@localhost:5432/gaming_simulation`

---

### Option C: 1-Click Deployment to Render

This repository is pre-configured with a root `render.yaml` Blueprint file:
1. Push this repository to GitHub or GitLab.
2. In your Render Dashboard, click **New +** -> **Blueprint**.
3. Select this repository.
4. Render will automatically provision:
   - Managed **PostgreSQL Database** (`gaming-postgres`)
   - Managed **Redis instance** (`gaming-redis`)
   - **Backend Web Service** from `backend/`
   - **Frontend Web Service** from `frontend/`

---

## 7. Verification Test Suite Matrix (TC1 to TC13)

| ID | Description | Location | Verified Status |
|---|---|---|---|
| **TC1** | Registration rejects duplicate email, weak password (<8 chars, no digit), malformed format | `backend/tests/tc1_registration.test.ts` | **PASS (5/5)** |
| **TC2** | Player tokens refused by admin endpoints (403); expired and altered JWTs rejected | `backend/tests/tc2_auth_roles.test.ts` | **PASS (5/5)** |
| **TC3** | Withdrawal above balance, zero amounts, negative amounts, and float credits refused | `backend/tests/tc3_wallet_validation.test.ts` | **PASS (5/5)** |
| **TC4** | 50 simultaneous withdrawals against limited balance with `SELECT ... FOR UPDATE` row locking | `backend/tests/tc4_concurrency.test.ts` | **PASS (2/2)** |
| **TC5** | Idempotency key replay protection (same key sent twice processed exactly once) | `backend/tests/tc5_idempotency.test.ts` | **PASS (2/2)** |
| **TC6** | Injected mid-transaction failure triggers complete rollback (0 entries left in ledger) | `backend/tests/tc6_atomic_rollback.test.ts` | **PASS (2/2)** |
| **TC7** | Provably fair verification: revealed seed matches hash, recomputed roll matches stored | `backend/tests/tc7_provably_fair.test.ts` | **PASS (2/2)** |
| **TC8** | **100,000 simulated rounds**: Pearson's Chi-Square Goodness-of-Fit test ($\chi^2 < 6.635$) | `backend/tests/tc8_simulation_100k.test.ts` | **PASS (1/1)** |
| **TC9** | Client request carrying altered outcome or payout is completely ignored by server | `backend/tests/tc9_client_tamper.test.ts` | **PASS (1/1)** |
| **TC10**| SQL injection immunity; 6th login attempt within 1 minute refused with 429 Too Many Requests | `backend/tests/tc10_security_ratelimit.test.ts` | **PASS (2/2)** |
| **TC11**| Socket.io handshake without token refused; live balance push delivered across clients | `backend/tests/tc11_realtime_socket.test.ts` | **PASS (2/2)** |
| **TC12**| Personal session bet limits, loss streak cooldown (5 losses), and self-exclusion block bets | `backend/tests/tc12_protection.test.ts` | **PASS (3/3)** |
| **TC13**| Python Isolation Forest job flags synthetic abnormal accounts with $\ge 80\%$ recall | `backend/tests/tc13_fraud_detection.test.ts` | **PASS (1/1)** |

**Total:** 33 tests across 13 test suites — **100% Passing**. Real recorded results are archived in [`docs/results/`](file:///e:/ALL%20Coding%201/Geek%20Gemini/Stteler/docs/results/).

---

## 8. Default Academic Demo Credentials

If seeded using `npm run seed`:
- **Admin Account:** `admin@platform.edu` / `Password123!`
- **Demo Player (Active):** `alice@student.edu` / `Password123!` (Balance: 1,998 Credits)
- **Demo Player (Cooldown):** `bob@student.edu` / `Password123!`
- **Demo Player (Self-Excluded):** `charlie@student.edu` / `Password123!`

