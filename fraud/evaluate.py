import sys
import time
from synthetic_data import generate_synthetic_dataset
from detector import extract_account_features, train_and_flag_anomalies

def evaluate_fraud_detection():
    print("==================================================================")
    print("   FRAUD & ANOMALY DETECTION EVALUATION (ISOLATION FOREST)        ")
    print("==================================================================")

    t0 = time.time()
    accounts_df, rounds_df = generate_synthetic_dataset(n_normal=180, n_abnormal=20, random_state=42)
    gen_time = time.time() - t0

    print(f"Generated {len(accounts_df)} synthetic accounts with {len(rounds_df)} betting rounds.")
    print(f"Data Generation Time: {gen_time*1000:.1f} ms")

    # Feature extraction
    t1 = time.time()
    features_df = extract_account_features(rounds_df)
    feat_time = time.time() - t1
    print(f"Feature Extraction Time: {feat_time*1000:.1f} ms across {len(features_df)} accounts.")

    # Isolation Forest fit & predict
    t2 = time.time()
    flagged_df = train_and_flag_anomalies(features_df, contamination=0.10)
    model_time = time.time() - t2
    print(f"Model Training & Inference Time: {model_time*1000:.1f} ms")

    # Merge ground truth
    merged = flagged_df.merge(accounts_df, on="user_id")

    tp = len(merged[(merged["is_bot"] == True) & (merged["is_flagged"] == True)])
    fn = len(merged[(merged["is_bot"] == True) & (merged["is_flagged"] == False)])
    fp = len(merged[(merged["is_bot"] == False) & (merged["is_flagged"] == True)])
    tn = len(merged[(merged["is_bot"] == False) & (merged["is_flagged"] == False)])

    total_injected = tp + fn
    recall = tp / total_injected if total_injected > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    total_time_ms = (time.time() - t0) * 1000

    print("\n--- Model Performance Metrics ---")
    print(f"Injected Bots (Ground Truth Positive): {total_injected}")
    print(f"True Positives (Bots Correctly Flagged): {tp} / {total_injected} ({recall*100:.1f}% Recall)")
    print(f"False Positives (Normal Accounts Wrongly Flagged): {fp} ({fp/len(accounts_df)*100:.1f}%)")
    print(f"False Negatives (Missed Bots): {fn}")
    print(f"Precision: {precision*100:.1f}%")
    print(f"Total Fraud Job Pipeline Latency: {total_time_ms:.1f} ms")

    print("\n--- Sample Flagged Accounts & Reasons ---")
    flagged_samples = flagged_df[flagged_df["is_flagged"]].head(5)
    for _, row in flagged_samples.iterrows():
        print(f"  User: {row['user_id']} | Score: {row['anomaly_score']} | Reason: {row['reason']}")

    print("==================================================================")

    # Verification threshold: at least 80% of injected bot accounts must be detected
    if recall >= 0.80:
        print("[PASS] TC13 PASSED: Synthetic abnormal accounts successfully identified by fraud model.")
        return True
    else:
        print("[FAIL] TC13 FAILED: Detection rate fell below acceptable threshold.")
        sys.exit(1)

if __name__ == "__main__":
    evaluate_fraud_detection()

