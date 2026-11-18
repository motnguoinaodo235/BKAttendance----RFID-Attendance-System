#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════
  BK-ATTENDANCE — Huấn luyện model TinyML phát hiện cháy
═══════════════════════════════════════════════════════════════
Đọc dữ liệu CSV, huấn luyện mạng Neural Network nhỏ gọn,
và export sang TensorFlow Lite (.tflite) cho ESP32.

Kiến trúc model (phải khớp với firmware hiện tại):
  Input:  [temperature, humidity]  (2 features)
  Dense(8, relu)
  Dense(1, sigmoid)              → anomaly_score (0.0 ~ 1.0)

Cách dùng:
  python train_model.py --data data_normal.csv data_fire.csv
  python train_model.py --data combined_data.csv --epochs 200
  python train_model.py --data combined_data.csv --output my_model.tflite
"""

import argparse
import os
import sys
import json
from datetime import datetime

import numpy as np
import pandas as pd

try:
    import tensorflow as tf
    from tensorflow import keras
except ImportError:
    print("Lỗi: Cần cài đặt TensorFlow → pip install tensorflow>=2.13.0")
    sys.exit(1)

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, confusion_matrix
except ImportError:
    print("Lỗi: Cần cài đặt scikit-learn → pip install scikit-learn")
    sys.exit(1)

try:
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    print("[Cảnh báo] matplotlib chưa cài → bỏ qua vẽ biểu đồ")


# ══════════════════════════════════════════════════════
#  Hằng số kiến trúc (PHẢI KHỚP VỚI FIRMWARE)
# ══════════════════════════════════════════════════════
NUM_FEATURES = 2          # temperature, humidity
HIDDEN_UNITS = 8          # Dense layer 1
OUTPUT_UNITS = 1          # Dense layer 2 (sigmoid)
ANOMALY_THRESHOLD = 0.80  # Ngưỡng quyết định cháy


def load_data(file_paths: list) -> pd.DataFrame:
    """Đọc và gộp nhiều file CSV thành một DataFrame."""
    frames = []
    for path in file_paths:
        if not os.path.exists(path):
            print(f"[✗] Không tìm thấy file: {path}")
            sys.exit(1)

        df = pd.read_csv(path)
        required_cols = {"temperature", "humidity", "label"}
        if not required_cols.issubset(df.columns):
            print(f"[✗] File {path} thiếu cột: {required_cols - set(df.columns)}")
            sys.exit(1)

        frames.append(df)
        print(f"  [✓] Đọc {len(df)} mẫu từ {path}")

    combined = pd.concat(frames, ignore_index=True)
    return combined


def preprocess(df: pd.DataFrame):
    """Chuẩn bị dữ liệu: trích xuất features và labels."""
    X = df[["temperature", "humidity"]].values.astype(np.float32)
    y = df["label"].values.astype(np.float32)

    # Thống kê
    print(f"\n╔══════════════════════════════════════════╗")
    print(f"║  Thống kê dữ liệu                       ║")
    print(f"╠══════════════════════════════════════════╣")
    print(f"║  Tổng mẫu     : {len(X):<24}║")
    print(f"║  Bình thường   : {int(np.sum(y == 0)):<24}║")
    print(f"║  Bất thường    : {int(np.sum(y == 1)):<24}║")
    print(f"║  Nhiệt độ     : {X[:, 0].min():.1f}°C ~ {X[:, 0].max():.1f}°C{'':<10}║")
    print(f"║  Độ ẩm        : {X[:, 1].min():.1f}% ~ {X[:, 1].max():.1f}%{'':<11}║")
    print(f"╚══════════════════════════════════════════╝")

    if np.sum(y == 0) == 0 or np.sum(y == 1) == 0:
        print("[⚠] Cảnh báo: Dữ liệu chỉ có 1 lớp! Model cần cả 2 lớp (0 và 1) để học.")

    return X, y


def normalize_data(X_train, X_test):
    """
    Chuẩn hóa dữ liệu và trả về cả scaler parameters.
    
    LƯU Ý QUAN TRỌNG: Model trên ESP32 KHÔNG normalize input 
    (xem sensor_manager.cpp: input->data.f[0] = t trực tiếp).
    Do đó, model phải học trên dữ liệu RAW (không normalize)
    để inference trên ESP32 chính xác.
    
    Hàm này chỉ dùng cho tham khảo / data augmentation.
    Training thực tế dùng dữ liệu raw.
    """
    # Trả về dữ liệu raw (không normalize) để khớp firmware
    return X_train, X_test, None


def build_model():
    """
    Tạo model Keras khớp chính xác với kiến trúc firmware hiện tại.
    
    Kiến trúc (xem dht_anomaly_model.h):
      sequential/dense/MatMul + BiasAdd + Relu  → Dense(8, relu)
      sequential/dense_1/MatMul + BiasAdd       → Dense(1, sigmoid)
    """
    model = keras.Sequential([
        keras.layers.Input(shape=(NUM_FEATURES,), name="input_1"),
        keras.layers.Dense(HIDDEN_UNITS, activation="relu", name="dense"),
        keras.layers.Dense(OUTPUT_UNITS, activation="sigmoid", name="dense_1"),
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )

    model.summary()
    return model


def train(model, X_train, y_train, X_val, y_val, epochs: int, batch_size: int):
    """Huấn luyện model."""
    print(f"\n[...] Bắt đầu huấn luyện ({epochs} epochs, batch_size={batch_size})...\n")

    # Class weights để xử lý imbalanced data
    n_normal = np.sum(y_train == 0)
    n_fire = np.sum(y_train == 1)
    total = n_normal + n_fire
    class_weight = None
    if n_normal > 0 and n_fire > 0:
        class_weight = {
            0: total / (2.0 * n_normal),
            1: total / (2.0 * n_fire),
        }
        print(f"  Class weights: Normal={class_weight[0]:.2f}, Fire={class_weight[1]:.2f}")

    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor="val_loss", patience=30, restore_best_weights=True
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        class_weight=class_weight,
        callbacks=callbacks,
        verbose=1,
    )

    return history


def evaluate(model, X_test, y_test):
    """Đánh giá model và in báo cáo."""
    print("\n═══════════════════════════════════════════")
    print("  KẾT QUẢ ĐÁNH GIÁ")
    print("═══════════════════════════════════════════")

    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"  Loss     : {loss:.4f}")
    print(f"  Accuracy : {accuracy:.4f} ({accuracy * 100:.1f}%)")

    y_pred_proba = model.predict(X_test, verbose=0).flatten()
    y_pred = (y_pred_proba > ANOMALY_THRESHOLD).astype(int)

    print(f"\n  Confusion Matrix (threshold={ANOMALY_THRESHOLD}):")
    cm = confusion_matrix(y_test, y_pred)
    print(f"    {'':>12} Pred:Normal  Pred:Fire")
    print(f"    {'True:Normal':>12}  {cm[0][0]:>8}  {cm[0][1]:>8}")
    print(f"    {'True:Fire':>12}  {cm[1][0]:>8}  {cm[1][1]:>8}")

    print(f"\n  Classification Report:")
    target_names = ["Binh thuong (0)", "Chay/Bat thuong (1)"]
    print(classification_report(y_test, y_pred, target_names=target_names))

    return y_pred_proba



def convert_to_tflite(model, output_path: str):
    """Chuyển Keras model sang TensorFlow Lite Float32."""
    print("\n[...] Chuyển đổi sang TensorFlow Lite...")

    try:
        # Bước 1: Export Keras model sang SavedModel
        saved_model_dir = os.path.splitext(output_path)[0] + "_saved_model"

        print("  [...] Export SavedModel...")

        model.export(saved_model_dir)

        # Bước 2: Tạo converter từ SavedModel
        print("  [...] Khởi tạo TFLite Converter...")

        converter = tf.lite.TFLiteConverter.from_saved_model(
            saved_model_dir
        )

        # Giữ nguyên Float32, không quantization
        converter.optimizations = []

        # Chỉ sử dụng các toán tử TFLite built-in
        converter.target_spec.supported_ops = [
            tf.lite.OpsSet.TFLITE_BUILTINS
        ]

        # Bước 3: Convert
        print("  [...] Đang convert...")

        tflite_model = converter.convert()

        # Bước 4: Lưu file
        with open(output_path, "wb") as f:
            f.write(tflite_model)

        size_kb = len(tflite_model) / 1024

        print(f"  [✓] Đã lưu: {output_path} ({size_kb:.2f} KB)")

        # Bước 5: Kiểm tra model
        print("  [...] Kiểm tra TFLite Interpreter...")

        interpreter = tf.lite.Interpreter(
            model_content=tflite_model
        )

        interpreter.allocate_tensors()

        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        print(
            f"  Input shape: {input_details[0]['shape']} "
            f"dtype={input_details[0]['dtype']}"
        )

        print(
            f"  Output shape: {output_details[0]['shape']} "
            f"dtype={output_details[0]['dtype']}"
        )

        if input_details[0]["dtype"] != np.float32:
            raise ValueError("Input model khong phai Float32!")

        if output_details[0]["dtype"] != np.float32:
            raise ValueError("Output model khong phai Float32!")

        if size_kb > 30:
            print("  [⚠] Model > 30 KB")

        print("  [✓] TFLite conversion và verification thành công!")

        return tflite_model

    except Exception as e:
        print(f"\n[✗] TFLite conversion thất bại: {e}")
        raise


def plot_training(history, output_dir: str):
    """Vẽ biểu đồ loss và accuracy."""
    if not HAS_MATPLOTLIB:
        return

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    # Loss
    axes[0].plot(history.history["loss"], label="Train Loss")
    axes[0].plot(history.history["val_loss"], label="Val Loss")
    axes[0].set_title("Loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Accuracy
    axes[1].plot(history.history["accuracy"], label="Train Acc")
    axes[1].plot(history.history["val_accuracy"], label="Val Acc")
    axes[1].set_title("Accuracy")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy")
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    chart_path = os.path.join(output_dir, "training_history.png")
    plt.savefig(chart_path, dpi=150)
    print(f"  [✓] Biểu đồ: {chart_path}")
    plt.close()


def save_training_info(output_dir: str, data_files: list, num_samples: int,
                       accuracy: float, model_size: int):
    """Lưu thông tin huấn luyện."""
    info = {
        "trained_at": datetime.now().isoformat(),
        "data_files": data_files,
        "num_samples": num_samples,
        "architecture": f"Dense({HIDDEN_UNITS}, relu) → Dense({OUTPUT_UNITS}, sigmoid)",
        "input_features": ["temperature (°C)", "humidity (%)"],
        "output": "anomaly_score (0.0 ~ 1.0)",
        "threshold": ANOMALY_THRESHOLD,
        "accuracy": round(accuracy, 4),
        "model_size_bytes": model_size,
        "normalization": "None (raw input — khớp firmware)",
    }

    info_path = os.path.join(output_dir, "training_info.json")
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
    print(f"  [✓] Thông tin: {info_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Huấn luyện model TinyML phát hiện cháy cho ESP32",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  # Huấn luyện từ 2 file data (bình thường + bất thường)
  python train_model.py --data data_normal.csv data_fire.csv

  # Huấn luyện từ 1 file gộp, 300 epochs
  python train_model.py --data combined.csv --epochs 300

  # Chỉ định file output
  python train_model.py --data data.csv --output models/my_model.tflite

  # Dùng dữ liệu mẫu
  python train_model.py --data sample_data/sample_dht_data.csv
        """,
    )

    parser.add_argument("--data", "-d", nargs="+", required=True, help="File CSV đầu vào (1 hoặc nhiều file)")
    parser.add_argument("--output", "-o", default="dht_anomaly_model.tflite", help="File .tflite đầu ra")
    parser.add_argument("--epochs", "-e", type=int, default=200, help="Số epochs (mặc định: 200)")
    parser.add_argument("--batch-size", "-bs", type=int, default=16, help="Batch size (mặc định: 16)")
    parser.add_argument("--test-split", "-ts", type=float, default=0.2, help="Tỷ lệ test (mặc định: 0.2)")
    parser.add_argument("--seed", "-s", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    print("═══════════════════════════════════════════════════════")
    print("  BK-ATTENDANCE — Huấn luyện TinyML Model")
    print("═══════════════════════════════════════════════════════\n")

    # 1. Đọc dữ liệu
    print("[Bước 1/5] Đọc dữ liệu...")
    df = load_data(args.data)
    X, y = preprocess(df)

    # 2. Chia train/test
    print(f"\n[Bước 2/5] Chia dữ liệu (test={args.test_split*100:.0f}%)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_split, random_state=args.seed, stratify=y
    )
    print(f"  Train: {len(X_train)} mẫu | Test: {len(X_test)} mẫu")

    # Normalize (raw — không thay đổi, để khớp firmware)
    X_train, X_test, _ = normalize_data(X_train, X_test)

    # 3. Xây dựng và huấn luyện
    print(f"\n[Bước 3/5] Xây dựng model...")
    model = build_model()

    history = train(model, X_train, y_train, X_test, y_test, args.epochs, args.batch_size)

    # 4. Đánh giá
    print(f"\n[Bước 4/5] Đánh giá model...")
    evaluate(model, X_test, y_test)
    _, accuracy = model.evaluate(X_test, y_test, verbose=0)

    # 5. Export
    print(f"\n[Bước 5/5] Export model...")
    output_dir = os.path.dirname(args.output) or "."
    os.makedirs(output_dir, exist_ok=True)

    tflite_model = convert_to_tflite(model, args.output)
    plot_training(history, output_dir)
    save_training_info(output_dir, args.data, len(X), accuracy, len(tflite_model))

    # Lưu Keras model để tham khảo
    keras_path = os.path.splitext(args.output)[0] + ".keras"
    model.save(keras_path)
    print(f"  [✓] Keras model: {keras_path}")

    print(f"\n╔══════════════════════════════════════════════════════╗")
    print(f"║  ✅ HUẤN LUYỆN HOÀN TẤT!                            ║")
    print(f"║                                                      ║")
    print(f"║  Bước tiếp theo:                                     ║")
    print(f"║  python export_header.py -i {args.output:<24}║")
    print(f"║  → Tạo file .h để nhúng vào firmware ESP32           ║")
    print(f"╚══════════════════════════════════════════════════════╝")


if __name__ == "__main__":
    main()

