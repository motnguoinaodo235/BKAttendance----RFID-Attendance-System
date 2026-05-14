#include "sensor_manager.h"

DHT dht(DHTPIN, DHTTYPE);


bool predictFireRisk(float temp, float hum) {
    // Logic tạm thời khi chưa gắn Model: Nhiệt độ > 60 hoặc (Nhiệt độ > 50 & Độ ẩm < 20%)
    if (temp > 60.0 || (temp > 50.0 && hum < 20.0)) {
        return true; 
    }
    return false;
}

void sensorTask(void *pvParameters) {
    dht.begin();
    
    while (1) {
        // DHT22 cần khoảng 2 giây giữa các lần đọc
        vTaskDelay(pdMS_TO_TICKS(2000)); 
        
        float h = dht.readHumidity();
        float t = dht.readTemperature();

        // Bỏ qua nếu lỗi đọc cảm biến
        if (isnan(h) || isnan(t)) {
            Serial.println("Loi doc cam bien DHT22!");
            continue;
        }

        // Chạy model dự đoán
        bool isFire = predictFireRisk(t, h);

        // Cập nhật biến toàn cục một cách an toàn
        xSemaphoreTake(settingsMutex, portMAX_DELAY);
        shared_temp = t;
        shared_hum = h;
        shared_fireAlert = isFire;
        xSemaphoreGive(settingsMutex);

        if (isFire) {
            Serial.printf("CẢNH BÁO CHÁY! Nhiệt độ: %.1fC - Độ ẩm: %.1f%%\n", t, h);
            // Gửi cảnh báo lên Queue để MQTT gửi đi (Tùy chọn)
            MqttPayload alertPayload;
            alertPayload.idIndex = 999; // ID đặc biệt cho hệ thống
            strncpy(alertPayload.name, "FIRE_ALARM", 31);
            strncpy(alertPayload.status, "DANGER", 15);
            xQueueSend(mqttTxQueue, &alertPayload, pdMS_TO_TICKS(10));
        }
    }
}