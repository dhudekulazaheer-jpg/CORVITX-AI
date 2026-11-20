import os
import csv
import math
import numpy as np
import time

REAL_RESEARCH_CSV = "real_research_study_records.csv"
REAL_STUDY_FILE = REAL_RESEARCH_CSV
REAL_SUMMARY_CSV = "real_research_metrics_summary.csv"
SYNTHETIC_CSV = "synthetic_study_records_backup.csv"

RESEARCH_SCHEMA_HEADERS = [
    "Session_ID",
    "Participant_ID",
    "Consent_Confirmed",
    "Recording_Timestamp",
    "Recording_Duration_Seconds",
    "Camera_Device_Type",
    "Condition",
    "Lighting_Notes",
    "HR_Reference_BPM",
    "HR_Reference_Method",
    "HR_Reference_Timestamp",
    "HR_Estimated_BPM",
    "HR_Estimate_Valid",
    "HR_Abs_Error",
    "RR_Reference_RPM",
    "RR_Reference_Method",
    "RR_Reference_Timestamp",
    "RR_Estimated_RPM",
    "RR_Estimate_Valid",
    "RR_Abs_Error",
    "Frames_Received",
    "Frames_Processed",
    "Processing_Latency_MS",
    "Session_Status",
    "Failure_Reason"
]

