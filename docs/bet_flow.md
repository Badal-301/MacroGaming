# The Seven-Step Bet Execution Flow (With Atomic Rollback)

Every game round executes through a strict 7-step transaction pipeline ensuring cryptographic fairness, responsible gaming enforcement, and ACID ledger consistency.

```mermaid
sequenceDiagram
    autonumber
    actor Player as Player (Untrusted Browser)
    participant Guard as Middleware & Security
    participant Protect as Protection Module
    participant DB as PostgreSQL Transaction
    participant Engine as Provably Fair Engine
    participant Socket as Real-Time Socket.io

    Note over Player,Engine: Step 0: Commitment Phase
    Player->>Engine: Request Round Start
    Engine-->>Player: Return server_seed_hash & nonce (Commitment)

    Note over Player,Socket: 7-Step Bet Execution
    Player->>Guard: 1. Submit Bet (token, roundId, clientSeed, target, betAmount, idempotencyKey)
    Guard->>Guard: 2. Validate Zod Schema, JWT token & Redis Rate Limit

    Guard->>Protect: 3. Verify Responsible Gaming Status
    alt Account in Cooldown or Self-Excluded or Bet > Limit
        Protect-->>Player: Return 403 Forbidden (Bet Aborted)
    end

    Guard->>DB: 4. Open Transaction: SELECT id FROM wallets WHERE id = $1 FOR UPDATE
    DB->>DB: Sum Ledger Entries: COALESCE(SUM(amount), 0)
    alt Balance < Bet Amount
        DB-->>Player: Rollback & Return 400 Insufficient Balance
    end

    DB->>Engine: 5. Compute Outcome with HMAC-SHA256(serverSeed, clientSeed:nonce)
    Engine-->>DB: Return Deterministic Roll & Payout Multiplier

    DB->>DB: 6. Write Entries Atomically
    Note over DB: Insert Debit: { type: 'bet', amount: -betAmount }
    alt Player Won
        Note over DB: Insert Credit: { type: 'payout', amount: +payoutAmount }
    end
    Note over DB: Update game_rounds { status: 'completed', server_seed: revealedSeed }

    alt Mid-Transaction System Crash / Constraint Failure
        DB->>DB: ROLLBACK TRANSACTION (Zero entries left in ledger)
        DB-->>Player: Return 500 Internal Error (Account Unchanged)
    else Transaction Committed
        DB->>DB: COMMIT TRANSACTION
    end

    DB->>Socket: 7. Emit balance_updated & game_result to user:${userId}
    DB-->>Player: Return Resolution (Roll, Win/Loss, Payout, Revealed serverSeed)
    Socket-->>Player: Live Multi-Tab Balance Synchronized (< 1ms)
```

