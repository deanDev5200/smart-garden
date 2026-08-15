/**
 * Configuration file for ESP32 Smart Garden
 * Copy this file to config.h and update with your actual credentials
 * IMPORTANT: Add config.h to .gitignore to prevent committing credentials
 */

#ifndef CONFIG_H
#define CONFIG_H

// WiFi credentials
const char* WIFI_SSID = "Skanbara_AP";
const char* WIFI_PASSWORD = "Skanbara2026";

// MQTT configuration
const char* MQTT_HOST = "8a98dc3536d94c1a92e7534295a892d4.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "garden-device";
const char* MQTT_PASSWORD = "device123";
const char* MQTT_CLIENT_ID = "esp32_smart_garden";

// Pin definitions untuk ESP32
#define DHT_PIN 4           // DHT11 sensor pin (GPIO4)
#define SOIL_MOISTURE_PIN 34  // Soil moisture sensor analog pin (GPIO34)
#define VALVE_PIN 5        // Relay control pin for water valve (GPIO5)

// Button pin definitions (using INPUT_PULLUP)
#define BUTTON_VALVE_PIN 12     // Manual valve toggle button (GPIO12)
#define BUTTON_AUTO_PIN 13      // Auto mode toggle button (GPIO13)
#define BUTTON_DISPLAY_PIN 14   // Display cycle/emergency stop button (GPIO14)

// Button settings
#define DEBOUNCE_DELAY 50        // Debounce delay in milliseconds
#define LONG_PRESS_DURATION 3000 // Long press duration in milliseconds (3 seconds)

// Sensor calibration values (adjust based on your sensors)
#define SOIL_MOISTURE_DRY 4095    // Analog value when soil is dry
#define SOIL_MOISTURE_WET 2000   // Analog value when soil is wet

// Automatic watering thresholds
#define SOIL_MOISTURE_THRESHOLD_LOW 30   // Turn on valve below this %
#define SOIL_MOISTURE_THRESHOLD_HIGH 60  // Turn off valve above this %

// Advanced automatic control settings
#define AUTO_CONTROL_ENABLED true        // Enable automatic control system
#define MAX_WATERING_DURATION 300000     // Maximum watering duration in ms (5 minutes)
#define MIN_WATERING_INTERVAL 1800000    // Minimum time between watering cycles in ms (30 minutes)
#define WATERING_WINDOW_START 6          // Earliest hour for auto watering (6 AM)
#define WATERING_WINDOW_END 20           // Latest hour for auto watering (8 PM)
#define MAX_TEMP_FOR_WATERING 35         // Don't water above this temperature (°C)
#define MIN_HUMIDITY_FOR_WATERING 40     // Don't water if humidity is too high (%)

// Development mode settings
#define DEVELOPMENT_MODE true     // Set to true for dummy sensor readings when sensors not detected
#define DHT_DETECTION_ATTEMPTS 5  // Number of attempts to detect DHT before using dummy data

// Timing intervals (in milliseconds)
const unsigned long SENSOR_READ_INTERVAL = 5000;    // 5 seconds
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000; // 1 second
const unsigned long RECONNECT_INTERVAL = 5000;      // 5 seconds

// Enable/disable features
const bool ENABLE_OTA_UPDATES = false;  // Set to true to enable OTA updates
const bool ENABLE_DEEP_SLEEP = false;  // Set to true to enable deep sleep mode

#endif
