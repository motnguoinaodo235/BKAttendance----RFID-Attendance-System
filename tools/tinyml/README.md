# 🧠 BK-Attendance — TinyML Pipeline

Pipeline end-to-end để **thu thập dữ liệu**, **huấn luyện**, và **deploy** mô hình TinyML
phát hiện cháy / bất thường nhiệt độ trên ESP32.

## 📐 Kiến trúc Model

```
Input: [temperature, humidity]  (2 features, float32)
  │
  ├── Dense(8, relu)            ← Lớp ẩn
  │
  └── Dense(1, sigmoid)         ← Output: anomaly_score (0.0 ~ 1.0)

Ngưỡng quyết định: anomaly_score > 0.80 → 🔥 Cảnh báo cháy
```

**Kích thước model**: ~1.7 KB (vừa vặn cho ESP32 với 4 KB tensor arena)

## 🗂️ Cấu trúc thư mục

```
tools/tinyml/
├── README.md                     # Tài liệu này
├── requirements.txt              # Các thư viện Python cần thiết
├── collect_data.py               # Thu thập dữ liệu từ ESP32 qua Serial
├── generate_synthetic_data.py    # Tạo dữ liệu mô phỏng (không cần thiết bị)
├── train_model.py                # Huấn luyện model TinyML
├── export_header.py              # Chuyển .tflite → C header cho ESP32
└── sample_data/
    └── sample_dht_data.csv       # Dữ liệu mẫu (70 normal + 40 fire)
```

## 🚀 Hướng dẫn sử dụng

### Bước 0: Cài đặt thư viện

```bash
cd tools/tinyml
pip install -r requirements.txt
```

### Bước 1: Thu thập dữ liệu

#### Cách A: Thu thập từ thiết bị thực (ESP32 + DHT22)

1. Flash firmware vào ESP32 (đảm bảo `sensorTask` đã được bật trong `main.cpp`)
2. Kết nối ESP32 qua USB
3. Thu thập dữ liệu **bình thường** (phòng học / văn phòng):

```bash
python collect_data.py --port COM3 --output data_normal.csv --label 0 --max 500
```

4. Thu thập dữ liệu **bất thường** (đặt gần nguồn nhiệt / lửa):

```bash
python collect_data.py --port COM3 --output data_fire.csv --label 1 --max 200
```

> **Lưu ý**: Mỗi mẫu cách nhau 2 giây (DHT22 refresh rate). 500 mẫu ≈ 17 phút.

#### Cách B: Tạo dữ liệu mô phỏng (không cần thiết bị)

```bash
python generate_synthetic_data.py --normal 700 --fire 300 --output synthetic_data.csv
```

#### Cách C: Dùng dữ liệu mẫu có sẵn

Dữ liệu mẫu đã có tại `sample_data/sample_dht_data.csv`.

### Bước 2: Huấn luyện model

```bash
# Từ dữ liệu thu thập thực tế (2 file)
python train_model.py --data data_normal.csv data_fire.csv --epochs 200

# Từ dữ liệu mô phỏng (1 file)
python train_model.py --data synthetic_data.csv --epochs 200

# Từ dữ liệu mẫu
python train_model.py --data sample_data/sample_dht_data.csv --epochs 300
```

**Output:**
- `dht_anomaly_model.tflite` — Model TFLite (≈ 1.7 KB)
- `dht_anomaly_model.keras` — Model Keras (để tham khảo)
- `training_history.png` — Biểu đồ loss/accuracy
- `training_info.json` — Thông tin huấn luyện

### Bước 3: Export sang C header

```bash
# Chỉ export (tạo file .h)
python export_header.py --input dht_anomaly_model.tflite

# Export VÀ cài đặt trực tiếp vào include/ (thay thế model cũ)
python export_header.py --input dht_anomaly_model.tflite --install
```

### Bước 4: Flash firmware

```bash
# Quay về thư mục gốc dự án
cd ../..

# Build và upload
pio run --target upload

# Xem Serial Monitor
pio device monitor
```

