#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  BK-ATTENDANCE — Công cụ thu thập dữ liệu DHT22 từ ESP32
═══════════════════════════════════════════════════════════════
Đọc dữ liệu nhiệt độ & độ ẩm từ ESP32 qua Serial,
lưu vào file CSV để huấn luyện model TinyML.

Cách dùng:
  python collect_data.py --port COM3 --output data_normal.csv --label 0
  python collect_data.py --port COM3 --output data_fire.csv   --label 1
  python collect_data.py --port COM3 --output data_auto.csv   (tự lấy label từ ESP32)

Yêu cầu:
  - ESP32 đang chạy firmware với sensorTask (đã bật data log)
  - pip install pyserial
"""

import argparse
import csv
import os
import sys
import time
from datetime import datetime

try:
    import serial
except ImportError:
    print("Lỗi: Cần cài đặt pyserial → pip install pyserial")
    sys.exit(1)


DHT_DATA_PREFIX = "[DHT_DATA]"


def parse_dht_data_line(line: str, override_label: int = None):
    """
    Parse dòng dữ liệu từ ESP32 có định dạng:
      [DHT_DATA] timestamp_ms,temperature,humidity,anomaly_score,fire_label

    Returns:
        dict hoặc None nếu dòng không hợp lệ
    """
    line = line.strip()
    if not line.startswith(DHT_DATA_PREFIX):
        return None

    data_part = line[len(DHT_DATA_PREFIX):].strip()
    parts = data_part.split(",")

    if len(parts) < 5:
        return None

    try:
        timestamp_ms = int(parts[0])
        temperature = float(parts[1])
        humidity = float(parts[2])
        anomaly_score = float(parts[3])
        fire_label = int(parts[4])
    except (ValueError, IndexError):
        return None

    # Ghi đè label nếu được chỉ định (ví dụ khi thu thập dữ liệu gán nhãn thủ công)
    if override_label is not None:
        fire_label = override_label

    return {
        "timestamp_ms": timestamp_ms,
        "datetime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "temperature": temperature,
        "humidity": humidity,
        "anomaly_score": anomaly_score,
        "label": fire_label,
    }


def collect(port: str, baudrate: int, output: str, label: int, max_samples: int, duration: int):
    """Thu thập dữ liệu từ ESP32 qua Serial và ghi vào CSV."""

    # Kiểm tra file đã tồn tại chưa (append mode)
    file_exists = os.path.exists(output)
    fieldnames = ["timestamp_ms", "datetime", "temperature", "humidity", "anomaly_score", "label"]

    print(f"╔══════════════════════════════════════════════════╗")
    print(f"║  BK-Attendance — Thu thập dữ liệu TinyML       ║")
    print(f"╠══════════════════════════════════════════════════╣")
    print(f"║  Serial Port : {port:<34}║")
    print(f"║  Baud Rate   : {baudrate:<34}║")
    print(f"║  Output File : {output:<34}║")
    print(f"║  Label       : {('Auto (từ ESP32)' if label is None else str(label)):<34}║")
    print(f"║  Max Samples : {(str(max_samples) if max_samples else 'Không giới hạn'):<34}║")
    print(f"║  Duration    : {(str(duration) + 's' if duration else 'Không giới hạn'):<34}║")
    print(f"╚══════════════════════════════════════════════════╝")
    print()

    try:
        ser = serial.Serial(port, baudrate, timeout=2)
        print(f"[✓] Đã kết nối tới {port}")
    except serial.SerialException as e:
        print(f"[✗] Không thể mở {port}: {e}")
        sys.exit(1)

    # Flush buffer ban đầu
    time.sleep(1)
    ser.flushInput()

    count = 0
    start_time = time.time()

    with open(output, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()

        print("[...] Đang thu thập dữ liệu (Ctrl+C để dừng)...\n")

        try:
            while True:
                # Kiểm tra giới hạn
                if max_samples and count >= max_samples:
                    print(f"\n[✓] Đã đạt {max_samples} mẫu. Dừng thu thập.")
                    break

                if duration and (time.time() - start_time) >= duration:
                    print(f"\n[✓] Đã hết thời gian {duration}s. Dừng thu thập.")
                    break

                # Đọc dòng từ Serial
                raw = ser.readline()
                if not raw:
                    continue

                try:
                    line = raw.decode("utf-8", errors="replace").strip()
                except UnicodeDecodeError:
                    continue

                # Hiển thị mọi output Serial để debug
                if line:
                    print(f"  {line}")

                # Parse dòng DHT_DATA
                record = parse_dht_data_line(line, label)
                if record:
                    writer.writerow(record)
                    f.flush()
                    count += 1
                    elapsed = time.time() - start_time
                    print(f"  >>> Lưu mẫu #{count}: T={record['temperature']:.1f}°C, "
                          f"H={record['humidity']:.1f}%, Label={record['label']} "
                          f"({elapsed:.0f}s elapsed)")

        except KeyboardInterrupt:
            print(f"\n[!] Người dùng dừng. Đã lưu {count} mẫu.")

    ser.close()
    print(f"\n[✓] Hoàn tất! File: {output} ({count} mẫu mới)")
    print(f"    Tổng: {count + (sum(1 for _ in open(output)) - 1 if file_exists else count)} mẫu trong file")


def main():
    parser = argparse.ArgumentParser(
        description="Thu thập dữ liệu DHT22 từ ESP32 qua Serial cho TinyML",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  # Thu thập 500 mẫu bình thường (phòng bình thường)
  python collect_data.py --port COM3 --output data_normal.csv --label 0 --max 500

  # Thu thập 200 mẫu bất thường (gần lửa / nguồn nhiệt)
  python collect_data.py --port COM3 --output data_fire.csv --label 1 --max 200

  # Thu thập trong 10 phút, label tự động từ ESP32
  python collect_data.py --port COM3 --output data_auto.csv --duration 600

  # Thu thập liên tục (Ctrl+C để dừng)
  python collect_data.py --port COM3 --output data.csv --label 0
        """,
    )

    parser.add_argument("--port", "-p", required=True, help="Cổng Serial (VD: COM3, /dev/ttyUSB0)")
    parser.add_argument("--baud", "-b", type=int, default=115200, help="Baud rate (mặc định: 115200)")
    parser.add_argument("--output", "-o", default="dht_data.csv", help="File CSV đầu ra (mặc định: dht_data.csv)")
    parser.add_argument("--label", "-l", type=int, choices=[0, 1], default=None,
                        help="Gán nhãn thủ công: 0=Bình thường, 1=Bất thường/Cháy. Bỏ trống = tự lấy từ ESP32")
    parser.add_argument("--max", "-m", type=int, default=None, help="Số mẫu tối đa (bỏ trống = không giới hạn)")
    parser.add_argument("--duration", "-d", type=int, default=None, help="Thời gian thu thập (giây)")

    args = parser.parse_args()
    collect(args.port, args.baud, args.output, args.label, args.max, args.duration)


if __name__ == "__main__":
    main()

