import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import psycopg2

def extract_account_features(rounds_df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts behavioral features per user account:
    - bets_per_minute
    - mean_bet_size
    - spread_bet_size (std)
    - timing_regularity (std dev of inter-bet time deltas)
    - longest_streak (max consecutive wins or losses)
    """
    features = []

    for user_id, group in rounds_df.groupby("user_id"):
        group = group.sort_values("timestamp")
        n_bets = len(group)

        if n_bets < 2:
            continue

        # Inter-bet timing intervals (in seconds)
        time_deltas = group["timestamp"].diff().dropna().dt.total_seconds()
        timing_std = float(time_deltas.std()) if len(time_deltas) > 1 else 999.0
        active_minutes = max(0.5, (group["timestamp"].max() - group["timestamp"].min()).total_seconds() / 60.0)
        bets_per_min = float(n_bets / active_minutes)

        # Bet sizing
        bet_mean = float(group["bet_amount"].mean())
        bet_std = float(group["bet_amount"].std()) if len(group) > 1 else 0.0

        # Longest streak calculation
        won_series = group["won"].values
        max_streak = 1
        current_streak = 1
        for i in range(1, len(won_series)):
            if won_series[i] == won_series[i - 1]:
                current_streak += 1
                if current_streak > max_streak:
                    max_streak = current_streak
            else:
                current_streak = 1

        features.append({
            "user_id": user_id,
            "total_bets": n_bets,
            "bets_per_minute": bets_per_min,
            "mean_bet_size": bet_mean,
            "spread_bet_size": bet_std,
            "timing_regularity": timing_std,
            "longest_streak": max_streak,
        })

    return pd.DataFrame(features)

def generate_plain_reason(row: pd.Series) -> str:
    """
    Generates human-readable explanation of why the account was flagged
    """
    reasons = []
    if row["timing_regularity"] < 0.2:
        reasons.append("Ultra-regular bot-like bet timing (std < 0.2s)")
    if row["bets_per_minute"] > 15.0:
        reasons.append(f"Abnormally high bet frequency ({row['bets_per_minute']:.1f} bets/min)")
    if row["mean_bet_size"] > 400.0:
        reasons.append(f"Unusually large average bet size ({row['mean_bet_size']:.0f} credits)")
    if row["spread_bet_size"] > 300.0:
        reasons.append("Extreme bet spread volatility")

    if not reasons:
        reasons.append("Multivariate anomaly pattern detected by Isolation Forest")

    return "; ".join(reasons)

def train_and_flag_anomalies(features_df: pd.DataFrame, contamination: float = 0.08) -> pd.DataFrame:
    """
    Trains Isolation Forest on behavior vectors and flags the most anomalous accounts
    """
    feature_cols = [
        "bets_per_minute",
        "mean_bet_size",
        "spread_bet_size",
        "timing_regularity",
        "longest_streak",
    ]

    X = features_df[feature_cols].copy()
    # Normalize timing regularity inverse so smaller variance (robotic consistency) stands out as an extreme
    X["robotic_timing"] = 1.0 / (X["timing_regularity"] + 0.01)
    X = X.drop(columns=["timing_regularity"])

    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)

    # Scikit-learn outputs -1 for anomalies, 1 for inliers
    preds = model.predict(X)
    scores = model.decision_function(X)

    # Normalize anomaly score to [0.0, 1.0] where 1.0 is most anomalous
    min_score, max_score = scores.min(), scores.max()
    normalized_scores = 1.0 - ((scores - min_score) / (max_score - min_score + 1e-6))

    features_df["is_flagged"] = preds == -1
    features_df["anomaly_score"] = np.round(normalized_scores, 4)
    features_df["reason"] = features_df.apply(
        lambda r: generate_plain_reason(r) if r["is_flagged"] else "Normal", axis=1
    )

    return features_df

def run_db_fraud_job():
    """
    Standalone runner that queries live Postgres and inserts detected fraud_flags
    """
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not set. Running in demo simulation mode.")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Query rounds from past 24 hours
        query = """
            SELECT user_id, created_at as timestamp, bet_amount, 
                   (payout_amount > 0) as won 
            FROM game_rounds 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        """
        rounds_df = pd.read_sql_query(query, conn)

        if len(rounds_df) < 5:
            print("Not enough rounds in the last 24 hours to train fraud model.")
            return

        features_df = extract_account_features(rounds_df)
        flagged_df = train_and_flag_anomalies(features_df)

        anomalies = flagged_df[flagged_df["is_flagged"]]
        print(f"Detected {len(anomalies)} anomalous accounts.")

        for _, row in anomalies.iterrows():
            cur.execute("""
                INSERT INTO fraud_flags (id, user_id, anomaly_score, reason, status, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, 'open', NOW())
            """, (row["user_id"], float(row["anomaly_score"]), row["reason"]))

        conn.commit()
        cur.close()
        conn.close()
        print("Successfully updated fraud_flags in database.")
    except Exception as e:
        print(f"Error executing database fraud job: {e}")

if __name__ == "__main__":
    run_db_fraud_job()

