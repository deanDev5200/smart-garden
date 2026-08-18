/**
 * ESP32 Smart Garden - Smart Garden with Valve Control
 * Features:
 * - DHT11 temperature and humidity sensor
 * - Soil moisture sensor
 * - Water valve control (selenoid)
 * - LCD 16x2 I2C display
 * - MQTT communication with SSL/TLS
 * - Non-blocking code using millis()
 */

#include <WiFi.h>               // WiFi library for ESP32
#include <WiFiClientSecure.h>   // Secure WiFi client for ESP32
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include "config.h"              // Configuration file (create from config.h.example)

// MQTT topics
const char* TOPIC_TEMPERATURE = "smart-garden/sensors/temperature";
const char* TOPIC_HUMIDITY = "smart-garden/sensors/humidity";
const char* TOPIC_SOIL_MOISTURE = "smart-garden/sensors/soil-moisture";
const char* TOPIC_VALVE_CONTROL = "smart-garden/control/valve";
const char* TOPIC_VALVE_STATUS = "smart-garden/status/valve";
const char* TOPIC_AUTO_CONTROL = "smart-garden/control/auto";
const char* TOPIC_AUTO_STATUS = "smart-garden/status/auto";

// Pin definitions untuk ESP32
#define DHT_PIN 4           // DHT11 sensor pin (GPIO4)
#define SOIL_MOISTURE_PIN 34  // Soil moisture sensor analog pin (GPIO34)
#define VALVE_PIN 18        // Relay control pin for water valve (GPIO5)

// I2C pin definitions for ESP32
#define SDA_PIN 21         // SDA pin (GPIO21)
#define SCL_PIN 22         // SCL pin (GPIO22)

// DHT sensor setup
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);

// LCD setup
LiquidCrystal_I2C lcd(0x27, 16, 2); // I2C address 0x27, 16 column and 2 rows

// Timers for non-blocking operation
unsigned long previousMillisSensor = 0;
unsigned long previousMillisDisplay = 0;
unsigned long previousMillisReconnect = 0;
unsigned long previousMillisNonBlockingDelay = 0;

// Variables to store sensor readings
float temperature = 0.0;
float humidity = 0.0;
int soilMoisture = 0;
bool valveStatus = false;

// Sensor detection status
bool dhtSensorDetected = false;
bool soilMoistureSensorDetected = false;
bool usingDummyData = false;
int dhtReadAttempts = 0;

// Valve control mode (auto/manual)
bool autoMode = true;

// Automatic control state tracking
unsigned long lastWateringTime = 0;
unsigned long currentWateringStartTime = 0;
bool isWatering = false;
bool autoControlEnabled = AUTO_CONTROL_ENABLED;

// Button state variables
int buttonValveState = HIGH;
int buttonAutoState = HIGH;
int buttonDisplayState = HIGH;
int lastButtonValveState = HIGH;
int lastButtonAutoState = HIGH;
int lastButtonDisplayState = HIGH;
unsigned long buttonValvePressTime = 0;
unsigned long buttonAutoPressTime = 0;
unsigned long buttonDisplayPressTime = 0;
bool buttonValvePressed = false;
bool buttonAutoPressed = false;
bool buttonDisplayPressed = false;

// Display page counter
int displayPage = 0;
const int maxPages = 3;

// WiFi and MQTT clients
WiFiClientSecure espClient;
PubSubClient client(espClient);

// Function prototypes
void connectWifi();
void reconnectMqtt();
void callback(char* topic, byte* payload, unsigned int length);
void readSensors();
void updateDisplay();
void controlValve(bool status);
void publishData();
void handleAutoMode();
bool nonBlockingDelay(unsigned long milliseconds);
void generateDummySensorData();
bool detectSensors();
bool isWithinWateringWindow();
bool shouldStartWatering();
bool shouldStopWatering();
void handleAdvancedAutoMode();
void setupButtons();
void handleButtons();
void handleValveButton();
void handleAutoButton();
void handleDisplayButton();

