#include "rfid_manager.h"
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>
#include "config.h"
#include "shared_data.h"
#include "user_db.h"
#include "servo_manager.h"

static MFRC522 mfrc522(SS_PIN, RST_PIN);

// Kiểm tra trạng thái điểm danh dựa trên thông tin thời gian của sinh viên
static int checkAttendanceStatus(const User& user) {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo, 10)) {
        return STATUS_UNKNOWN; // Lỗi thời gian / WiFi
    }

    int currentMins = timeinfo.tm_hour * 60 + timeinfo.tm_min;
    int startMins = user.startH * 60 + user.startM;
    int lateMins = user.lateH * 60 + user.lateM;
    int endMins = user.endH * 60 + user.endM;

    // Logic điểm danh theo lớp
    if (currentMins < startMins - 5) {
        return STATUS_TOO_EARLY; // Quẹt quá sớm (> 5 phút trước giờ bắt đầu)
    } 
    else if (currentMins >= startMins - 5 && currentMins <= lateMins) {
        return STATUS_ON_TIME;   // Đến trước hoặc đúng ngưỡng trễ => ĐÚNG GIỜ
    } 
    else if (currentMins > lateMins && currentMins <= endMins) {
        return STATUS_LATE;      // Quá ngưỡng trễ nhưng chưa hết ca => ĐI TRỄ
    } 
    else {
        return STATUS_TIME_OVER; // Ca học đã kết thúc
    }
}

// Tìm bản ghi phù hợp nhất cho cardID tại thời điểm hiện tại:
//   - Ưu tiên bản ghi có cửa sổ thời gian đang active (currentMins nằm trong [start-5, end])
//   - Fallback: bản ghi đầu tiên tìm thấy theo UID (nếu không ca nào active)
// Mutex phải được giữ bởi caller hoặc dùng getUserSafe bên ngoài.
// Hàm này đọc database[] trực tiếp (cần gọi trong vùng mutex hoặc sau getUserSafe).
static bool findBestUserRecord(uint32_t cardID, int currentMins, User* outUser) {
    int fallbackIdx = -1;
    for (int i = 0; i < totalCards; i++) {
        if (database[i].uidHash != cardID) continue;
        if (fallbackIdx == -1) fallbackIdx = i; // Lưu bản đầu tiên làm fallback

        int startMins = database[i].startH * 60 + database[i].startM;
        int endMins   = database[i].endH   * 60 + database[i].endM;
        if (currentMins >= (startMins - 5) && currentMins <= endMins) {
            // Ca này đang active → đây là bản ghi tốt nhất
            *outUser = database[i];
            return true;
        }
    }
    // Không có ca nào active → dùng fallback (bản đầu tiên theo UID)
    if (fallbackIdx >= 0) {
        *outUser = database[fallbackIdx];
        return true;
    }
    return false;
}

void rfidTask(void *pvParameters) {
    SPI.begin();
    mfrc522.PCD_Init();

    while (1) {
        if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
            uint32_t cardID = 0;
            for (byte i = 0; i < mfrc522.uid.size; i++) {
                cardID = (cardID << 8) | mfrc522.uid.uidByte[i];
            }

            // Lấy thời gian hiện tại một lần để dùng chung
            struct tm timeinfo;
            bool timeOk = getLocalTime(&timeinfo, 50);
            int currentMins = timeOk ? (timeinfo.tm_hour * 60 + timeinfo.tm_min) : -1;

            // Tìm bản ghi phù hợp nhất (ca đang active) dưới Mutex
            User foundUser;
            bool userExists = false;
            if (xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(200)) == pdPASS) {
                userExists = findBestUserRecord(cardID, currentMins, &foundUser);
                xSemaphoreGive(settingsMutex);
            }

            int sess = 1;
            if (xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(100)) == pdPASS) {
                sess = shared_currentSession;
                xSemaphoreGive(settingsMutex);
            }

            MqttPayload mqttPayload;
            memset(&mqttPayload, 0, sizeof(mqttPayload));
            mqttPayload.uidHash = cardID;

            DisplayMessage uiPayload;
            memset(&uiPayload, 0, sizeof(uiPayload));
            uiPayload.cmd = CMD_SHOW_ATTENDANCE;
            uiPayload.uidHash = cardID;
            uiPayload.session = sess;

            if (userExists) {
                int status = checkAttendanceStatus(foundUser);

                Serial.printf("[RFID] UID=%08lX | Name=%s | Class=%s | St=%02d:%02d | Lt=%02d:%02d | Et=%02d:%02d | NowMins=%d | Status=%d\n",
                    (unsigned long)cardID,
                    foundUser.name, foundUser.className,
                    foundUser.startH, foundUser.startM,
                    foundUser.lateH,  foundUser.lateM,
                    foundUser.endH,   foundUser.endM,
                    currentMins, status);

                uiPayload.granted = true;
                formatMSSV(foundUser.idIndex, uiPayload.mssv, sizeof(uiPayload.mssv));
                strncpy(uiPayload.name, foundUser.name, sizeof(uiPayload.name) - 1);
                uiPayload.status = status;

                // Mở cổng nếu đúng giờ hoặc đi muộn hợp lệ
                if (status == STATUS_ON_TIME || status == STATUS_LATE) {
                    unlock_gate();
                }

                mqttPayload.idIndex = foundUser.idIndex;
                strncpy(mqttPayload.name, foundUser.name, sizeof(mqttPayload.name) - 1);

                switch (status) {
                    case STATUS_ON_TIME:   strncpy(mqttPayload.status, "DUNG_GIO", sizeof(mqttPayload.status) - 1); break;
                    case STATUS_LATE:      strncpy(mqttPayload.status, "DI_MUON",  sizeof(mqttPayload.status) - 1); break;
                    case STATUS_ABSENT:    strncpy(mqttPayload.status, "VANG",     sizeof(mqttPayload.status) - 1); break;
                    case STATUS_TOO_EARLY: strncpy(mqttPayload.status, "CHUA_TOI", sizeof(mqttPayload.status) - 1); break;
                    case STATUS_TIME_OVER: strncpy(mqttPayload.status, "HET_GIO",  sizeof(mqttPayload.status) - 1); break;
                    default:               strncpy(mqttPayload.status, "KHONG_RO", sizeof(mqttPayload.status) - 1); break;
                }
            } else {
                // Thẻ không có trong Database
                uiPayload.granted = false;
                snprintf(uiPayload.mssv, sizeof(uiPayload.mssv), "%08lX", (unsigned long)cardID);
                strncpy(uiPayload.name, "Unknown", sizeof(uiPayload.name) - 1);
                uiPayload.status = STATUS_UNKNOWN;

                mqttPayload.idIndex = -1;
                strncpy(mqttPayload.name, "Unknown", sizeof(mqttPayload.name) - 1);
                strncpy(mqttPayload.status, "THE_LA", sizeof(mqttPayload.status) - 1);

                Serial.printf("[RFID] UID=%08lX khong ton tai trong database!\n", (unsigned long)cardID);
            }

            // Gửi dữ liệu sang Queue (không đợi vĩnh viễn)
            xQueueSend(mqttTxQueue, &mqttPayload, pdMS_TO_TICKS(100));
            xQueueSend(displayQueue, &uiPayload, pdMS_TO_TICKS(100));

            mfrc522.PICC_HaltA();
            mfrc522.PCD_StopCrypto1();

            // Chờ 1.5 giây để tránh quét lặp thẻ
            vTaskDelay(pdMS_TO_TICKS(1500));
        }

        vTaskDelay(pdMS_TO_TICKS(30));
    }
}
