#ifndef SERVO_MANAGER_H
#define SERVO_MANAGER_H

#include <Arduino.h>

void setup_servo();
void unlock_gate();
void servoTask(void *pvParameters);

#endif // SERVO_MANAGER_H