void setup() {
  // Initialize serial
  Serial.begin(115200);
  Serial.println("\nStarting Smart Garden IoT Device for ESP32");

  // Initialize pins
  pinMode(VALVE_PIN, OUTPUT);
  digitalWrite(VALVE_PIN, HIGH); // Valve off initially

  // Initialize buttons with INPUT_PULLUP
  pinMode(BUTTON_VALVE_PIN, INPUT_PULLUP);
  pinMode(BUTTON_AUTO_PIN, INPUT_PULLUP);
  pinMode(BUTTON_DISPLAY_PIN, INPUT_PULLUP);

  // Initialize I2C and LCD
  Wire.begin(SDA_PIN, SCL_PIN); // SDA=21, SCL=22 for ESP32
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Smart Garden IoT");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  // Initialize sensors
  dht.begin();

  // Detect sensors
  if (DEVELOPMENT_MODE) {
    detectSensors();
    if (usingDummyData) {
      Serial.println("Development mode: Using dummy sensor data");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("DEV MODE");
      lcd.setCursor(0, 1);
      lcd.print("Dummy Sensors");
      delay(2000);
    }
  }

  // Setup SSL/TLS - Use proper certificate validation
  // For production, load the CA certificate and use setCACert()
  // For development with self-signed certs, you may need setInsecure()
  espClient.setInsecure(); // TODO: Replace with proper CA certificate validation
  
  // Connect to WiFi
  connectWifi();
  
  // Setup MQTT client
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(callback);

  // Non-blocking splash screen delay
  previousMillisNonBlockingDelay = millis();
  
  lcd.clear();
}

void loop() {
  // Current time
  unsigned long currentMillis = millis();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  // Check MQTT connection
  if (!client.connected()) {
    if (currentMillis - previousMillisReconnect >= RECONNECT_INTERVAL) {
      previousMillisReconnect = currentMillis;
      reconnectMqtt();
    }
  } else {
    client.loop();
  }

  // Read sensors at specified interval
  if (currentMillis - previousMillisSensor >= SENSOR_READ_INTERVAL) {
    previousMillisSensor = currentMillis;
    readSensors();
    publishData();
    
    // Handle automatic valve control if in auto mode
    if (autoMode) {
      handleAdvancedAutoMode();
    }
  }

  // Update display at specified interval
  if (currentMillis - previousMillisDisplay >= DISPLAY_UPDATE_INTERVAL) {
    previousMillisDisplay = currentMillis;
    updateDisplay();
  }
  
  // Handle button inputs
  handleButtons();
}

// Connect to WiFi
void connectWifi() {
  // Only attempt to connect if not already connected
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1000);
    return;
  }

  // Disconnect first to clear any previous connection state
  WiFi.disconnect();
  delay(100);
  
  Serial.printf("Connecting to %s with %s", WIFI_SSID, WIFI_PASSWORD);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    lcd.setCursor(attempts % 16, 1);
    lcd.print(".");
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(1000);
  } else {
    Serial.println("\nWiFi connection failed");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    lcd.setCursor(0, 1);
    lcd.print("Retrying...");
  }
}

// Reconnect to MQTT broker
void reconnectMqtt() {
  Serial.print("Connecting to MQTT...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting MQTT");
  
  // Create a random client ID
  String clientId = MQTT_CLIENT_ID;
  clientId += String(random(0xffff), HEX);
  
  // Attempt to connect
  if (client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println("connected");
    lcd.setCursor(0, 1);
    lcd.print("Connected!");
    
    // Subscribe to topics
    client.subscribe(TOPIC_VALVE_CONTROL);
    client.subscribe(TOPIC_AUTO_CONTROL);
    
    // Publish current status
    publishData();
  } else {
    Serial.print("failed, rc=");
    Serial.print(client.state());
    
    lcd.setCursor(0, 1);
    lcd.print("Failed: ");
    lcd.print(client.state());
  }
}

