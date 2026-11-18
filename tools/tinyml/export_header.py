#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  BK-ATTENDANCE — Export TFLite model sang C header (.h)
═══════════════════════════════════════════════════════════════
Chuyển đổi file .tflite thành C header để nhúng trực tiếp
vào firmware ESP32 (thay thế include/dht_anomaly_model.h).

Cách dùng:
  python export_header.py --input dht_anomaly_model.tflite
  python export_header.py -i model.tflite -o ../../include/dht_anomaly_model.h
  python export_header.py -i model.tflite --install  (tự copy vào include/)
"""

import argparse
import os
import shutil
import sys
from datetime import datetime


def tflite_to_c_header(tflite_path: str, header_path: str, array_name: str = "dht_anomaly_model_tflite"):
    """Chuyển file .tflite thành C header với mảng byte."""

    with open(tflite_path, "rb") as f:
        model_data = f.read()

    model_size = len(model_data)
    model_size_kb = model_size / 1024

    print(f"  Input  : {tflite_path} ({model_size} bytes / {model_size_kb:.1f} KB)")
    print(f"  Output : {header_path}")
    print(f"  Array  : {array_name}[]")

    # Tạo nội dung header
    guard_name = os.path.basename(header_path).upper().replace(".", "_").replace("-", "_")

    lines = []
    lines.append(f"#ifndef {guard_name}")
    lines.append(f"#define {guard_name}")
    lines.append(f"")
    lines.append(f"// ═══════════════════════════════════════════════════════════")
    lines.append(f"// TinyML Model — Phát hiện cháy / bất thường nhiệt độ")
    lines.append(f"// ═══════════════════════════════════════════════════════════")
    lines.append(f"// Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"// Source   : {os.path.basename(tflite_path)}")
    lines.append(f"// Size     : {model_size} bytes ({model_size_kb:.1f} KB)")
    lines.append(f"// Input    : [temperature, humidity] (float32)")
    lines.append(f"// Output   : [anomaly_score] (float32, 0.0 ~ 1.0)")
    lines.append(f"// Threshold: > 0.80 → Nguy cơ cháy")
    lines.append(f"//")
    lines.append(f"// Để tạo lại file này:")
    lines.append(f"//   cd tools/tinyml")
    lines.append(f"//   python export_header.py -i {os.path.basename(tflite_path)} --install")
    lines.append(f"// ═══════════════════════════════════════════════════════════")
    lines.append(f"")
    lines.append(f"alignas(8) const unsigned char {array_name}[] = {{")

    # Chuyển bytes thành hex array
    BYTES_PER_LINE = 12
    for i in range(0, model_size, BYTES_PER_LINE):
        chunk = model_data[i : i + BYTES_PER_LINE]
        hex_values = ", ".join(f"0x{b:02x}" for b in chunk)

        if i + BYTES_PER_LINE < model_size:
            lines.append(f"  {hex_values},")
        else:
            lines.append(f"  {hex_values}}};")

    lines.append(f"")
    lines.append(f"const unsigned int {array_name}_len = {model_size};")
    lines.append(f"")
    lines.append(f"#endif // {guard_name}")
    lines.append(f"")

    # Ghi file
    with open(header_path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print(f"  [✓] Header file đã tạo thành công!")
    return model_size


def verify_header(header_path: str, original_size: int):
    """Kiểm tra header file đã tạo."""
    if not os.path.exists(header_path):
        print(f"  [✗] File không tồn tại: {header_path}")
        return False

    with open(header_path, "r") as f:
        content = f.read()

    # Đếm số byte trong mảng
    hex_count = content.count("0x")
    if hex_count != original_size:
        print(f"  [✗] Số byte không khớp: {hex_count} vs {original_size}")
        return False

    if "alignas(8)" not in content:
        print(f"  [⚠] Thiếu alignas(8) — có thể gây lỗi trên ESP32")
        return False

    file_size = os.path.getsize(header_path)
    print(f"  [✓] Verify OK: {hex_count} bytes hex, file size = {file_size / 1024:.1f} KB")
    return True


def install_header(header_path: str, project_root: str = None):
    """Copy header file vào thư mục include/ của dự án."""
    if project_root is None:
        # Tự detect: tools/tinyml/ → ../../include/
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))

    include_dir = os.path.join(project_root, "include")
    target_path = os.path.join(include_dir, "dht_anomaly_model.h")

    if not os.path.isdir(include_dir):
        print(f"  [✗] Thư mục include/ không tồn tại: {include_dir}")
        return False

    # Backup file cũ
    if os.path.exists(target_path):
        backup_path = target_path + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(target_path, backup_path)
        print(f"  [✓] Backup file cũ: {backup_path}")

    shutil.copy2(header_path, target_path)
    print(f"  [✓] Đã cài đặt: {target_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Export TFLite model sang C header cho ESP32",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  # Export thành header file
  python export_header.py -i dht_anomaly_model.tflite

  # Export và cài đặt trực tiếp vào include/
  python export_header.py -i dht_anomaly_model.tflite --install

  # Chỉ định output path
  python export_header.py -i model.tflite -o custom_model.h
        """,
    )

    parser.add_argument("--input", "-i", required=True, help="File .tflite đầu vào")
    parser.add_argument("--output", "-o", default=None, help="File .h đầu ra (mặc định: cùng tên)")
    parser.add_argument("--array-name", "-a", default="dht_anomaly_model_tflite",
                        help="Tên biến mảng C (mặc định: dht_anomaly_model_tflite)")
    parser.add_argument("--install", action="store_true",
                        help="Tự động copy vào include/dht_anomaly_model.h")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"[✗] Không tìm thấy file: {args.input}")
        sys.exit(1)

    # Xác định output path
    if args.output is None:
        base_name = os.path.splitext(os.path.basename(args.input))[0]
        args.output = base_name + ".h"

    print("═══════════════════════════════════════════════════════")
    print("  BK-ATTENDANCE — Export TFLite → C Header")
    print("═══════════════════════════════════════════════════════\n")

    # 1. Chuyển đổi
    print("[Bước 1/3] Chuyển đổi .tflite → .h ...")
    model_size = tflite_to_c_header(args.input, args.output, args.array_name)

    # 2. Verify
    print(f"\n[Bước 2/3] Kiểm tra header file...")
    ok = verify_header(args.output, model_size)
    if not ok:
        print("[✗] Verify thất bại!")
        sys.exit(1)

    # 3. Install (nếu có flag)
    if args.install:
        print(f"\n[Bước 3/3] Cài đặt vào include/...")
        success = install_header(args.output)
        if success:
            print(f"\n╔══════════════════════════════════════════════════╗")
            print(f"║  ✅ ĐÃ CÀI ĐẶT MODEL MỚI!                      ║")
            print(f"║                                                  ║")
            print(f"║  Flash firmware để áp dụng:                      ║")
            print(f"║    pio run --target upload                       ║")
            print(f"╚══════════════════════════════════════════════════╝")
        else:
            print("[✗] Cài đặt thất bại!")
            sys.exit(1)
    else:
        print(f"\n╔══════════════════════════════════════════════════╗")
        print(f"║  ✅ EXPORT THÀNH CÔNG!                           ║")
        print(f"║                                                  ║")
        print(f"║  Để cài vào firmware, chạy lại với --install:    ║")
        print(f"║  python export_header.py -i {os.path.basename(args.input):<19}║")
        print(f"║                          --install               ║")
        print(f"╚══════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()

