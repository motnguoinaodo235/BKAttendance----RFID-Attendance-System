## 📖 Giới thiệu
**DADN-BKAttendance** là hệ thống quản lý điểm danh thông minh chạy trên vi điều khiển ESP32, ứng dụng hệ điều hành thời gian thực (FreeRTOS) để quản lý đồng thời nhiều tác vụ phức tạp. 

Hệ thống kết hợp đọc thẻ RFID, mở cổng bằng mật khẩu dự phòng, hiển thị thông tin trực quan, đồng thời tích hợp tính năng giám sát môi trường để tự động cảnh báo và xử lý sự cố hỏa hoạn. Dữ liệu được đồng bộ liên tục với server thông qua giao thức MQTT.

## 🚀 Các tính năng chính (Features)
* **Điểm danh thông minh (RFID RC522):** Tự động phân loại trạng thái điểm danh: *Đúng giờ, Đi muộn, Vắng, Hết giờ, Ra sớm* dựa trên thời gian thực (NTP).
* **Quản lý đa tác vụ (FreeRTOS):** Chạy độc lập các luồng xử lý Mạng (Core 0), Hiển thị, RFID, Cảm biến, Servo và Keypad (Core 1) giúp hệ thống không bị treo hay gián đoạn.
* **Xác thực dự phòng (Keypad 3x3):** Hỗ trợ nhập mật khẩu để mở cổng trong trường hợp quên thẻ.
* **Cảnh báo cháy nổ (DHT22):** Liên tục theo dõi nhiệt độ, độ ẩm. Tự động hú còi báo động và **mở chốt cửa khẩn cấp** khi phát hiện nguy cơ cháy (Nhiệt độ > 60°C hoặc >50°C kèm độ ẩm < 20%).
* **Giao diện & Phản hồi trực quan:** Hiển thị thông tin sinh viên, kết quả điểm danh lên màn hình LCD I2C 20x4 (Address 0x27). Cảnh báo âm thanh (Buzzer) và ánh sáng (LED RGB) tùy theo trạng thái điểm danh.
* **Kết nối IoT:** Giao tiếp với Broker HiveMQ, nhận lệnh điều chỉnh thời gian (Deadline/Endtime/Ca học) và trả về dữ liệu điểm danh (UID, MSSV, Status).

## 🛠 Yêu cầu Phần cứng (Hardware) & Sơ đồ nối dây (Pinout)

| Linh kiện | Chân ESP32 | Ghi chú |
| :--- | :--- | :--- |
| **RFID MFRC522** | SS: 5, RST: 4 | SCK: 18, MOSI: 23, MISO: 19 (SPI chuẩn) |
| **Màn hình LCD 20x4 (I2C)**| SDA: 21, SCL: 22 | Địa chỉ I2C mặc định: `0x27` |
| **Keypad 3x3** | Row: 26, 17, 16 <br> Col: 32, 33, 25 | |
| **Cảm biến DHT22** | 15 | |
| **Động cơ Servo** | 27 | PWM 50Hz điều khiển chốt cửa |
| **LED RGB** | R: 13, G: 14, B: 12 | Anode/Cathode chung tùy phần cứng |
| **Còi báo (Buzzer)** | 2 | |

## 💻 Cấu trúc Phần mềm (Software Architecture)
Dự án được cấu trúc theo chuẩn Modular Programming trên môi trường **PlatformIO**, giúp dễ dàng bảo trì và phát triển:
* `main.cpp`: Khởi tạo hệ thống, setup WiFi, cấu hình các hàng đợi (Queues/Mutexes) và phân luồng FreeRTOS Task.
* `network_manager.cpp`: Xử lý WiFi, đồng bộ NTP Server và vòng lặp MQTT (Pub/Sub).
* `rfid_manager.cpp`: Đọc tín hiệu RFID, so khớp UID với Database nội bộ và tính toán trạng thái điểm danh.
* `display_manager.cpp`: Quản lý giao diện LCD, hiệu ứng LED/Buzzer theo State Machine (Idle, Granted, Denied).
* `keypad_manager.cpp`: Quản lý sự kiện bàn phím, xác thực mật khẩu.
* `sensor_manager.cpp`: Đọc DHT22 và đánh giá rủi ro cháy nổ.
* `servo_manager.cpp`: Điều khiển góc xoay của Servo (Đóng/Mở) an toàn bằng hardware timer.
* `user_db.cpp`: Database giả lập lưu trữ danh sách sinh viên hợp lệ.

## ⚙️ Hướng dẫn Cài đặt & Build (PlatformIO)
1. Cài đặt VS Code và extension **PlatformIO IDE**.
2. Clone repository này về máy.
3. Mở thư mục dự án bằng PlatformIO.
4. Cài đặt các thư viện cần thiết (có thể thêm vào `platformio.ini`):
   * `LiquidCrystal_I2C`
   * `MFRC522`
   * `DHT sensor library`
   * `Keypad`
   * `ESP32Servo`
   * `PubSubClient`
5. Điều chỉnh lại thông tin mạng trong `network_manager.cpp`:
