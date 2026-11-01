#include "network_manager.h"
#include "user_db.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

static WiFiClient espClient;
static PubSubClient client(espClient);

void setup_wifi_and_time() {
    vTaskDelay(pdMS_TO_TICKS(10));
    Serial.printf("\n[WiFi] Dang ket noi toi SSID: %s...\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 40) { 
        vTaskDelay(pdMS_TO_TICKS(500)); 
        Serial.print("."); 
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Da ket noi! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Ket noi lan dau timeout, se thu lai trong loop.");
    }
    
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
}

static bool ensure_wifi_connected() {
    if (WiFi.status() == WL_CONNECTED) return true;
    
    Serial.println("\n[WiFi] Mat ket noi, dang thu ket noi lai...");
    WiFi.disconnect();
    WiFi.reconnect();
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10) {
        vTaskDelay(pdMS_TO_TICKS(500));
        attempts++;
    }
    return (WiFi.status() == WL_CONNECTED);
}

static bool mqtt_try_connect() {
    if (client.connected()) return true;
    if (!ensure_wifi_connected()) return false;

    Serial.print("[MQTT] Dang ket noi broker...");
    char clientId[32];
    snprintf(clientId, sizeof(clientId), "ESP32-Att-%04X", (uint16_t)random(0xffff));

    if (client.connect(clientId)) {
        Serial.println(" Thanh cong!");
        client.subscribe(MQTT_TOPIC_SUB); 
        return true;
    } else {
        Serial.printf(" That bai, rc=%d\n", client.state());
        return false;
    }
}

// Callback khi có tin nhắn MQTT đến
static void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    if (!payload || length == 0) return;

    Serial.printf("\n[MQTT NHAN]: %u bytes\n", length);

    // 1. Kiểm tra tiền tố "SYNC_DB:" trực tiếp trên buffer, không cấp phát String trung gian
    const char* prefix = "SYNC_DB:";
    const size_t prefixLen = 8;

    if (length >= prefixLen && memcmp(payload, prefix, prefixLen) == 0) {
        // Tối ưu: Parse trực tiếp từ buffer thô, loại bỏ hoàn toàn heap fragmentation
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload + prefixLen, length - prefixLen);
        
        if (!error) {
            JsonArray arr = doc.as<JsonArray>();
            int newTotal = 0;
            
            xSemaphoreTake(settingsMutex, portMAX_DELAY);
            for (JsonObject v : arr) {
                if (newTotal >= MAX_USERS) break;
                
                // UID & MSSV Index
                const char* uidHex = v["u"] | "";
                database[newTotal].uidHash = strtoul(uidHex, NULL, 16);
                database[newTotal].idIndex = v["i"] | 0;
                
                // Tên sinh viên
                const char* nStr = v["n"] | "Unknown";
                strncpy(database[newTotal].name, nStr, sizeof(database[newTotal].name) - 1);
                database[newTotal].name[sizeof(database[newTotal].name) - 1] = '\0';

                // Tên lớp học
                const char* cStr = v["c"] | "";
                strncpy(database[newTotal].className, cStr, sizeof(database[newTotal].className) - 1);
                database[newTotal].className[sizeof(database[newTotal].className) - 1] = '\0';

                // Giờ bắt đầu, kết thúc, trễ (có kiểm tra nullptr an toàn)
                int h = 0, m = 0, s = 0;
                const char* stStr = v["st"];
                if (stStr && sscanf(stStr, "%d:%d:%d", &h, &m, &s) >= 2) {
                    database[newTotal].startH = h;
                    database[newTotal].startM = m;
                } else {
                    database[newTotal].startH = 0;
                    database[newTotal].startM = 0;
                }

                const char* etStr = v["et"];
                if (etStr && sscanf(etStr, "%d:%d:%d", &h, &m, &s) >= 2) {
                    database[newTotal].endH = h;
                    database[newTotal].endM = m;
                } else {
                    database[newTotal].endH = 0;
                    database[newTotal].endM = 0;
                }

                const char* ltStr = v["lt"];
                if (ltStr && sscanf(ltStr, "%d:%d:%d", &h, &m, &s) >= 2) {
                    database[newTotal].lateH = h;
                    database[newTotal].lateM = m;
                } else {
                    database[newTotal].lateH = 0;
                    database[newTotal].lateM = 0;
                }

                newTotal++;
            }
            totalCards = newTotal;
            xSemaphoreGive(settingsMutex);

            // ── In toàn bộ dữ liệu nhận được từ server để debug ──────────────
            Serial.printf("[SYNC_DB] Nhan %d ban ghi tu server:\n", totalCards);
            for (int dbg = 0; dbg < totalCards; dbg++) {
                Serial.printf("  [%d] UID=%08lX | ID=%d | Name=%-20s | Class=%-30s | St=%02d:%02d | Et=%02d:%02d | Lt=%02d:%02d\n",
                    dbg,
                    (unsigned long)database[dbg].uidHash,
                    database[dbg].idIndex,
                    database[dbg].name,
                    database[dbg].className,
                    database[dbg].startH, database[dbg].startM,
                    database[dbg].endH,   database[dbg].endM,
                    database[dbg].lateH,  database[dbg].lateM);
            }
            Serial.println("[SYNC_DB] ----------------------------------------");
        } else {
            Serial.printf("[MQTT] Loi parse JSON: %s\n", error.c_str());
        }
    }
    else {
        // Tin nhắn dạng text thông thường từ server
        xSemaphoreTake(settingsMutex, portMAX_DELAY);
        size_t copyLen = length < (sizeof(shared_serverMessage) - 1) ? length : (sizeof(shared_serverMessage) - 1);
        memcpy(shared_serverMessage, payload, copyLen);
        shared_serverMessage[copyLen] = '\0';
        xSemaphoreGive(settingsMutex);
    }
}

