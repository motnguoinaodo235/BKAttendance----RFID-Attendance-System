#include "sensor_manager.h"
#include <DHT.h>
#include "config.h"
#include "shared_data.h"
#include "dht_anomaly_model.h"

#include <TensorFlowLite_ESP32.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_error_reporter.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"

static DHT dht(DHTPIN, DHTTYPE);

// ==========================================
// CÁC BIẾN TOÀN CỤC CHO TINYML
// ==========================================
namespace {
    tflite::ErrorReporter* error_reporter = nullptr;
    const tflite::Model* model = nullptr;
    tflite::MicroInterpreter* interpreter = nullptr;
    TfLiteTensor* input = nullptr;
    TfLiteTensor* output = nullptr;
    
    constexpr int kTensorArenaSize = 4 * 1024; 
    uint8_t tensor_arena[kTensorArenaSize];
}

// Khởi tạo mô hình TinyML
static bool setupTinyML() {
    static tflite::MicroErrorReporter micro_error_reporter;
    error_reporter = &micro_error_reporter;

    model = tflite::GetModel(dht_anomaly_model_tflite);
    if (!model || model->version() != TFLITE_SCHEMA_VERSION) {
        Serial.println("[TinyML] Loi: Phien ban TFLite Schema khong khop hoac model rong!");
        return false;
    }

    static tflite::AllOpsResolver resolver;
    static tflite::MicroInterpreter static_interpreter(
        model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
    interpreter = &static_interpreter;

    TfLiteStatus allocate_status = interpreter->AllocateTensors();
    if (allocate_status != kTfLiteOk) {
        Serial.println("[TinyML] Loi: Khong the cap phat bo nho Tensors!");
        return false;
    }

    input = interpreter->input(0);
    output = interpreter->output(0);
    
    Serial.println("[TinyML] Khoi tao model thanh cong!");
    return (input != nullptr && output != nullptr);
}

void sensorTask(void *pvParameters) {
    dht.begin();
    bool mlReady = setupTinyML();

    // Đếm số lần đọc (dùng cho timestamp trong chế độ data log)
    unsigned long sampleCount = 0;

    while (1) {
        // DHT22 yêu cầu khoảng 2 giây giữa các lần đọc
        vTaskDelay(pdMS_TO_TICKS(2000)); 
        
        float h = dht.readHumidity();
        float t = dht.readTemperature();

        // Bỏ qua nếu lỗi đọc cảm biến
        if (isnan(h) || isnan(t)) {
            Serial.println("[DHT22] Loi doc cam bien!");
            continue;
        }

        sampleCount++;
        bool isFire = false;
        float anomaly_score = -1.0f;

        if (mlReady && input != nullptr && output != nullptr) {
            // Nạp dữ liệu: [Nhiệt độ, Độ ẩm]
            input->data.f[0] = t; 
            input->data.f[1] = h; 

            TfLiteStatus invoke_status = interpreter->Invoke();
            if (invoke_status == kTfLiteOk) {
                anomaly_score = output->data.f[0];
                
                if (anomaly_score > 0.80f) {
                    isFire = true;
                }
            } else {
                Serial.println("[TinyML] Inference that bai!");
            }
        } else {
            // Fallback ngưỡng nhiệt độ đơn giản nếu TinyML chưa sẵn sàng
            if (t > 60.0f || (t > 50.0f && h < 20.0f)) {
                isFire = true;
            }
        }

        // ════════════════════════════════════════════════════════════
        // CHẾ ĐỘ GHI DỮ LIỆU (DATA LOG) cho pipeline TinyML
        // Luôn in dòng CSV qua Serial để script Python có thể thu thập.
        // Định dạng: [DHT_DATA] timestamp_ms,temperature,humidity,anomaly_score,fire_label
        //   - fire_label: 0 = Bình thường, 1 = Bất thường / Cháy
        //   - anomaly_score: -1.0 nếu TinyML chưa sẵn sàng
        // Script collect_data.py sẽ parse dòng có prefix [DHT_DATA]
        // ════════════════════════════════════════════════════════════
        Serial.printf("[DHT_DATA] %lu,%.2f,%.2f,%.4f,%d\n",
            millis(), t, h, anomaly_score, isFire ? 1 : 0);

        // Log thông thường với chi tiết TinyML
        if (anomaly_score >= 0.0f) {
            Serial.printf("[DHT22] T: %.1fC - H: %.1f%% -> Nguy co chay: %.1f%% | Sample #%lu\n",
                t, h, anomaly_score * 100.0f, sampleCount);
        } else {
            Serial.printf("[DHT22] T: %.1fC - H: %.1f%% | TinyML chua san sang | Sample #%lu\n",
                t, h, sampleCount);
        }

        // Cập nhật biến toàn cục an toàn dưới Mutex
        if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(100)) == pdPASS) {
            shared_temp = t;
            shared_hum = h;
            shared_fireAlert = isFire;
            xSemaphoreGive(settingsMutex);
        }

        // Bắn cảnh báo cháy lên Queue gửi MQTT
        if (isFire) {
            Serial.println(">> [CANH BAO CHAY] Phat hien nguy co hoa hoan! <<");
            MqttPayload alertPayload;
            memset(&alertPayload, 0, sizeof(alertPayload));
            alertPayload.idIndex = 999; 
            strncpy(alertPayload.name, "FIRE_ALARM", sizeof(alertPayload.name) - 1);
            strncpy(alertPayload.status, "DANGER", sizeof(alertPayload.status) - 1);
            xQueueSend(mqttTxQueue, &alertPayload, pdMS_TO_TICKS(100));
        }
    }
}
