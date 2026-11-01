import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_synthetic_dataset(n_normal=180, n_abnormal=20, random_state=42):
    """
    Generates synthetic gaming accounts with simulated round histories:
    - Normal accounts: Human-like variable timing (gaps of 5s to 45s with high variance),
      varied bet sizes (5 to 100), standard win/loss distributions.
    - Abnormal accounts:
        1. Automated high-frequency bots: constant timing (gaps exactly 0.5s or 1.0s, std ~ 0), high bets/min.
        2. Martingale / extreme spike bots: extreme bet spread and extreme sizing.
    """
    np.random.seed(random_state)
    accounts = []
    rounds_data = []

    base_time = datetime.now() - timedelta(hours=24)

    # 1. Normal Accounts
    for i in range(n_normal):
        user_id = f"usr_normal_{i:03d}"
        accounts.append({"user_id": user_id, "is_bot": False})

        # Number of rounds played over the day
        n_rounds = np.random.randint(15, 80)
        current_time = base_time + timedelta(minutes=np.random.randint(0, 1200))

        for r in range(n_rounds):
            # Human irregular gap: lognormal or exponential
            gap_seconds = float(np.random.exponential(scale=18.0) + 3.0)
            current_time += timedelta(seconds=gap_seconds)

            # Normal bet sizing
            bet_amount = int(np.random.choice([10, 20, 25, 50, 100], p=[0.4, 0.25, 0.15, 0.15, 0.05]))
            won = bool(np.random.rand() < 0.495)

            rounds_data.append({
                "user_id": user_id,
                "timestamp": current_time,
                "bet_amount": bet_amount,
                "won": won,
                "is_bot": False,
            })

    # 2. Abnormal / Injected Accounts (20 bots)
    for i in range(n_abnormal):
        user_id = f"usr_bot_{i:03d}"
        accounts.append({"user_id": user_id, "is_bot": True})

        n_rounds = np.random.randint(150, 400)
        current_time = base_time + timedelta(minutes=np.random.randint(0, 600))

        bot_type = i % 2

        for r in range(n_rounds):
            if bot_type == 0:
                # Ultra-regular timing bot (fixed interval with tiny noise: std < 0.05s)
                gap_seconds = float(np.random.normal(loc=1.2, scale=0.03))
                bet_amount = 50
            else:
                # High-frequency rapid fire bot
                gap_seconds = float(np.random.normal(loc=0.5, scale=0.02))
                bet_amount = int(np.random.choice([100, 500, 1000], p=[0.2, 0.5, 0.3]))

            current_time += timedelta(seconds=max(0.1, gap_seconds))
            won = bool(np.random.rand() < 0.495)

            rounds_data.append({
                "user_id": user_id,
                "timestamp": current_time,
                "bet_amount": bet_amount,
                "won": won,
                "is_bot": True,
            })

    accounts_df = pd.DataFrame(accounts)
    rounds_df = pd.DataFrame(rounds_data)

    return accounts_df, rounds_df

if __name__ == "__main__":
    accs, rds = generate_synthetic_dataset()
    print(f"Generated {len(accs)} accounts ({accs['is_bot'].sum()} bots) with {len(rds)} rounds.")