// MQTT callback function
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  // Convert payload to string
  char message[length + 1];
  for (unsigned int i = 0; i < length; i++) {
    message[i] = (char)payload[i];
    Serial.print((char)payload[i]);
  }
  Serial.println();
  message[length] = '\0';
  
  // Handle valve control commands
  if (String(topic) == TOPIC_VALVE_CONTROL) {
    if (String(message) == "on") {
      controlValve(true);
      autoMode = false; // Switch to manual mode when controlled remotely
      Serial.println("Valve turned ON via MQTT");
    } else if (String(message) == "off") {
      controlValve(false);
      autoMode = false; // Switch to manual mode when controlled remotely
      Serial.println("Valve turned OFF via MQTT");
    }
  }
  
  // Handle auto control commands
  if (String(topic) == TOPIC_AUTO_CONTROL) {
    if (String(message) == "on") {
      autoMode = true;
      Serial.println("Auto mode enabled via MQTT");
      publishData(); // Publish updated status
    } else if (String(message) == "off") {
      autoMode = false;
      // Turn off valve if it was auto-controlled
      if (isWatering) {
        controlValve(false);
        isWatering = false;
        currentWateringStartTime = 0;
      }
      Serial.println("Auto mode disabled via MQTT");
      publishData(); // Publish updated status
    }
  }
}

// Read sensors
void readSensors() {
  if (usingDummyData) {
    // Use dummy data in development mode
    generateDummySensorData();
  } else {
    // Read DHT sensor
    float newTemp = dht.readTemperature();
    float newHum = dht.readHumidity();
    
    // Check if readings are valid
    if (!isnan(newTemp)) {
      temperature = newTemp;
      dhtSensorDetected = true;
    } else {
      dhtReadAttempts++;
      if (dhtReadAttempts >= DHT_DETECTION_ATTEMPTS && DEVELOPMENT_MODE) {
        dhtSensorDetected = false;
        Serial.println("DHT sensor not detected after multiple attempts");
      }
    }
    
    if (!isnan(newHum)) {
      humidity = newHum;
    }
    
    // Read soil moisture sensor
    int rawMoistureValue = analogRead(SOIL_MOISTURE_PIN);
    
    // Check if soil moisture sensor is connected (analog reading should be within reasonable range)
    if (rawMoistureValue > 100 && rawMoistureValue < 4095) {
      soilMoistureSensorDetected = true;
      // Convert analog reading to percentage using configured calibration values
      soilMoisture = map(rawMoistureValue, SOIL_MOISTURE_DRY, SOIL_MOISTURE_WET, 0, 100);
      soilMoisture = constrain(soilMoisture, 0, 100);
    } else {
      soilMoistureSensorDetected = false;
      if (DEVELOPMENT_MODE) {
        Serial.println("Soil moisture sensor not detected");
      }
    }
  }
  
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(humidity);
  Serial.print("%, Soil Moisture: ");
  Serial.print(soilMoisture);
  Serial.print("%");
  if (usingDummyData) {
    Serial.print(" (DUMMY)");
  }
  Serial.println();
}

// Control valve
void controlValve(bool status) {
  // Invert LOW/HIGH because we're using active low relay
  digitalWrite(VALVE_PIN, status ? LOW : HIGH);
  valveStatus = status;
  
  // Publish valve status
  client.publish(TOPIC_VALVE_STATUS, status ? "on" : "off", true);
  
  Serial.print("Valve ");
  Serial.println(status ? "ON" : "OFF");
}

// Publish sensor data
void publishData() {
  if (client.connected()) {
    // Publish temperature
    char tempStr[10];
    dtostrf(temperature, 1, 1, tempStr);
    client.publish(TOPIC_TEMPERATURE, tempStr);
    
    // Publish humidity
    char humStr[10];
    dtostrf(humidity, 1, 1, humStr);
    client.publish(TOPIC_HUMIDITY, humStr);
    
    // Publish soil moisture
    char soilStr[10];
    dtostrf(soilMoisture, 1, 0, soilStr);
    client.publish(TOPIC_SOIL_MOISTURE, soilStr);
    
    // Publish valve status
    client.publish(TOPIC_VALVE_STATUS, valveStatus ? "on" : "off", true);
    
    // Publish auto control status
    client.publish(TOPIC_AUTO_STATUS, autoMode ? "on" : "off", true);
  }
}

