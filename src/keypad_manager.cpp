#include "keypad_manager.h"
#include <Keypad.h>
#include "config.h"
#include "shared_data.h"
#include "servo_manager.h"

static byte rowPins[KEYPAD_ROWS] = KEYPAD_ROW_PINS;
static byte colPins[KEYPAD_COLS] = KEYPAD_COL_PINS;

static char keys[KEYPAD_ROWS][KEYPAD_COLS] = {
    {'1','2','3'},
    {'4','5','6'},
    {'7','8','9'}
};

static Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, KEYPAD_ROWS, KEYPAD_COLS);

void keypadTask(void *pvParameters) {
    char inputBuffer[16] = {0};
    int inputLen = 0;
    int wrongCount = 0;
    unsigned long lastActivity = 0;
    bool isEnteringPwd = false;
    const int pwdTargetLen = strlen(ACCESS_PASSWORD);

    while (1) {
        char key = keypad.getKey();

        if (key) {
            lastActivity = millis();
            
            if (!isEnteringPwd) {
                if (key == '1') { // Nhấn phím '1' để bắt đầu nhập mật khẩu
                    isEnteringPwd = true;
                    inputLen = 0;
                    inputBuffer[0] = '\0';

                    DisplayMessage msg;
                    memset(&msg, 0, sizeof(msg));
                    msg.cmd = CMD_SHOW_PASSWORD_UI;
                    xQueueSend(displayQueue, &msg, pdMS_TO_TICKS(100));
                }
            } else {
                // Đang trong chế độ nhập mật khẩu
                if (inputLen < (int)(sizeof(inputBuffer) - 1)) {
                    inputBuffer[inputLen++] = key;
                    inputBuffer[inputLen] = '\0';

                    DisplayMessage msg;
                    memset(&msg, 0, sizeof(msg));
                    msg.cmd = CMD_UPDATE_PWD_DOTS;
                    msg.pwd_len = inputLen;
                    xQueueSend(displayQueue, &msg, pdMS_TO_TICKS(100));
                }

                if (inputLen == pwdTargetLen) {
                    DisplayMessage msg;
                    memset(&msg, 0, sizeof(msg));
                    msg.cmd = CMD_SHOW_MSG_TEMP;

                    if (strcmp(inputBuffer, ACCESS_PASSWORD) == 0) {
                        unlock_gate();
                        strncpy(msg.tempMsg, "MAT KHAU DUNG!", sizeof(msg.tempMsg) - 1);
                        strncpy(msg.name, "MAT KHAU DUNG!", sizeof(msg.name) - 1);
                        wrongCount = 0;
                    } else {
                        wrongCount++;
                        if (wrongCount >= 3) {
                            strncpy(msg.tempMsg, "SAI QUA 3 LAN!", sizeof(msg.tempMsg) - 1);
                            strncpy(msg.name, "SAI QUA 3 LAN!", sizeof(msg.name) - 1);
                            wrongCount = 0;
                        } else {
                            strncpy(msg.tempMsg, "SAI MAT KHAU!", sizeof(msg.tempMsg) - 1);
                            strncpy(msg.name, "SAI MAT KHAU!", sizeof(msg.name) - 1);
                        }
                    }
                    xQueueSend(displayQueue, &msg, pdMS_TO_TICKS(100));
                    isEnteringPwd = false;
                    inputLen = 0;
                }
            }
        }

        // Kiểm tra timeout không thao tác
        if (isEnteringPwd && (millis() - lastActivity > PWD_TIMEOUT)) {
            isEnteringPwd = false;
            inputLen = 0;

            DisplayMessage msg;
            memset(&msg, 0, sizeof(msg));
            msg.cmd = CMD_SHOW_MSG_TEMP;
            strncpy(msg.tempMsg, "HET THOI GIAN!", sizeof(msg.tempMsg) - 1);
            strncpy(msg.name, "HET THOI GIAN!", sizeof(msg.name) - 1);
            xQueueSend(displayQueue, &msg, pdMS_TO_TICKS(100));
        }

        vTaskDelay(pdMS_TO_TICKS(40));
    }
}
