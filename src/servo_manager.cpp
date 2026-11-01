#include "servo_manager.h"
#include <ESP32Servo.h>
#include "config.h"
#include "shared_data.h"

static Servo gateServo;
static volatile bool gateTriggered = false;
static bool isServoInitialized = false;

void setup_servo() {
    if (isServoInitialized) return;
    
    ESP32PWM::allocateTimer(0);
    ESP32PWM::allocateTimer(1);
    ESP32PWM::allocateTimer(2);
    ESP32PWM::allocateTimer(3);
    
    gateServo.setPeriodHertz(50);
    gateServo.attach(SERVO_PIN, 500, 2400); 
    gateServo.write(GATE_CLOSED_ANGLE);
    
    isServoInitialized = true;
}

void unlock_gate() {
    // Kích hoạt cờ an toàn, để servoTask độc quyền điều khiển góc quay
    gateTriggered = true;
}

void servoTask(void *pvParameters) {
    setup_servo();
    
    int currentAngle = GATE_CLOSED_ANGLE;
    gateServo.write(currentAngle);

    bool isGateOpen = false;
    unsigned long gateOpenTimer = 0;

    while (1) {
        unsigned long now = millis();

        // 1. Kiểm tra cảnh báo cháy
        bool fireDetected = false;
        if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(20)) == pdPASS) {
            fireDetected = shared_fireAlert;
            xSemaphoreGive(settingsMutex);
        }

        if (fireDetected) {
            // Khi có cháy, mở cửa khẩn cấp liên tục
            if (currentAngle != GATE_OPEN_ANGLE) {
                gateServo.write(GATE_OPEN_ANGLE);
                currentAngle = GATE_OPEN_ANGLE;
                isGateOpen = true;
                Serial.println("[Servo] CANH BAO CHAY: Mo toan bo cua thoat hiem!");
            }
        } else {
            // 2. Nhận tín hiệu mở cửa từ RFID / Keypad
            if (gateTriggered) {
                gateTriggered = false;
                isGateOpen = true;
                gateOpenTimer = now;
                
                if (currentAngle != GATE_OPEN_ANGLE) {
                    gateServo.write(GATE_OPEN_ANGLE);
                    currentAngle = GATE_OPEN_ANGLE;
                    Serial.println("[Servo] Mo cua!");
                }
            }

            // 3. Tự động đóng cửa sau khoảng thời gian quy định
            if (isGateOpen && (now - gateOpenTimer >= GATE_OPEN_DURATION)) {
                isGateOpen = false;
                if (currentAngle != GATE_CLOSED_ANGLE) {
                    gateServo.write(GATE_CLOSED_ANGLE);
                    currentAngle = GATE_CLOSED_ANGLE;
                    Serial.println("[Servo] Dong cua!");
                }
            }
        }

        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