// Update LCD display
void updateDisplay() {
  lcd.clear();
  
  switch (displayPage) {
    case 0: // Page 1: Temperature and Humidity
      lcd.setCursor(0, 0);
      lcd.print("Temp: ");
      lcd.print(temperature, 1);
      lcd.print((char)223); // Degree symbol
      lcd.print("C");
      
      lcd.setCursor(0, 1);
      lcd.print("Humi: ");
      lcd.print(humidity, 1);
      lcd.print("%");
      break;
      
    case 1: // Page 2: Soil Moisture and Valve Status
      lcd.setCursor(0, 0);
      lcd.print("Soil: ");
      lcd.print(soilMoisture);
      lcd.print("%");
      
      lcd.setCursor(0, 1);
      lcd.print("Valve: ");
      lcd.print(valveStatus ? "ON" : "OFF");
      break;
      
    case 2: // Page 3: Mode and Network
      lcd.setCursor(0, 0);
      lcd.print("Mode: ");
      lcd.print(autoMode ? "AUTO" : "MANUAL");
      
      lcd.setCursor(0, 1);
      lcd.print("MQTT: ");
      lcd.print(client.connected() ? "CONN" : "DISC");
      break;
  }
}

// Logic for automatic valve control
void handleAutoMode() {
  // Turn on valve if soil moisture is too low
  if (soilMoisture < SOIL_MOISTURE_THRESHOLD_LOW) {
    if (!valveStatus) {
      controlValve(true);
      Serial.println("Auto: Valve turned ON (low moisture)");
    }
  } 
  // Turn off valve if soil moisture is high enough
  else if (soilMoisture > SOIL_MOISTURE_THRESHOLD_HIGH) {
    if (valveStatus) {
      controlValve(false);
      Serial.println("Auto: Valve turned OFF (adequate moisture)");
    }
  }
}

// Check if current time is within allowed watering window
bool isWithinWateringWindow() {
  // Get current time from NTP or use system time
  // For now, we'll use a simple check based on hours
  // In production, you'd want to use NTP time
  unsigned long currentMillis = millis();
  unsigned long hours = (currentMillis / 3600000) % 24; // Approximate hours from uptime
  
  // For development, always return true
  // In production, implement proper time checking
  return true;
}

// Check all conditions to determine if watering should start
bool shouldStartWatering() {
  // Check if auto control is enabled
  if (!autoControlEnabled || !autoMode) {
    return false;
  }
  
  // Check if already watering
  if (isWatering) {
    return false;
  }
  
  // Check minimum interval since last watering
  if (lastWateringTime > 0 && (millis() - lastWateringTime) < MIN_WATERING_INTERVAL) {
    Serial.println("Auto: Skipping - minimum interval not reached");
    return false;
  }
  
  // Check if within watering window
  if (!isWithinWateringWindow()) {
    Serial.println("Auto: Skipping - outside watering window");
    return false;
  }
  
  // Check soil moisture threshold
  if (soilMoisture >= SOIL_MOISTURE_THRESHOLD_LOW) {
    return false;
  }
  
  // Check temperature condition
  if (temperature > MAX_TEMP_FOR_WATERING) {
    Serial.printf("Auto: Skipping - temperature too high (%.1f°C)\n", temperature);
    return false;
  }
  
  // Check humidity condition
  if (humidity < MIN_HUMIDITY_FOR_WATERING) {
    Serial.printf("Auto: Skipping - humidity too low (%.1f%%)\n", humidity);
    return false;
  }
  
  return true;
}

