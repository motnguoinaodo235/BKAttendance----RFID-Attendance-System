#ifndef USER_DB_H
#define USER_DB_H

#include <Arduino.h>

#define MAX_USERS 100

struct User {
    uint32_t uidHash;
    int idIndex;
    char name[32];
    char className[64]; 
    int startH, startM; 
    int endH, endM;
    int lateH, lateM;
};

extern User database[MAX_USERS];
extern int totalCards;

// Định dạng MSSV không cấp phát Heap
void formatMSSV(int index, char* outBuf, size_t maxLen);
String formatMSSV(int index);

// Tìm kiếm người dùng (không lock Mutex - dùng khi caller đã giữ Mutex)
int findUserIndex_unlocked(uint32_t uidHash);

// Tìm kiếm người dùng có lock Mutex (an toàn đa luồng)
int findUserIndex(uint32_t uidHash);

// Lấy bản sao thông tin User an toàn (thread-safe copy)
bool getUserSafe(uint32_t uidHash, User* outUser);

#endif // USER_DB_H
