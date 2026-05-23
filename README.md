markdown_web = """# 🌐 Trạm Điều Khiển BKAttendance (Web Dashboard)

## 📖 Giới thiệu
Đây là giao diện điều khiển trung tâm (Web Dashboard) dành riêng cho hệ thống điểm danh **DADN-BKAttendance**. Ứng dụng được xây dựng trên nền tảng **Node.js**, đóng vai trò như một trạm giám sát và điều khiển từ xa cho mạch ESP32 thông qua giao thức **MQTT**.

## 🚀 Các tính năng chính
* **Theo dõi thời gian thực (Real-time Terminal):** Lắng nghe dữ liệu quẹt thẻ, trạng thái hệ thống và các cảnh báo từ mạch ESP32 (thông qua topic `test/vinh/mqtt/send`) và hiển thị ngay lập tức lên màn hình bằng WebSockets.
* **Cài đặt mốc thời gian:** Gửi lệnh cấu hình **Giờ Bắt Đầu** (Deadline) và **Giờ Kết Thúc** (End Time) xuống ESP32 để hệ thống tự động tính toán trạng thái (Đi muộn, Hết giờ).
* **Quản lý Ca làm việc/Học tập:** Chuyển đổi trạng thái điểm danh (Ca 1 - Vào, Ca 2 - Ra) linh hoạt bằng một nút bấm.
* **Gửi thông báo tùy chỉnh:** Cho phép người quản lý gửi các đoạn văn bản ngắn (tối đa 16 ký tự) để hiển thị trực tiếp lên màn hình LCD của ESP32.

## 🛠 Công nghệ sử dụng (Tech Stack)
* **Backend:** Node.js, Express.js
* **Real-time Communication:** Socket.io (kết nối Backend với Frontend)
* **IoT Protocol:** thư viện `mqtt` (kết nối Backend với Broker HiveMQ)
* **Frontend:** HTML5, CSS3, Vanilla JS (Giao diện đơn giản, tối ưu tốc độ)

## ⚙️ Hướng dẫn Cài đặt & Chạy dự án (Localhost)

**1. Yêu cầu hệ thống:**
* Máy tính đã cài đặt [Node.js](https://nodejs.org/).

**2. Cài đặt thư viện:**
Mở terminal/command prompt tại thư mục chứa file `server.js` và chạy lệnh:
npm start
Hoặc chạy lệnh: node server.js
