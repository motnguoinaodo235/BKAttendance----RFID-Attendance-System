#ifndef SHARED_DATA_H
#define SHARED_DATA_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>

// Enum chuẩn hóa trạng thái điểm danh
enum AttendanceStatus {
    STATUS_ON_TIME = 0,     // Đúng giờ
    STATUS_LATE = 1,        // Đi muộn (vẫn được tính điểm danh)
    STATUS_ABSENT = 2,      // Vắng (quá ngưỡng trễ)
    STATUS_TOO_EARLY = 3,   // Chưa tới giờ học (< start - 5 phút)
    STATUS_TIME_OVER = 4,   // Ca học đã kết thúc
    STATUS_UNKNOWN = 7      // Thẻ lạ, không có trong hệ thống
};

enum DisplayCmd {
    CMD_SHOW_WELCOME,
    CMD_SHOW_ATTENDANCE,
    CMD_SHOW_PASSWORD_UI,   // Màn hình "Nhap mat khau:"
    CMD_UPDATE_PWD_DOTS,    // Cập nhật số lượng ký tự *
    CMD_SHOW_MSG_TEMP       // Thông báo tạm thời (ví dụ: "MAT KHAU DUNG!")
};

// Struct gửi từ RFID / Cảm biến sang Network qua Queue
struct MqttPayload {
    uint32_t uidHash;
    int idIndex;
    char name[32];
    char status[16];
};

// Struct gửi sang UI qua Queue
struct DisplayMessage {
    DisplayCmd cmd;
    uint32_t uidHash;
    bool granted;
    char mssv[16];
    char name[32];
    int status;
    int session;
    int pwd_len;
    char tempMsg[32];
};

// FreeRTOS Queues & Semaphore Handles
extern QueueHandle_t mqttTxQueue;
extern QueueHandle_t displayQueue;
extern SemaphoreHandle_t settingsMutex;

// --- DỮ LIỆU DÙNG CHUNG (Bảo vệ bởi settingsMutex) ---
extern int shared_currentSession;
extern char shared_serverMessage[32];

// --- CẢNH BÁO MÔI TRƯỜNG & CHÁY ---
extern float shared_temp;
extern float shared_hum;
extern bool shared_fireAlert;

// --- DỮ LIỆU LỚP HỌC HIỆN TẠI (Bảo vệ bởi settingsMutex khi đọc/ghi) ---
extern char currentClassName[64];
extern int currentClassStartH, currentClassStartM;
extern int currentClassEndH, currentClassEndM;
extern bool hasActiveQuery;

#endif // SHARED_DATA_H