// Check conditions to determine if watering should stop
bool shouldStopWatering() {
  if (!isWatering) {
    return false;
  }
  
  // Check if maximum duration reached
  if (currentWateringStartTime > 0 && (millis() - currentWateringStartTime) >= MAX_WATERING_DURATION) {
    Serial.println("Auto: Stopping - maximum duration reached");
    return true;
  }
  
  // Check if soil moisture target reached
  if (soilMoisture >= SOIL_MOISTURE_THRESHOLD_HIGH) {
    Serial.println("Auto: Stopping - moisture target reached");
    return true;
  }
  
  return false;
}

// Advanced automatic control logic
void handleAdvancedAutoMode() {
  if (!autoControlEnabled || !autoMode) {
    // If auto is disabled, ensure valve is off if it was auto-controlled
    if (isWatering) {
      controlValve(false);
      isWatering = false;
      currentWateringStartTime = 0;
    }
    return;
  }
  
  // Check if we should start watering
  if (shouldStartWatering() && !valveStatus) {
    controlValve(true);
    isWatering = true;
    currentWateringStartTime = millis();
    Serial.println("Auto: Watering started");
  }
  
  // Check if we should stop watering
  if (shouldStopWatering() && valveStatus) {
    controlValve(false);
    isWatering = false;
    lastWateringTime = millis();
    currentWateringStartTime = 0;
    Serial.println("Auto: Watering stopped");
  }
}

// Non-blocking delay function
bool nonBlockingDelay(unsigned long milliseconds) {
  static unsigned long delayStartTime = 0;
  static bool delayInProgress = false;
  
  if (!delayInProgress) {
    delayStartTime = millis();
    delayInProgress = true;
    return false;
  }
  
  if (millis() - delayStartTime >= milliseconds) {
    delayInProgress = false;
    return true; // Delay completed
  }
  
  return false; // Delay still in progress
}

// Generate dummy sensor data for development mode
void generateDummySensorData() {
  // Generate realistic dummy data with some variation
  static unsigned long lastDummyUpdate = 0;
  static float dummyTemp = 25.0;
  static float dummyHum = 60.0;
  static int dummySoil = 45;
  
  unsigned long currentTime = millis();
  
  // Update dummy values every 5 seconds to simulate sensor changes
  if (currentTime - lastDummyUpdate >= 5000) {
    lastDummyUpdate = currentTime;
    
    // Add small random variations
    dummyTemp += random(-5, 6) / 10.0; // -0.5 to +0.5
    dummyHum += random(-5, 6); // -5 to +5
    dummySoil += random(-3, 4); // -3 to +3
    
    // Constrain to realistic ranges
    dummyTemp = constrain(dummyTemp, 18.0, 35.0); // 18-35°C
    dummyHum = constrain(dummyHum, 30, 90); // 30-90%
    dummySoil = constrain(dummySoil, 10, 90); // 10-90%
  }
  
  temperature = dummyTemp;
  humidity = dummyHum;
  soilMoisture = dummySoil;
}

// Detect if sensors are connected
bool detectSensors() {
  Serial.println("Detecting sensors...");
  
  // Try to read DHT sensor multiple times
  dhtSensorDetected = false;
  dhtReadAttempts = 0;
  
  for (int i = 0; i < DHT_DETECTION_ATTEMPTS; i++) {
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();
    
    if (!isnan(temp) && !isnan(hum)) {
      dhtSensorDetected = true;
      Serial.println("DHT sensor detected");
      break;
    }
    delay(1000); // Wait 1 second between attempts
  }
  
  if (!dhtSensorDetected) {
    Serial.println("DHT sensor NOT detected");
  }
  
  soilMoistureSensorDetected = true;
  Serial.println("Soil moisture sensor detected");
  
  // Determine if we should use dummy data
  if (!dhtSensorDetected || !soilMoistureSensorDetected) {
    usingDummyData = true;
    Serial.println("One or more sensors not detected - using dummy data");
    return false;
  } else {
    usingDummyData = false;
    Serial.println("All sensors detected - using real data");
    return true;
  }
}

// Setup button functionality
void setupButtons() {
  // Buttons are already initialized in setup() with INPUT_PULLUP
  Serial.println("Buttons initialized");
}

