#include "display_manager.h"
#include <LiquidCrystal_I2C.h>
#include "shared_data.h"

LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

UIState currentUIState = UI_IDLE;
static unsigned long uiTimer = 0;
static int beepCounter = 0;
static int targetBeeps = 0;

void setup_display_hardware() {
    vTaskDelay(pdMS_TO_TICKS(200));
    lcd.init();
    lcd.backlight();
    pinMode(LED_R, OUTPUT); pinMode(LED_G, OUTPUT); 
    pinMode(LED_B, OUTPUT); pinMode(BUZZER, OUTPUT);
    digitalWrite(LED_R, LOW); digitalWrite(LED_G, LOW); 
    digitalWrite(LED_B, LOW); digitalWrite(BUZZER, LOW);
}

// Xử lý Còi và Đèn LED phản hồi trực quan
void triggerVisualFeedback(bool granted, int status) {
    beepCounter = 0; 
    uiTimer = millis(); 
    digitalWrite(BUZZER, HIGH); 

    if (granted) {
        if (status == STATUS_ON_TIME) {
            digitalWrite(LED_G, HIGH); 
            currentUIState = UI_GRANTED_BEEP_ON;
        } 
        else if (status == STATUS_LATE || status == STATUS_ABSENT) {
            digitalWrite(LED_R, HIGH); 
            targetBeeps = 1;
            currentUIState = UI_DENIED_BEEP_ON;
        } 
        else if (status == STATUS_TOO_EARLY || status == STATUS_TIME_OVER) {
            digitalWrite(LED_R, HIGH); 
            targetBeeps = 3;
            currentUIState = UI_DENIED_BEEP_ON;
        } 
        else {
            digitalWrite(LED_R, HIGH); 
            targetBeeps = 1;
            currentUIState = UI_DENIED_BEEP_ON;
        }
    } else {
        digitalWrite(LED_R, HIGH); 
        targetBeeps = 3;
        currentUIState = UI_DENIED_BEEP_ON;
    }
}

void handle_ui_state_machine() {
    unsigned long now = millis();

    // Kiểm tra cảnh báo cháy để hú còi liên tục
    bool isFire = false;
    if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(10)) == pdPASS) {
        isFire = shared_fireAlert;
        xSemaphoreGive(settingsMutex);
    }

    if (isFire) {
        static unsigned long lastFireToggle = 0;
        static bool fireAlarmState = false;
        if (now - lastFireToggle >= 250) {
            lastFireToggle = now;
            fireAlarmState = !fireAlarmState;
            digitalWrite(LED_R, fireAlarmState ? HIGH : LOW);
            digitalWrite(BUZZER, fireAlarmState ? HIGH : LOW);
            digitalWrite(LED_G, LOW);
            digitalWrite(LED_B, LOW);
        }
        currentUIState = UI_IDLE;
        return;
    }

    switch (currentUIState) {
        case UI_GRANTED_BEEP_ON:
            if (now - uiTimer >= 150) { 
                digitalWrite(BUZZER, LOW); 
                currentUIState = UI_GRANTED_BEEP_OFF; 
                uiTimer = now; 
            }
            break;
            
        case UI_GRANTED_BEEP_OFF:
            if (now - uiTimer >= 850) { 
                digitalWrite(LED_G, LOW); 
                currentUIState = UI_COOLDOWN; 
                uiTimer = now; 
            }
            break;
            
        case UI_DENIED_BEEP_ON:
            if (now - uiTimer >= 150) { 
                digitalWrite(BUZZER, LOW); 
                currentUIState = UI_DENIED_BEEP_OFF; 
                uiTimer = now; 
            }
            break;
            
        case UI_DENIED_BEEP_OFF:
            if (now - uiTimer >= 100) {
                if (++beepCounter < targetBeeps) { 
                    digitalWrite(BUZZER, HIGH); 
                    currentUIState = UI_DENIED_BEEP_ON; 
                }
                else { 
                    digitalWrite(LED_R, LOW); 
                    currentUIState = UI_COOLDOWN; 
                }
                uiTimer = now;
            }
            break;
            
        case UI_COOLDOWN:
            if (now - uiTimer >= 3000) { 
                lcd.clear(); 
                currentUIState = UI_IDLE; 
            }
            break;
            
        default: break;
    }
}

