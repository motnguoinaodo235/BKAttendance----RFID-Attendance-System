#include <Arduino.h>
#include "shared_data.h"
#include "network_manager.h"
#include "rfid_manager.h"
#include "sensor_manager.h"
#include "servo_manager.h"
#include "keypad_manager.h" 
#include "display_manager.h"

// Định nghĩa FreeRTOS Queues và Mutex
QueueHandle_t mqttTxQueue = NULL;
QueueHandle_t displayQueue = NULL;
SemaphoreHandle_t settingsMutex = NULL;

// Khởi tạo các biến dùng chung
int shared_currentSession = 1;
char shared_serverMessage[32] = "";

float shared_temp = 0.0f;
float shared_hum = 0.0f;
bool shared_fireAlert = false;

char currentClassName[64] = "";
int currentClassStartH = 0, currentClassStartM = 0;
int currentClassEndH = 0, currentClassEndM = 0;
bool hasActiveQuery = false;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n--- HE THONG DIEM DANH BK-ATTENDANCE KHOI DONG ---");

    mqttTxQueue = xQueueCreate(10, sizeof(MqttPayload));
    displayQueue = xQueueCreate(10, sizeof(DisplayMessage));
    settingsMutex = xSemaphoreCreateMutex();

    if (mqttTxQueue == NULL || displayQueue == NULL || settingsMutex == NULL) {
        Serial.println("[CRITICAL ERROR] Khong the khoi tao FreeRTOS Queues/Mutex!");
        return;
    }

    // Core 0: Mạng (WiFi, MQTT Loop, NTP, Sync DB)
    xTaskCreatePinnedToCore(networkTask, "Network", 8192, NULL, 1, NULL, 0);
    
    // Core 1: Hiển thị (LCD, LED, Buzzer) -> Priority 2 để UI mượt mà, phản hồi tức thì
    xTaskCreatePinnedToCore(displayTask, "Display", 4096, NULL, 2, NULL, 1);

    // Core 1: Đọc thẻ RFID MFRC522
    xTaskCreatePinnedToCore(rfidTask, "RFID", 4096, NULL, 1, NULL, 1);

    // Core 1: Điều khiển Servo mở/đóng cổng
    xTaskCreatePinnedToCore(servoTask, "Servo", 2048, NULL, 1, NULL, 1);

    // Cac Task tuy chon phan cung (Bat/tat theo nhu cau):
    xTaskCreatePinnedToCore(sensorTask, "Sensor", 8192, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(keypadTask, "Keypad", 3072, NULL, 1, NULL, 1);
}

void loop() {
    // Xóa Task loop mặc định của Arduino để giải phóng tài nguyên
    vTaskDelete(NULL); 
}
