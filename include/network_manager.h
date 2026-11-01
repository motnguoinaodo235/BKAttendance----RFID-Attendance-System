#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>
#include "shared_data.h"
#include "config.h"

void setup_wifi_and_time();
void networkTask(void *pvParameters);

#endif // NETWORK_MANAGER_H
