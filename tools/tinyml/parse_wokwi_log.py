#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  Chuyển Serial output từ Wokwi thành CSV để train TinyML
═══════════════════════════════════════════════════════════════

Cách dùng:
  1. Chạy mô phỏng Wokwi, thay đổi nhiệt độ/độ ẩm DHT22
  2. Copy toàn bộ Serial output → paste vào file .txt
  3. Chạy:  python parse_wokwi_log.py --input serial_log.txt --output data.csv

Hoặc pipe trực tiếp:
  python parse_wokwi_log.py --input serial_log.txt --normal-max 35 --output data.csv
"""

import argparse
import csv
import sys
from datetime import datetime

DHT_DATA_PREFIX = "[DHT_DATA]"


def parse_log(input_path: str, output_path: str, temp_threshold: float):
    """
    Đọc file log Serial, lọc dòng [DHT_DATA], gán label tự động:
      - label=0 nếu temperature <= temp_threshold
      - label=1 nếu temperature > temp_threshold
    """
    fieldnames = ["timestamp_ms", "datetime", "temperature", "humidity", "anomaly_score", "label"]
    count = 0
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(input_path, "r", encoding="utf-8", errors="replace") as fin, \
         open(output_path, "w", newline="", encoding="utf-8") as fout:

        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for line in fin:
            line = line.strip()
            if not line.startswith(DHT_DATA_PREFIX):
                continue

            data_part = line[len(DHT_DATA_PREFIX):].strip()
            parts = data_part.split(",")
            if len(parts) < 5:
                continue

            try:
                timestamp_ms = int(parts[0])
                temperature = float(parts[1])
                humidity = float(parts[2])
                anomaly_score = float(parts[3])
                original_label = int(parts[4])
            except (ValueError, IndexError):
                continue

            # Gán label dựa trên ngưỡng nhiệt độ
            # (hoặc giữ label gốc từ firmware nếu muốn)
            auto_label = 1 if temperature > temp_threshold else 0

            writer.writerow({
                "timestamp_ms": timestamp_ms,
                "datetime": now_str,
                "temperature": temperature,
                "humidity": humidity,
                "anomaly_score": anomaly_score,
                "label": auto_label,
            })
            count += 1

    return count


def main():
    parser = argparse.ArgumentParser(
        description="Parse Wokwi Serial log thành CSV cho TinyML training"
    )
    parser.add_argument("--input", "-i", required=True, help="File log Serial từ Wokwi (.txt)")
    parser.add_argument("--output", "-o", default="wokwi_data.csv", help="File CSV đầu ra")
    parser.add_argument("--temp-threshold", "-t", type=float, default=40.0,
                        help="Ngưỡng nhiệt độ để tự gán label (>threshold=fire). Mặc định: 40°C")

    args = parser.parse_args()

    print(f"Đọc: {args.input}")
    print(f"Ngưỡng label: >{args.temp_threshold}°C = Bất thường")

    count = parse_log(args.input, args.output, args.temp_threshold)

    print(f"\n[✓] Đã parse {count} mẫu → {args.output}")
    if count == 0:
        print("[⚠] Không tìm thấy dòng [DHT_DATA] nào! Kiểm tra lại file log.")
    else:
        print(f"\nBước tiếp: python train_model.py --data {args.output}")


if __name__ == "__main__":
    main()