static void checkAndUpdateActiveSession() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 50)) return;
    
    int currentMins = timeinfo.tm_hour * 60 + timeinfo.tm_min;
    bool found = false;

    // Tìm ca học đang diễn ra tại thời điểm hiện tại.
    // Vì mỗi (sinh viên × buổi học) là một bản ghi riêng, ta chỉ cần tìm
    // bản ghi ĐẦU TIÊN có cửa sổ thời gian bao phủ currentMins.
    // Nhờ server đã sắp xếp theo start_time ASC, bản ghi sớm nhất đang active
    // sẽ luôn được tìm thấy đầu tiên → không bị nhầm lớp.
    xSemaphoreTake(settingsMutex, portMAX_DELAY);
    
    // Bỏ qua các bản ghi trùng (cùng className+startH+startM) để tránh in lại
    char lastSeenClass[64] = "";
    int  lastSeenStartH = -1, lastSeenStartM = -1;

    for (int i = 0; i < totalCards; i++) {
        int startMins = database[i].startH * 60 + database[i].startM;
        int endMins   = database[i].endH   * 60 + database[i].endM;
        
        // Cửa sổ hợp lệ: [Bắt đầu - 5p] đến [Kết thúc]
        if (currentMins >= (startMins - 5) && currentMins <= endMins) {
            // Chỉ cập nhật nếu đây là ca mới (tránh ghi đè liên tục cùng ca)
            bool sameClass = (database[i].startH == lastSeenStartH &&
                              database[i].startM == lastSeenStartM &&
                              strncmp(database[i].className, lastSeenClass, sizeof(lastSeenClass)) == 0);
            if (!found || !sameClass) {
                strncpy(currentClassName, database[i].className, sizeof(currentClassName) - 1);
                currentClassName[sizeof(currentClassName) - 1] = '\0';
                currentClassStartH = database[i].startH;
                currentClassStartM = database[i].startM;
                currentClassEndH   = database[i].endH;
                currentClassEndM   = database[i].endM;

                strncpy(lastSeenClass, database[i].className, sizeof(lastSeenClass) - 1);
                lastSeenStartH = database[i].startH;
                lastSeenStartM = database[i].startM;
                found = true;
                break; // Lấy ca sớm nhất đang active, dừng luôn
            }
        }
    }
    hasActiveQuery = found;
    xSemaphoreGive(settingsMutex);

    // Debug: In ra lớp học đang hiển thị trên LCD
    Serial.printf("[LCD] Lop active: \"%s\" (%02d:%02d-%02d:%02d), hasActive=%d, nowMins=%d\n",
        found ? currentClassName : "(khong co)",
        currentClassStartH, currentClassStartM,
        currentClassEndH,   currentClassEndM,
        (int)hasActiveQuery,
        currentMins);
}

void networkTask(void *pvParameters) {
    setup_wifi_and_time();
    
    client.setBufferSize(16384);
    client.setServer(MQTT_BROKER, MQTT_PORT);
    client.setCallback(mqtt_callback);

    MqttPayload payload;
    unsigned long lastCheckTime = 0;
    unsigned long lastMqttRetry = 0;

    while (1) {
        // Tái kết nối MQTT không chặn luồng vĩnh viễn
        if (!client.connected()) {
            unsigned long now = millis();
            if (now - lastMqttRetry >= 5000) {
                lastMqttRetry = now;
                mqtt_try_connect();
            }
        } else {
            client.loop(); 
        }

        // Định kỳ 5s cập nhật lớp học hiện tại
        if (millis() - lastCheckTime >= 5000) {
            checkAndUpdateActiveSession();
            lastCheckTime = millis();
        }

        // Gửi dữ liệu điểm danh từ Queue lên MQTT (timeout 50ms)
        if (xQueueReceive(mqttTxQueue, &payload, pdMS_TO_TICKS(50)) == pdPASS) {
            xSemaphoreTake(settingsMutex, portMAX_DELAY);
            int session = shared_currentSession;
            xSemaphoreGive(settingsMutex);

            // Dùng stack buffer thay vì toán tử cộng String
            char txBuffer[256];
            snprintf(txBuffer, sizeof(txBuffer),
                     "uidHash: %08lX, idIndex: %d, name: %s, status: %s, session: %d",
                     (unsigned long)payload.uidHash,
                     payload.idIndex,
                     payload.name,
                     payload.status,
                     session);

            if (client.connected()) {
                client.publish(MQTT_TOPIC_PUB, txBuffer);
                Serial.printf("[MQTT Gui]: %s\n", txBuffer);
            } else {
                Serial.printf("[MQTT Chuyen that bai - Offline]: %s\n", txBuffer);
            }
        }
    }
}