## 📊 Kết quả Serial Monitor

Sau khi flash, Serial Monitor sẽ hiển thị:

```
[TinyML] Khoi tao model thanh cong!
[DHT_DATA] 15234,25.3,65.2,0.1234,0
[DHT22] T: 25.3C - H: 65.2% -> Nguy co chay: 12.3% | Sample #1
[DHT_DATA] 17236,25.5,64.8,0.0987,0
[DHT22] T: 25.5C - H: 64.8% -> Nguy co chay: 9.9% | Sample #2
...
[DHT_DATA] 45678,75.0,4.2,0.9543,1
[DHT22] T: 75.0C - H: 4.2% -> Nguy co chay: 95.4% | Sample #15
>> [CANH BAO CHAY] Phat hien nguy co hoa hoan! <<
```

## 📋 Format dữ liệu CSV

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `timestamp_ms` | int | Thời gian (millis) từ khi ESP32 bật |
| `datetime` | string | Thời gian thực (từ PC khi thu thập) |
| `temperature` | float | Nhiệt độ (°C) |
| `humidity` | float | Độ ẩm (%) |
| `anomaly_score` | float | Điểm bất thường từ TinyML (-1.0 nếu chưa sẵn sàng) |
| `label` | int | Nhãn: 0 = Bình thường, 1 = Bất thường / Cháy |

## ⚙️ Tùy chỉnh nâng cao

### Thay đổi kiến trúc model

Nếu muốn model phức tạp hơn, sửa hàm `build_model()` trong `train_model.py`:

```python
def build_model():
    model = keras.Sequential([
        keras.layers.Input(shape=(2,)),
        keras.layers.Dense(16, activation="relu"),   # Nhiều neuron hơn
        keras.layers.Dense(8, activation="relu"),     # Thêm 1 lớp
        keras.layers.Dense(1, activation="sigmoid"),
    ])
    # ...
```

> ⚠️ **Lưu ý**: Kiến trúc mới sẽ cần tăng `kTensorArenaSize` trong `sensor_manager.cpp`
> (mặc định 4 KB, có thể tăng lên 8-16 KB tùy model).

### Thêm features

Nếu muốn thêm cảm biến (CO2, smoke, ...):

1. Sửa `sensor_manager.cpp` để đọc thêm sensor và in thêm cột trong `[DHT_DATA]`
2. Sửa `collect_data.py` để parse thêm cột
3. Sửa `train_model.py`: thay `NUM_FEATURES = 2` thành `NUM_FEATURES = N`
4. Sửa `sensor_manager.cpp`: cập nhật `input->data.f[0..N-1]`

### INT8 Quantization

Để giảm kích thước model (đặc biệt khi model > 30 KB):

```python
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = lambda: (
    [X_train[i:i+1].astype(np.float32)] for i in range(min(100, len(X_train)))
)
converter.target_spec.supported_types = [tf.int8]
tflite_model = converter.convert()
```

> ⚠️ Khi dùng INT8, firmware cần chuyển từ `input->data.f` sang `input->data.int8`.

## 🔧 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| `[TinyML] Loi: Phien ban TFLite Schema khong khop` | Model được tạo bởi phiên bản TF khác. Cài lại `tensorflow==2.13.0` |
| `[TinyML] Loi: Khong the cap phat bo nho Tensors!` | Tăng `kTensorArenaSize` trong `sensor_manager.cpp` |
| Accuracy thấp (< 80%) | Thu thập thêm dữ liệu, đặc biệt ở vùng biên (40-50°C) |
| Model quá lớn (> 30 KB) | Giảm `HIDDEN_UNITS`, dùng INT8 quantization |
| Serial không hiện `[DHT_DATA]` | Kiểm tra `sensorTask` đã được bật trong `main.cpp` |
| `ModuleNotFoundError: No module named 'tensorflow'` | `pip install tensorflow>=2.13.0` |