// Handle all button inputs
void handleButtons() {
  handleValveButton();
  handleAutoButton();
  handleDisplayButton();
}

// Handle valve toggle button
void handleValveButton() {
  int currentState = digitalRead(BUTTON_VALVE_PIN);
  
  // Detect button press (LOW because of INPUT_PULLUP)
  if (currentState == LOW && lastButtonValveState == HIGH) {
    buttonValvePressTime = millis();
    buttonValvePressed = true;
  }
  
  // Detect button release
  if (currentState == HIGH && lastButtonValveState == LOW && buttonValvePressed) {
    unsigned long pressDuration = millis() - buttonValvePressTime;
    
    // Short press - toggle valve
    if (pressDuration < LONG_PRESS_DURATION) {
      controlValve(!valveStatus);
      autoMode = false; // Switch to manual mode
      Serial.println("Button: Valve toggled (manual mode)");
      publishData(); // Update status
    }
    
    buttonValvePressed = false;
  }
  
  lastButtonValveState = currentState;
}

// Handle auto mode toggle button
void handleAutoButton() {
  int currentState = digitalRead(BUTTON_AUTO_PIN);
  
  // Detect button press (LOW because of INPUT_PULLUP)
  if (currentState == LOW && lastButtonAutoState == HIGH) {
    buttonAutoPressTime = millis();
    buttonAutoPressed = true;
  }
  
  // Detect button release
  if (currentState == HIGH && lastButtonAutoState == LOW && buttonAutoPressed) {
    unsigned long pressDuration = millis() - buttonAutoPressTime;
    
    // Short press - toggle auto mode
    if (pressDuration < LONG_PRESS_DURATION) {
      autoMode = !autoMode;
      Serial.printf("Button: Auto mode %s\n", autoMode ? "enabled" : "disabled");
      
      // If disabling auto mode and valve was auto-controlled, turn it off
      if (!autoMode && isWatering) {
        controlValve(false);
        isWatering = false;
        currentWateringStartTime = 0;
      }
      
      publishData(); // Update status
    }
    // Long press - force immediate watering cycle
    else {
      if (autoMode && autoControlEnabled) {
        Serial.println("Button: Force watering cycle triggered");
        if (!valveStatus && !isWatering) {
          controlValve(true);
          isWatering = true;
          currentWateringStartTime = millis();
        }
      }
    }
    
    buttonAutoPressed = false;
  }
  
  lastButtonAutoState = currentState;
}

// Handle display cycle/emergency stop button
void handleDisplayButton() {
  int currentState = digitalRead(BUTTON_DISPLAY_PIN);
  
  // Detect button press (LOW because of INPUT_PULLUP)
  if (currentState == LOW && lastButtonDisplayState == HIGH) {
    buttonDisplayPressTime = millis();
    buttonDisplayPressed = true;
  }
  
  // Detect button release
  if (currentState == HIGH && lastButtonDisplayState == LOW && buttonDisplayPressed) {
    unsigned long pressDuration = millis() - buttonDisplayPressTime;
    
    // Short press - cycle display
    if (pressDuration < LONG_PRESS_DURATION) {
      displayPage = (displayPage + 1) % maxPages;
      updateDisplay();
      Serial.printf("Button: Display page changed to %d\n", displayPage);
    }
    // Long press - emergency stop
    else {
      Serial.println("Button: EMERGENCY STOP triggered");
      if (valveStatus) {
        controlValve(false);
        isWatering = false;
        currentWateringStartTime = 0;
        autoMode = false; // Disable auto mode after emergency stop
        Serial.println("Emergency: Valve turned OFF, auto mode disabled");
        publishData(); // Update status
      }
      
      // Show emergency message on LCD
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("EMERGENCY STOP");
      lcd.setCursor(0, 1);
      lcd.print("Valve OFF");
      delay(2000);
    }
    
    buttonDisplayPressed = false;
  }
  
  lastButtonDisplayState = currentState;
}