# DADN-BKAttendance: Hệ thống Điểm danh Thông minh & Cảnh báo An toàn Toàn diện

## 🌟 Tổng quan Dự án
**DADN-BKAttendance** là một hệ thống IoT hoàn chỉnh (Full-stack IoT), kết hợp giữa **Thiết bị phần cứng nhúng (Edge Device - ESP32)** và **Trạm điều khiển trung tâm (Web Dashboard)**. 

Dự án không chỉ giải quyết bài toán quản lý điểm danh tự động mà còn tích hợp tính năng an toàn, tự động mở cửa khẩn cấp khi phát hiện nguy cơ cháy nổ. Toàn bộ dữ liệu được đồng bộ hóa theo thời gian thực thông qua giao thức MQTT.

## 🏗 Kiến trúc Hệ thống (System Architecture)

Hệ thống bao gồm 3 thành phần chính:
1. **Thiết bị Nhúng (ESP32 Firmware):** Trạm xử lý tại hiện trường. Đảm nhận việc đọc thẻ RFID, xác thực mật khẩu qua Keypad, điều khiển Servo, cảnh báo bằng còi/LED, đọc cảm biến môi trường (DHT22) và quản lý tiến trình bằng hệ điều hành thời gian thực (FreeRTOS).
2. **MQTT Broker (HiveMQ Cloud):** Trung tâm trung chuyển tin nhắn. Đảm bảo dữ liệu điểm danh từ ESP32 được gửi lên Web và các lệnh điều khiển từ Web được truyền xuống ESP32 với độ trễ thấp nhất.
3. **Trạm Điều Khiển (Node.js Web Dashboard):** Giao diện quản lý dành cho Admin. Hiển thị log điểm danh trực tiếp và cho phép điều chỉnh cấu hình hệ thống (thời gian bắt đầu, kết thúc, đổi ca, gửi thông báo).

## 📂 Cấu trúc Repository (Thư mục dự án)

```text
📦 DADN-BKAttendance
 ┣ 📂 hardware         # Source code C++ cho ESP32 (Sử dụng PlatformIO)
 ┃ ┣ 📜 main.cpp
 ┃ ┣ 📜 rfid_manager.cpp
 ┃ ┗ 📜 ... (Chi tiết xem tại README trong thư mục Firmware)
 ┣ 📂 demo_web          # Source code Node.js cho Trạm điều khiển Web
 ┃ ┣ 📜 server.js
 ┃ ┣ 📜 index.html
 ┃ ┗ 📜 package.json   # (Chi tiết xem tại README trong thư mục WebDemo)
 ┗ 📜 README.md        # File giới thiệu tổng quan này (Nhánh main)
