#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  BK-ATTENDANCE — Tạo dữ liệu mô phỏng cho TinyML
═══════════════════════════════════════════════════════════════
Dùng khi chưa có thiết bị thực để thu thập dữ liệu.
Tạo dữ liệu giả lập nhiệt độ / độ ẩm với noise.

Cách dùng:
  python generate_synthetic_data.py --samples 1000 --output synthetic_data.csv
"""

import argparse
import csv
import os
import sys
import random
from datetime import datetime

import numpy as np


def generate_data(num_normal: int, num_fire: int, seed: int = 42):
    """
    Tạo dữ liệu mô phỏng:
      - Bình thường: T ∈ [18, 40]°C, H ∈ [30, 80]%
      - Bất thường / Cháy: T ∈ [42, 120]°C, H ∈ [0, 25]%
    """
    np.random.seed(seed)
    records = []

    # === DỮ LIỆU BÌNH THƯỜNG ===
    # Phòng học / văn phòng
    t_office = np.random.normal(loc=25.0, scale=3.0, size=num_normal // 3)
    h_office = np.random.normal(loc=60.0, scale=8.0, size=num_normal // 3)

    # Ngoài trời (nóng)
    t_outdoor = np.random.normal(loc=33.0, scale=4.0, size=num_normal // 3)
    h_outdoor = np.random.normal(loc=50.0, scale=10.0, size=num_normal // 3)

    # Phòng máy lạnh
    t_ac = np.random.normal(loc=22.0, scale=2.0, size=num_normal - 2 * (num_normal // 3))
    h_ac = np.random.normal(loc=55.0, scale=5.0, size=num_normal - 2 * (num_normal // 3))

    t_normal = np.concatenate([t_office, t_outdoor, t_ac])
    h_normal = np.concatenate([h_office, h_outdoor, h_ac])

    # Clip vào khoảng hợp lý
    t_normal = np.clip(t_normal, 15.0, 40.0)
    h_normal = np.clip(h_normal, 25.0, 85.0)

    for t, h in zip(t_normal, h_normal):
        records.append({
            "temperature": round(float(t), 2),
            "humidity": round(float(h), 2),
            "label": 0,
        })

    # === DỮ LIỆU BẤT THƯỜNG / CHÁY ===
    # Cháy nặng (nhiệt rất cao)
    t_heavy = np.random.normal(loc=80.0, scale=15.0, size=num_fire // 3)
    h_heavy = np.random.normal(loc=5.0, scale=3.0, size=num_fire // 3)

    # Bắt đầu cháy (nhiệt vừa)
    t_start = np.random.normal(loc=55.0, scale=8.0, size=num_fire // 3)
    h_start = np.random.normal(loc=18.0, scale=5.0, size=num_fire // 3)

    # Cháy vùng biên (gần ngưỡng)
    t_edge = np.random.normal(loc=45.0, scale=5.0, size=num_fire - 2 * (num_fire // 3))
    h_edge = np.random.normal(loc=22.0, scale=4.0, size=num_fire - 2 * (num_fire // 3))

    t_fire = np.concatenate([t_heavy, t_start, t_edge])
    h_fire = np.concatenate([h_heavy, h_start, h_edge])

    t_fire = np.clip(t_fire, 41.0, 150.0)
    h_fire = np.clip(h_fire, 0.5, 30.0)

    for t, h in zip(t_fire, h_fire):
        records.append({
            "temperature": round(float(t), 2),
            "humidity": round(float(h), 2),
            "label": 1,
        })

    # Trộn ngẫu nhiên
    random.seed(seed)
    random.shuffle(records)

    return records


def save_csv(records: list, output: str):
    """Lưu ra CSV."""
    fieldnames = ["timestamp_ms", "datetime", "temperature", "humidity", "anomaly_score", "label"]

    now = datetime.now()
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for i, r in enumerate(records):
            writer.writerow({
                "timestamp_ms": i * 2000,
                "datetime": now.strftime("%Y-%m-%d %H:%M:%S"),
                "temperature": r["temperature"],
                "humidity": r["humidity"],
                "anomaly_score": -1.0,
                "label": r["label"],
            })

    print(f"[✓] Đã lưu {len(records)} mẫu → {output}")


def main():
    parser = argparse.ArgumentParser(description="Tạo dữ liệu mô phỏng cho TinyML")
    parser.add_argument("--normal", "-n", type=int, default=700, help="Số mẫu bình thường (mặc định: 700)")
    parser.add_argument("--fire", "-f", type=int, default=300, help="Số mẫu bất thường (mặc định: 300)")
    parser.add_argument("--output", "-o", default="synthetic_data.csv", help="File đầu ra")
    parser.add_argument("--seed", "-s", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    print("═══════════════════════════════════════════")
    print("  Tạo dữ liệu mô phỏng TinyML")
    print("═══════════════════════════════════════════\n")

    records = generate_data(args.normal, args.fire, args.seed)

    n_normal = sum(1 for r in records if r["label"] == 0)
    n_fire = sum(1 for r in records if r["label"] == 1)
    print(f"  Bình thường : {n_normal}")
    print(f"  Bất thường  : {n_fire}")
    print(f"  Tổng        : {len(records)}\n")

    save_csv(records, args.output)


if __name__ == "__main__":
    main()