def init_real_research_csv():
    """Initializes the reproducible real research log if not already created."""
    if not os.path.exists(REAL_RESEARCH_CSV):
        with open(REAL_RESEARCH_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(RESEARCH_SCHEMA_HEADERS)

def log_real_research_session(*args, **kwargs):
    """
    Logs a real research session strictly following scientific data integrity guidelines.
    Accepts either a single dictionary, keyword arguments, or positional arguments.
    CRITICAL: Never substitutes reference measurements for missing estimates.
    Missing estimates are logged as empty strings with valid=False.
    """
    init_real_research_csv()
    rec_time = time.strftime("%Y-%m-%d %H:%M:%S")

    # If first argument is a dictionary
    if len(args) == 1 and isinstance(args[0], dict):
        d = args[0]
        session_id = d.get("session_id", f"REC-{int(time.time())}")
        participant_id = d.get("participant_id", "P-UNKNOWN")
        consent_confirmed = d.get("consent", d.get("consent_confirmed", True))
        duration_sec = d.get("duration_sec", 30.0)
        device_type = d.get("camera_device", d.get("device_type", "RGB Camera"))
        condition = d.get("condition", "Resting")
        lighting_notes = d.get("lighting", d.get("lighting_notes", "Indoor LED"))
        hr_ref = d.get("ref_hr_bpm", d.get("hr_ref", None))
        hr_ref_method = d.get("ref_hr_method", d.get("hr_ref_method", "Pulse Oximeter"))
        hr_ref_time = d.get("hr_ref_time", rec_time)
        hr_est = d.get("est_hr_bpm", d.get("hr_est", None))
        hr_valid = d.get("valid", d.get("hr_valid", False)) and (hr_est is not None)
        rr_ref = d.get("ref_rr_rpm", d.get("rr_ref", None))
        rr_ref_method = d.get("ref_rr_method", d.get("rr_ref_method", "Guided Count"))
        rr_ref_time = d.get("rr_ref_time", rec_time)
        rr_est = d.get("est_rr_rpm", d.get("rr_est", None))
        rr_valid = d.get("valid", d.get("rr_valid", False)) and (rr_est is not None)
        frames_received = d.get("total_frames", d.get("frames_received", 0))
        frames_processed = d.get("valid_hr_frames", d.get("frames_processed", 0))
        latency_ms = d.get("latency_ms", 350.0)
        session_status = "VALID" if (hr_valid and rr_valid) else "INVALID"
        failure_reason = d.get("failure_reason", "")
    elif kwargs:
        session_id = kwargs.get("session_id", f"REC-{int(time.time())}")
        participant_id = kwargs.get("participant_id", "P-UNKNOWN")
        consent_confirmed = kwargs.get("consent_confirmed", True)
        duration_sec = kwargs.get("duration_sec", 30.0)
        device_type = kwargs.get("device_type", "RGB Camera")
        condition = kwargs.get("condition", "Resting")
        lighting_notes = kwargs.get("lighting_notes", "Indoor LED")
        hr_ref = kwargs.get("hr_ref")
        hr_ref_method = kwargs.get("hr_ref_method", "Pulse Oximeter")
        hr_ref_time = kwargs.get("hr_ref_time", rec_time)
        hr_est = kwargs.get("hr_est")
        hr_valid = kwargs.get("hr_valid", False) and (hr_est is not None)
        rr_ref = kwargs.get("rr_ref")
        rr_ref_method = kwargs.get("rr_ref_method", "Guided Count")
        rr_ref_time = kwargs.get("rr_ref_time", rec_time)
        rr_est = kwargs.get("rr_est")
        rr_valid = kwargs.get("rr_valid", False) and (rr_est is not None)
        frames_received = kwargs.get("frames_received", 0)
        frames_processed = kwargs.get("frames_processed", 0)
        latency_ms = kwargs.get("latency_ms", 350.0)
        session_status = kwargs.get("session_status", "VALID" if (hr_valid and rr_valid) else "INVALID")
        failure_reason = kwargs.get("failure_reason", "")
    else:
        # Positional arguments mapping
        session_id = args[0] if len(args) > 0 else f"REC-{int(time.time())}"
        participant_id = args[1] if len(args) > 1 else "P-UNKNOWN"
        consent_confirmed = args[2] if len(args) > 2 else True
        duration_sec = args[3] if len(args) > 3 else 30.0
        device_type = args[4] if len(args) > 4 else "RGB Camera"
        condition = args[5] if len(args) > 5 else "Resting"
        lighting_notes = args[6] if len(args) > 6 else "Indoor LED"
        hr_ref = args[7] if len(args) > 7 else None
        hr_ref_method = args[8] if len(args) > 8 else "Pulse Oximeter"
        hr_ref_time = args[9] if len(args) > 9 else rec_time
        hr_est = args[10] if len(args) > 10 else None
        hr_valid = args[11] if len(args) > 11 else False
        rr_ref = args[12] if len(args) > 12 else None
        rr_ref_method = args[13] if len(args) > 13 else "Guided Count"
        rr_ref_time = args[14] if len(args) > 14 else rec_time
        rr_est = args[15] if len(args) > 15 else None
        rr_valid = args[16] if len(args) > 16 else False
        frames_received = args[17] if len(args) > 17 else 0
        frames_processed = args[18] if len(args) > 18 else 0
        latency_ms = args[19] if len(args) > 19 else 350.0
        session_status = args[20] if len(args) > 20 else ("VALID" if (hr_valid and rr_valid) else "INVALID")
        failure_reason = args[21] if len(args) > 21 else ""

    # HR Error calculation (only if genuine estimate is valid)
    hr_abs_error = ""
    if hr_valid and hr_est is not None and hr_ref is not None:
        try:
            hr_abs_error = round(abs(float(hr_est) - float(hr_ref)), 2)
        except Exception:
            hr_abs_error = ""

    # RR Error calculation (only if genuine estimate is valid)
    rr_abs_error = ""
    if rr_valid and rr_est is not None and rr_ref is not None:
        try:
            rr_abs_error = round(abs(float(rr_est) - float(rr_ref)), 2)
        except Exception:
            rr_abs_error = ""

    is_overall_valid = bool(hr_valid and rr_valid and (hr_est is not None) and (rr_est is not None))

    row = [
        session_id,
        participant_id,
        "TRUE" if consent_confirmed else "FALSE",
        rec_time,
        round(float(duration_sec), 1),
        device_type,
        condition,
        lighting_notes,
        round(float(hr_ref), 1) if hr_ref is not None else "",
        hr_ref_method,
        hr_ref_time,
        round(float(hr_est), 1) if (hr_valid and hr_est is not None) else "",
        "TRUE" if hr_valid else "FALSE",
        hr_abs_error,
        round(float(rr_ref), 1) if rr_ref is not None else "",
        rr_ref_method,
        rr_ref_time,
        round(float(rr_est), 1) if (rr_valid and rr_est is not None) else "",
        "TRUE" if rr_valid else "FALSE",
        rr_abs_error,
        int(frames_received),
        int(frames_processed),
        round(float(latency_ms), 1),
        session_status,
        failure_reason if not is_overall_valid else ""
    ]

    with open(REAL_RESEARCH_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(row)

    print(f"[RESEARCH LOGGED] Session {session_id} | Participant {participant_id} | Status: {session_status}")
    if failure_reason:
        print(f"  -> Failure Reason: {failure_reason}")
    else:
        print(f"  -> HR: Est {hr_est} vs Ref {hr_ref} (Err: {hr_abs_error} BPM) | RR: Est {rr_est} vs Ref {rr_ref} (Err: {rr_abs_error} RPM)")

    # Return a rich dictionary mapping for API and UI consumption
    result_dict = dict(zip(RESEARCH_SCHEMA_HEADERS, row))
    result_dict["Valid_Session"] = is_overall_valid
    result_dict["HR_Estimated_BPM"] = hr_est if hr_valid else None
    result_dict["RR_Estimated_RPM"] = rr_est if rr_valid else None
    result_dict["HR_Abs_Error"] = hr_abs_error if hr_abs_error != "" else None
    result_dict["RR_Abs_Error"] = rr_abs_error if rr_abs_error != "" else None
    result_dict["Failure_Reason"] = failure_reason

    return result_dict

def load_real_research_records():
    """Loads all genuine research sessions from REAL_RESEARCH_CSV."""
    if not os.path.exists(REAL_RESEARCH_CSV):
        return []
    records = []
    with open(REAL_RESEARCH_CSV, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            records.append(r)
    return records

def calculate_real_study_statistics(print_report=True):
    """
    Computes rigorous, honest research metrics across genuine participant recordings.
    - Excludes missing/invalid pairs from MAE, RMSE, and correlation calculations.
    - Never calculates zero error for missing estimates.
    - Reports attempted, valid, and failed sessions transparently.
    """
    records = load_real_research_records()
    total_attempted = len(records)

    if total_attempted == 0:
        if print_report:
            print("\n[INFO] No real research records found in", REAL_RESEARCH_CSV)
        return {
            "total_attempted": 0,
            "total_attempted_sessions": 0,
            "completed_sessions": 0,
            "valid_paired_sessions": 0,
            "valid_hr_count": 0,
            "valid_rr_count": 0,
            "failed_sessions_count": 0,
            "failed_rate_pct": 0.0,
            "hr_mae": None,
            "hr_rmse": None,
            "hr_corr": None,
            "hr_pct_within_5": None,
            "rr_mae": None,
            "rr_rmse": None,
            "rr_corr": None,
            "condition_breakdown": {},
            "conditions": {},
            "failure_reasons": {},
            "heart_rate": {"mae_bpm": None, "rmse_bpm": None, "pearson_r": None},
            "respiration_rate": {"mae_rpm": None, "rmse_rpm": None, "pearson_r": None}
        }

    valid_hr_pairs = []
    valid_rr_pairs = []
    failed_count = 0
    failure_reasons = {}
    condition_stats = {}

    for r in records:
        cond = r.get("Condition", "Resting")
        if cond not in condition_stats:
            condition_stats[cond] = {"attempted": 0, "hr_errors": [], "rr_errors": []}
        condition_stats[cond]["attempted"] += 1

        is_completed = r.get("Session_Status", "").upper() == "COMPLETED"
        hr_valid = r.get("HR_Estimate_Valid", "").upper() == "TRUE"
        rr_valid = r.get("RR_Estimate_Valid", "").upper() == "TRUE"
        fail_reason = r.get("Failure_Reason", "").strip()

        if not hr_valid or not rr_valid or not is_completed:
            failed_count += 1
            if fail_reason:
                failure_reasons[fail_reason] = failure_reasons.get(fail_reason, 0) + 1

        # Collect paired HR data
        if hr_valid:
            try:
                est_val = float(r["HR_Estimated_BPM"])
                ref_val = float(r["HR_Reference_BPM"])
                err_val = abs(est_val - ref_val)
                valid_hr_pairs.append((ref_val, est_val, err_val))
                condition_stats[cond]["hr_errors"].append(err_val)
            except Exception:
                pass

        # Collect paired RR data
        if rr_valid:
            try:
                est_val = float(r["RR_Estimated_RPM"])
                ref_val = float(r["RR_Reference_RPM"])
                err_val = abs(est_val - ref_val)
                valid_rr_pairs.append((ref_val, est_val, err_val))
                condition_stats[cond]["rr_errors"].append(err_val)
            except Exception:
                pass

    # Statistical Metrics for HR
    n_hr = len(valid_hr_pairs)
    if n_hr > 0:
        hr_refs = np.array([p[0] for p in valid_hr_pairs])
        hr_ests = np.array([p[1] for p in valid_hr_pairs])
        hr_errs = np.array([p[2] for p in valid_hr_pairs])

        hr_mae = round(float(np.mean(hr_errs)), 2)
        hr_rmse = round(float(np.sqrt(np.mean((hr_ests - hr_refs) ** 2))), 2)
        hr_bias = round(float(np.mean(hr_ests - hr_refs)), 2)
        hr_std = round(float(np.std(hr_ests - hr_refs)), 2)
        hr_pct_within_5 = round(float((np.sum(hr_errs <= 5.0) / n_hr) * 100.0), 1)

        if n_hr >= 3 and np.std(hr_refs) > 0 and np.std(hr_ests) > 0:
            hr_corr = round(float(np.corrcoef(hr_refs, hr_ests)[0, 1]), 2)
        else:
            hr_corr = None
    else:
        hr_mae, hr_rmse, hr_bias, hr_std, hr_pct_within_5, hr_corr = (None, None, None, None, None, None)

    # Statistical Metrics for RR
    n_rr = len(valid_rr_pairs)
    if n_rr > 0:
        rr_refs = np.array([p[0] for p in valid_rr_pairs])
        rr_ests = np.array([p[1] for p in valid_rr_pairs])
        rr_errs = np.array([p[2] for p in valid_rr_pairs])

        rr_mae = round(float(np.mean(rr_errs)), 2)
        rr_rmse = round(float(np.sqrt(np.mean((rr_ests - rr_refs) ** 2))), 2)
        rr_bias = round(float(np.mean(rr_ests - rr_refs)), 2)
        rr_pct_within_3 = round(float((np.sum(rr_errs <= 3.0) / n_rr) * 100.0), 1)

        if n_rr >= 3 and np.std(rr_refs) > 0 and np.std(rr_ests) > 0:
            rr_corr = round(float(np.corrcoef(rr_refs, rr_ests)[0, 1]), 2)
        else:
            rr_corr = None
    else:
        rr_mae, rr_rmse, rr_bias, rr_pct_within_3, rr_corr = (None, None, None, None, None)

    failed_pct = round((failed_count / total_attempted) * 100.0, 1)

    # Format condition breakdowns
    cond_summary = {}
    for c, data in condition_stats.items():
        cond_summary[c] = {
            "attempted": data["attempted"],
            "hr_valid_count": len(data["hr_errors"]),
            "hr_mae": round(float(np.mean(data["hr_errors"])), 2) if data["hr_errors"] else None,
            "rr_valid_count": len(data["rr_errors"]),
            "rr_mae": round(float(np.mean(data["rr_errors"])), 2) if data["rr_errors"] else None,
        }

    stats = {
        "total_attempted": total_attempted,
        "total_attempted_sessions": total_attempted,
        "completed_sessions": total_attempted - failed_count,
        "valid_paired_sessions": total_attempted - failed_count,
        "valid_hr_count": n_hr,
        "valid_rr_count": n_rr,
        "failed_sessions_count": failed_count,
        "failed_rate_pct": failed_pct,
        "hr_mae": hr_mae,
        "hr_rmse": hr_rmse,
        "hr_bias": hr_bias,
        "hr_std": hr_std,
        "hr_corr": hr_corr,
        "hr_pct_within_5": hr_pct_within_5,
        "rr_mae": rr_mae,
        "rr_rmse": rr_rmse,
        "rr_bias": rr_bias,
        "rr_corr": rr_corr,
        "rr_pct_within_3": rr_pct_within_3 if n_rr > 0 else None,
        "condition_breakdown": cond_summary,
        "conditions": cond_summary,
        "failure_reasons": failure_reasons,
        "heart_rate": {
            "mae_bpm": hr_mae,
            "rmse_bpm": hr_rmse,
            "pearson_r": hr_corr,
            "bias": hr_bias,
            "pct_within_5": hr_pct_within_5
        },
        "respiration_rate": {
            "mae_rpm": rr_mae,
            "rmse_rpm": rr_rmse,
            "pearson_r": rr_corr,
            "bias": rr_bias,
            "pct_within_3": rr_pct_within_3 if n_rr > 0 else None
        }
    }

    # Save summary report
    with open(REAL_SUMMARY_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Metric", "Value", "Description"])
        writer.writerow(["Total Attempted Sessions", total_attempted, "Total remote sessions initiated"])
        writer.writerow(["Valid HR Estimates Count", n_hr, "Number of paired HR measurements"])
        writer.writerow(["Valid RR Estimates Count", n_rr, "Number of paired RR measurements"])
        writer.writerow(["Failed Session Count", failed_count, "Sessions with missing/unusable vitals"])
        writer.writerow(["Failed Estimate Rate (%)", f"{failed_pct}%", "Percentage of unusable estimates"])
        writer.writerow(["Heart Rate MAE (BPM)", hr_mae if hr_mae is not None else "N/A", "Mean Absolute Error"])
        writer.writerow(["Heart Rate RMSE (BPM)", hr_rmse if hr_rmse is not None else "N/A", "Root Mean Square Error"])
        writer.writerow(["Heart Rate Pearson r", hr_corr if hr_corr is not None else "N/A", "Pearson correlation"])
        writer.writerow(["HR Within +/- 5 BPM (%)", f"{hr_pct_within_5}%" if hr_pct_within_5 is not None else "N/A", "ANSI/AAMI EC13 Compliance"])
        writer.writerow(["Respiration Rate MAE (RPM)", rr_mae if rr_mae is not None else "N/A", "Mean Absolute Error"])
        writer.writerow(["Respiration Rate RMSE (RPM)", rr_rmse if rr_rmse is not None else "N/A", "Root Mean Square Error"])
        writer.writerow(["Respiration Rate Pearson r", rr_corr if rr_corr is not None else "N/A", "Pearson correlation"])

    if print_report:
        print("\n" + "=" * 75)
        print("         CORVITX-AI GENUINE RESEARCH STUDY METRICS REPORT")
        print("=" * 75)
        print(f" Total Attempted Sessions:   {total_attempted}")
        print(f" Valid HR Paired Samples:    {n_hr} / {total_attempted}")
        print(f" Valid RR Paired Samples:    {n_rr} / {total_attempted}")
        print(f" Failed / Incomplete:        {failed_count} ({failed_pct}%)")
        print("-" * 75)
        if n_hr > 0:
            print(f" >> HEART RATE MAE:         {hr_mae} BPM (N = {n_hr})")
            print(f" >> HEART RATE RMSE:        {hr_rmse} BPM")
            print(f" >> BLAND-ALTMAN BIAS:      {hr_bias} BPM")
            print(f" >> PEARSON CORRELATION:    r = {hr_corr if hr_corr is not None else 'N/A (N<3)'}")
            print(f" >> COMPLIANCE (<= 5 BPM):  {hr_pct_within_5}%")
        else:
            print(" >> HEART RATE:             No valid paired estimates yet.")
        print("-" * 75)
        if n_rr > 0:
            print(f" >> RESPIRATION MAE:        {rr_mae} RPM (N = {n_rr})")
            print(f" >> RESPIRATION RMSE:       {rr_rmse} RPM")
            print(f" >> PEARSON CORRELATION:    r = {rr_corr if rr_corr is not None else 'N/A (N<3)'}")
        else:
            print(" >> RESPIRATION:            No valid paired estimates yet.")
        print("-" * 75)
        if failure_reasons:
            print(" Failure Breakdown:")
            for reason, cnt in failure_reasons.items():
                print(f"   * {reason}: {cnt}")
        print("=" * 75)
        print(f" Summary written to: {REAL_SUMMARY_CSV}\n")

    return stats


def generate_synthetic_benchmark_15_subjects():
    """
    PRESERVED AS SYNTHETIC ONLY.
    Explicitly labeled: Does NOT write to REAL_RESEARCH_CSV.
    Writes solely to synthetic_study_records_backup.csv.
    """
    print("\n[NOTE] Generating SYNTHETIC reference benchmark data (NOT genuine participant records).")
    np.random.seed(42)
    ages = [19, 20, 21, 18, 22, 20, 21, 19, 20, 22, 21, 19, 20, 21, 22]
    conditions = ["Resting", "Resting", "Resting", "Resting", "Resting",
                  "Motion",  "Resting", "Resting", "Motion",  "Resting",
                  "Occlusion", "Resting", "Resting", "Occlusion", "Resting"]
    base_hrs = [72, 68, 75, 80, 64, 82, 70, 76, 78, 66, 74, 71, 79, 73, 67]
    base_rrs = [16, 14, 15, 18, 13, 17, 15, 16, 17, 14, 16, 15, 17, 16, 14]
    hr_errors = [1.8, -2.4, 3.1, -1.9, 2.8, -4.2, 1.2, -3.5, 4.0, 1.5, -2.9, 2.1, -3.8, 2.5, -1.7]
    rr_errors = [1.2, -1.5, 1.8, -1.1, 2.0, -2.4, 0.8, -1.9, 2.2, 1.0, -1.8, 1.4, -2.3, 1.7, -1.2]

    with open(SYNTHETIC_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Subject_ID", "Age", "Condition",
            "HR_Reference_BPM", "HR_Estimated_BPM", "HR_Abs_Error",
            "RR_Reference_RPM", "RR_Estimated_RPM", "RR_Abs_Error",
            "Data_Type", "Timestamp"
        ])
        for i in range(15):
            sub_id = f"SYNTH_S{i+1:02d}"
            hr_ref = base_hrs[i]
            hr_est = round(hr_ref + hr_errors[i], 1)
            rr_ref = base_rrs[i]
            rr_est = round(rr_ref + rr_errors[i], 1)
            writer.writerow([
                sub_id, ages[i], conditions[i],
                hr_ref, hr_est, round(abs(hr_est - hr_ref), 2),
                rr_ref, rr_est, round(abs(rr_est - rr_ref), 2),
                "SYNTHETIC_PRESET",
                f"2026-10-11 10:{i+10:02d}:00"
            ])
    print(f"[SUCCESS] Synthetic preset saved to {SYNTHETIC_CSV} (Kept strictly isolated from real data).")


if __name__ == "__main__":
    init_real_research_csv()
    calculate_real_study_statistics(print_report=True)
