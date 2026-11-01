# Seven-Table Database ER Diagram

The database uses integer credits (no floats) for all transaction amounts. Wallets contain no mutable balance field — balance is dynamically computed as `COALESCE(SUM(amount), 0)` over `ledger_entries`.

```mermaid
erDiagram
    users ||--o| wallets : "owns (1:1)"
    users ||--o| user_limits : "has limits (1:1)"
    users ||--o{ refresh_tokens : "issues (1:N)"
    users ||--o{ game_rounds : "plays (1:N)"
    users ||--o{ fraud_flags : "flagged by model (1:N)"
    users ||--o{ fraud_flags : "reviewed by admin (0..1:N)"
    wallets ||--o{ ledger_entries : "contains (1:N)"

    users {
        String id PK "UUID"
        String email UK "Unique email address"
        String password_hash "Salted Argon2id hash"
        Enum role "player | admin"
        DateTime created_at "Account creation timestamp"
        DateTime self_excluded_until "Nullable self-exclusion expiry"
        DateTime cooldown_until "Nullable cooling-off expiry"
    }

    wallets {
        String id PK "UUID (Row Lock Target)"
        String user_id UK, FK "Foreign Key to users.id"
    }

    ledger_entries {
        String id PK "UUID"
        String wallet_id FK "Foreign Key to wallets.id"
        Enum type "deposit | withdrawal | bet | payout"
        Int amount "Signed integer (credits)"
        String reference "Round ID or gateway reference"
        String idempotency_key UK "Unique request deduplication key"
        DateTime created_at "Index: (wallet_id, created_at)"
    }

    game_rounds {
        String id PK "UUID"
        String user_id FK "Foreign Key to users.id"
        String game_type "dice | blackjack"
        String server_seed_hash "SHA-256 published commitment"
        String server_seed "Revealed 32-byte seed post-round"
        String client_seed "Player-provided entropy"
        Int nonce "Rising counter per user"
        Int bet_amount "Integer wager"
        Json outcome "Deterministic roll or card sequence"
        Int payout_amount "Awarded credits (0 on loss)"
        String status "started | in_progress | completed"
        DateTime created_at "Index: (user_id, created_at)"
    }

    user_limits {
        String user_id PK, FK "Foreign Key to users.id"
        Int session_bet_limit "Max allowable bet per round"
        Int deposit_limit "Max single deposit amount"
        DateTime updated_at "Last update timestamp"
    }

    fraud_flags {
        String id PK "UUID"
        String user_id FK "Target account"
        Float anomaly_score "Normalized Isolation Forest score"
        String reason "Plain-language diagnostic rationale"
        Enum status "open | reviewed"
        String reviewed_by FK "Admin user ID who reviewed flag"
        DateTime created_at "Flag generation timestamp"
    }

    refresh_tokens {
        String id PK "UUID"
        String user_id FK "Foreign Key to users.id"
        String token_hash "SHA-256 hash of refresh token"
        DateTime expires_at "Expiration timestamp"
        DateTime revoked_at "Nullable revocation timestamp"
    }
```

