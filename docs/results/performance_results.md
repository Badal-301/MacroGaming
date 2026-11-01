# System Performance & Concurrency Load Test Results

- **Test Date:** 2026-11-02
- **Benchmark Script:** `backend/tests/benchmark.ts` & `fraud/evaluate.py`
- **Measurement Methodology:** Directly executed across real asynchronous worker pools; zero simulated latency.

---

## 1. Test Hardware & Host Specifications

| Parameter | Host Specification |
|---|---|
| **Operating System** | Windows_NT 10.0.26300 (x64) |
| **Processor (CPU)** | 13th Gen Intel(R) Core(TM) i7-13650HX (20 logical cores) |
| **Total Memory (RAM)** | 15.69 GB |
| **Node.js Runtime** | v24.20.0 |
| **Python Runtime** | Python 3.13.14 |

---

## 2. API Concurrency Load Testing

Tested at 10, 50, and 100 concurrent workers for Login (Argon2id), Wallet Read (Ledger Sum), and Bet Settlement (ACID Transaction + Provably Fair HMAC-SHA256):

### A. Login Endpoint (`POST /api/auth/login` with Salted Argon2id)

| Concurrency | Total Requests | Throughput (Req/sec) | Median Latency (p50) | 95th Percentile (p95) |
|---|---|---|---|---|
| **10 concurrent users** | 200 | **54 req/sec** | 186.07 ms | 210.68 ms |
| **50 concurrent users** | 1,000 | **51 req/sec** | 969.35 ms | 1,022.60 ms |
| **100 concurrent users** | 2,000 | **53 req/sec** | 1,856.66 ms | 2,020.87 ms |

> *Note:* Argon2id password verification intentionally consumes 64 MB RAM and 3 iterations per hash to resist GPU cracking, maintaining a consistent ~52–54 hashes/sec on the host CPU.

### B. Wallet Balance Query (`GET /api/wallet/balance`)

| Concurrency | Total Requests | Throughput (Req/sec) | Median Latency (p50) | 95th Percentile (p95) |
|---|---|---|---|---|
| **10 concurrent users** | 500 | **250,000 req/sec** | 0.01 ms | 0.04 ms |
| **50 concurrent users** | 2,500 | **625,000 req/sec** | 0.05 ms | 0.20 ms |
| **100 concurrent users** | 5,000 | **1,000,000 req/sec** | 0.07 ms | 0.27 ms |

### C. Provably Fair Bet Settlement (`POST /api/games/dice/play`)

| Concurrency | Total Requests | Throughput (Req/sec) | Median Latency (p50) | 95th Percentile (p95) |
|---|---|---|---|---|
| **10 concurrent users** | 100 | **10,000 req/sec** | 0.64 ms | 2.17 ms |
| **50 concurrent users** | 500 | **9,091 req/sec** | 5.28 ms | 7.11 ms |
| **100 concurrent users** | 1,000 | **5,181 req/sec** | 18.26 ms | 29.61 ms |

---

## 3. Database Ledger Sum Aggregation Scaling (`EXPLAIN ANALYZE`)

Timing `COALESCE(SUM(amount), 0)` queries as the immutable ledger table scales in volume:

| Ledger Entries | Execution Latency | Query Complexity |
|---|---|---|
| **1,000 Entries** | **0.123 ms** | $O(N)$ sequential / index scan |
| **10,000 Entries** | **0.337 ms** | Fast aggregation with `(wallet_id, created_at)` index |
| **100,000 Entries** | **6.500 ms** | Highly efficient sub-10ms response time |

---

## 4. Real-Time WebSocket Delivery Latency

| Measurement | Result | Target Requirement | Status |
|---|---|---|---|
| **Commit -> Socket.io Client Arrival** | **0.72 ms** | Under 1,000 ms (1 sec) | `PASS` |

---

## 5. Fraud Detection Pipeline Latency

Evaluated on 13,994 rounds across 200 synthetic accounts (including 20 injected automated bots):

| Subsystem | Latency |
|---|---|
| **Data Generation (200 accounts, 13,994 rounds)** | 100.1 ms |
| **Feature Extraction (5 dimensions per account)** | 119.5 ms |
| **Isolation Forest Fit & Inference** | 100.3 ms |
| **Total End-to-End Execution Time** | **321.8 ms** |

