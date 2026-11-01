#include "user_db.h"
#include "shared_data.h"

User database[MAX_USERS];
int totalCards = 0;

void formatMSSV(int index, char* outBuf, size_t maxLen) {
    if (!outBuf || maxLen == 0) return;
    snprintf(outBuf, maxLen, "231%04d", index);
}

String formatMSSV(int index) {
    char buf[16]; 
    snprintf(buf, sizeof(buf), "231%04d", index); 
    return String(buf);
}

int findUserIndex_unlocked(uint32_t uidHash) {
    for (int i = 0; i < totalCards; i++) {
        if (database[i].uidHash == uidHash) return i;
    }
    return -1;
}

int findUserIndex(uint32_t uidHash) {
    int idx = -1;
    if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(100)) == pdPASS) {
        idx = findUserIndex_unlocked(uidHash);
        xSemaphoreGive(settingsMutex);
    }
    return idx;
}

bool getUserSafe(uint32_t uidHash, User* outUser) {
    if (!outUser) return false;
    bool found = false;
    if (settingsMutex != NULL && xSemaphoreTake(settingsMutex, pdMS_TO_TICKS(100)) == pdPASS) {
        int idx = findUserIndex_unlocked(uidHash);
        if (idx != -1) {
            *outUser = database[idx];
            found = true;
        }
        xSemaphoreGive(settingsMutex);
    }
    return found;
}