void displayTask(void *pvParameters) {
    setup_display_hardware();
    lcd.clear();

    DisplayMessage msg;
    bool isPasswordMode = false;
    struct tm timeinfo;
    char lineBuffer[21];

    while (1) {
        handle_ui_state_machine();

        if (xQueueReceive(displayQueue, &msg, pdMS_TO_TICKS(50)) == pdPASS) {
            if (msg.cmd == CMD_SHOW_ATTENDANCE) {
                isPasswordMode = false;
                lcd.clear();
                
                if (msg.granted) {
                    lcd.setCursor(0, 0);
                    snprintf(lineBuffer, sizeof(lineBuffer), "%-20.20s", msg.name);
                    lcd.print(lineBuffer);

                    lcd.setCursor(0, 1);
                    switch(msg.status) {
                        case STATUS_ON_TIME:   lcd.print("Trang thai: DUNG GIO"); break;
                        case STATUS_LATE:      lcd.print("Trang thai: DI TRE  "); break;
                        case STATUS_ABSENT:    lcd.print("Trang thai: VANG    "); break;
                        case STATUS_TOO_EARLY: lcd.print("Loi: CHUA TOI GIO   "); break;
                        case STATUS_TIME_OVER: lcd.print("Loi: CA HOC DA HET  "); break;
                        default:               lcd.print("Trang thai: KHONG RO"); break;
                    }

                    lcd.setCursor(0, 2);
                    snprintf(lineBuffer, sizeof(lineBuffer), "MSSV: %-14s", msg.mssv);
                    lcd.print(lineBuffer);
                } else {
                    lcd.setCursor(0, 0);
                    snprintf(lineBuffer, sizeof(lineBuffer), "ID: %-16s", msg.mssv);
                    lcd.print(lineBuffer);

                    lcd.setCursor(0, 2);
                    lcd.print("THE KHONG HOP LE    ");
                }
                triggerVisualFeedback(msg.granted, msg.status);
            }
            else if (msg.cmd == CMD_SHOW_PASSWORD_UI) {
                isPasswordMode = true;
                currentUIState = UI_IDLE;
                lcd.clear();
                lcd.setCursor(0, 0); lcd.print("--- CHE DO PWD ---  ");
                lcd.setCursor(0, 2); lcd.print("Nhap mat khau:      ");
            }
            else if (msg.cmd == CMD_UPDATE_PWD_DOTS) {
                isPasswordMode = true;
                lcd.setCursor(0, 3);
                char dots[21] = {0};
                int dLen = msg.pwd_len > 8 ? 8 : msg.pwd_len;
                for (int i = 0; i < dLen; i++) dots[i] = '*';
                dots[dLen] = '\0';
                snprintf(lineBuffer, sizeof(lineBuffer), "%-20s", dots);
                lcd.print(lineBuffer);
            }
            else if (msg.cmd == CMD_SHOW_MSG_TEMP) {
                isPasswordMode = false;
                lcd.clear();
                const char* textToShow = (strlen(msg.tempMsg) > 0) ? msg.tempMsg : msg.name;
                lcd.setCursor(0, 1);
                snprintf(lineBuffer, sizeof(lineBuffer), "%-20.20s", textToShow);
                lcd.print(lineBuffer);
                
                if (strcmp(textToShow, "MAT KHAU DUNG!") == 0) {
                    triggerVisualFeedback(true, STATUS_ON_TIME);
                } else {
                    triggerVisualFeedback(false, STATUS_LATE);
                }
            }
        } 
        else {
            // Chế độ màn hình chính (IDLE): Cập nhật mỗi giây
            if (currentUIState == UI_IDLE && !isPasswordMode) {
                static unsigned long lastTimeUpdate = 0;
                
                if (millis() - lastTimeUpdate >= 1000) {
                    lastTimeUpdate = millis();
                    
                    if (getLocalTime(&timeinfo, 10)) {
                        // Dòng 0: Đồng hồ
                        snprintf(lineBuffer, sizeof(lineBuffer), "Time: %02d:%02d:%02d      ",
                                 timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
                        lcd.setCursor(0, 0);
                        lcd.print(lineBuffer);
                        
                        // Đọc an toàn thông tin lớp học dưới Mutex
                        char localClassName[32] = "";
                        int localStartH = 0, localStartM = 0;
                        int localEndH = 0, localEndM = 0;
                        bool localHasQuery = false;

                        if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(20)) == pdPASS) {
                            localHasQuery = hasActiveQuery;
                            if (localHasQuery) {
                                strncpy(localClassName, currentClassName, sizeof(localClassName) - 1);
                                localClassName[sizeof(localClassName) - 1] = '\0';
                                localStartH = currentClassStartH;
                                localStartM = currentClassStartM;
                                localEndH = currentClassEndH;
                                localEndM = currentClassEndM;
                            }
                            xSemaphoreGive(settingsMutex);
                        }

                        // Dòng 1 & 2: Thông tin lớp học
                        lcd.setCursor(0, 1);
                        if (localHasQuery) {
                            snprintf(lineBuffer, sizeof(lineBuffer), "%-20.20s", localClassName);
                            lcd.print(lineBuffer);

                            lcd.setCursor(0, 2);
                            snprintf(lineBuffer, sizeof(lineBuffer), "Ca: %02d:%02d - %02d:%02d   ",
                                     localStartH, localStartM, localEndH, localEndM);
                            lcd.print(lineBuffer);
                        } else {
                            lcd.print("KHONG CO LOP HOC    ");
                            lcd.setCursor(0, 2);
                            lcd.print("Moi quet the...     ");
                        }

                        // Dòng 3: Tiêu đề
                        lcd.setCursor(0, 3);
                        lcd.print("HE THONG DIEM DANH  ");
                    }
                }
            }
        }
    }
}
