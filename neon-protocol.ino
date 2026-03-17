#include <FastLED.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==============================
// Hardware mapping (DFRduino Nano + Gravity Shield)
// ==============================
static const uint8_t PIN_LED_DATA = 6;      // WS2812B data
static const uint8_t PIN_MIC = A0;          // MAX4466
static const uint8_t PIN_FAN_1 = 9;         // PWM fan 1
static const uint8_t PIN_FAN_2 = 10;        // PWM fan 2
static const uint8_t PIN_ENC_A = 2;         // Rotary encoder A (interrupt)
static const uint8_t PIN_ENC_B = 3;         // Rotary encoder B (interrupt)
static const uint8_t PIN_ENC_SW = 4;        // Rotary encoder push button

// ==============================
// LED / OLED config
// ==============================
static const uint16_t LED_COUNT = 30;
CRGB leds[LED_COUNT];

static const uint8_t OLED_W = 128;
static const uint8_t OLED_H = 64;
Adafruit_SSD1306 display(OLED_W, OLED_H, &Wire, -1);

// ==============================
// SAFE MODE config
// ==============================
static const bool SAFE_MODE_DEFAULT = true;
static const uint8_t SAFE_BRIGHTNESS_MAX = 60;     // Hard cap when safe mode is ON
static const uint16_t SOFT_START_MS = 800;         // Brightness ramp duration
static const uint16_t COMMAND_GAP_MS = 300;        // Minimum delay between command applies
static const float SAFE_POWER_SCALE = 0.40f;       // 40% effect power in safe mode

// ==============================
// Runtime state
// ==============================
enum EffectMode : uint8_t {
  MODE_OFF = 0,
  MODE_RAINBOW,
  MODE_PULSE,
  MODE_MUSIC,
  MODE_LIGHTNING,
  MODE_STATIC
};

volatile int16_t encoderDelta = 0;
volatile uint8_t encLastState = 0;

bool safeMode = SAFE_MODE_DEFAULT;
bool hostConnected = false;
bool awaitingApply = false;

EffectMode effectMode = MODE_OFF;
CRGB staticColor = CRGB(255, 0, 100);

uint8_t currentBrightness = 20;
uint8_t targetBrightness = 20;
uint8_t effectSpeed = 50;       // Generic speed (0..255)
uint8_t musicSensitivity = 80;  // 0..255
uint8_t fan1Target = 0;
uint8_t fan2Target = 0;

uint32_t lastSoftStartTick = 0;
uint32_t softStartStartMs = 0;
uint8_t softStartStartValue = 20;

uint32_t lastCommandApplyMs = 0;
uint32_t lastSerialRxMs = 0;
uint32_t lastTelemetryMs = 0;
uint32_t lastOledMs = 0;

int micRaw = 0;
float pseudoTempC = 28.0f;
uint16_t pseudoRpm = 0;

String serialLine;
String pendingCommand;

// ==============================
// Utility parsing helpers (lightweight JSON extraction)
// ==============================
String trimCopy(String s) {
  s.trim();
  return s;
}

bool containsKey(const String &json, const char *key) {
  return json.indexOf(key) >= 0;
}

bool extractStringValue(const String &json, const char *key, String &out) {
  int k = json.indexOf(key);
  if (k < 0) return false;
  int q1 = json.indexOf('"', k + strlen(key));
  if (q1 < 0) return false;
  int q2 = json.indexOf('"', q1 + 1);
  if (q2 < 0) return false;
  out = json.substring(q1 + 1, q2);
  return true;
}

bool extractIntValue(const String &json, const char *key, int &out) {
  int k = json.indexOf(key);
  if (k < 0) return false;
  int c = json.indexOf(':', k);
  if (c < 0) return false;

  int i = c + 1;
  while (i < (int)json.length() && (json[i] == ' ' || json[i] == '\t')) i++;

  bool neg = false;
  if (i < (int)json.length() && json[i] == '-') {
    neg = true;
    i++;
  }
  if (i >= (int)json.length() || !isDigit(json[i])) return false;

  long val = 0;
  while (i < (int)json.length() && isDigit(json[i])) {
    val = val * 10 + (json[i] - '0');
    i++;
  }
  out = neg ? -val : val;
  return true;
}

bool extractFloatValue(const String &json, const char *key, float &out) {
  int k = json.indexOf(key);
  if (k < 0) return false;
  int c = json.indexOf(':', k);
  if (c < 0) return false;
  int i = c + 1;
  while (i < (int)json.length() && (json[i] == ' ' || json[i] == '\t')) i++;
  int end = i;
  while (end < (int)json.length() && (isDigit(json[end]) || json[end] == '.' || json[end] == '-')) end++;
  if (end <= i) return false;
  out = json.substring(i, end).toFloat();
  return true;
}

bool extractColorArray(const String &json, CRGB &colorOut) {
  int k = json.indexOf("\"color\"");
  if (k < 0) return false;
  int lb = json.indexOf('[', k);
  int rb = json.indexOf(']', lb);
  if (lb < 0 || rb < 0) return false;
  String body = json.substring(lb + 1, rb);

  int c1 = body.indexOf(',');
  int c2 = body.indexOf(',', c1 + 1);
  if (c1 < 0 || c2 < 0) return false;

  int r = trimCopy(body.substring(0, c1)).toInt();
  int g = trimCopy(body.substring(c1 + 1, c2)).toInt();
  int b = trimCopy(body.substring(c2 + 1)).toInt();

  colorOut = CRGB(
    constrain(r, 0, 255),
    constrain(g, 0, 255),
    constrain(b, 0, 255)
  );
  return true;
}

bool extractFansArray(const String &json, int &f1, int &f2) {
  int k = json.indexOf("\"fans\"");
  if (k < 0) return false;
  int lb = json.indexOf('[', k);
  int rb = json.indexOf(']', lb);
  if (lb < 0 || rb < 0) return false;
  String body = json.substring(lb + 1, rb);
  int c = body.indexOf(',');
  if (c < 0) return false;

  f1 = trimCopy(body.substring(0, c)).toInt();
  f2 = trimCopy(body.substring(c + 1)).toInt();
  return true;
}

// ==============================
// SAFE MODE + command application
// ==============================
uint8_t safeBrightnessCap(uint8_t value) {
  if (!safeMode) return value;
  return (uint8_t)min((int)value, (int)SAFE_BRIGHTNESS_MAX);
}

uint8_t powerScaleValue(uint8_t raw) {
  if (!safeMode) return raw;
  return (uint8_t)(raw * SAFE_POWER_SCALE);
}

void beginSoftStartTo(uint8_t newTarget) {
  softStartStartMs = millis();
  softStartStartValue = currentBrightness;
  targetBrightness = safeBrightnessCap(newTarget);
}

void updateSoftStart() {
  uint32_t now = millis();
  if (now - lastSoftStartTick < 20) return;
  lastSoftStartTick = now;

  if (currentBrightness == targetBrightness) return;
  float t = (float)(now - softStartStartMs) / (float)SOFT_START_MS;
  if (t > 1.0f) t = 1.0f;
  int nextVal = (int)(softStartStartValue + (targetBrightness - softStartStartValue) * t);
  currentBrightness = (uint8_t)constrain(nextVal, 0, 255);
}

void setSafeMode(bool enabled) {
  safeMode = enabled;
  targetBrightness = safeBrightnessCap(targetBrightness);
  currentBrightness = safeBrightnessCap(currentBrightness);
  fan1Target = powerScaleValue(fan1Target);
  fan2Target = powerScaleValue(fan2Target);
  Serial.print(F("[SAFE] mode="));
  Serial.println(safeMode ? F("ON") : F("OFF"));
}

void applyCommandNow(const String &json) {
  String effect;
  int iv = 0;
  float fv = 0.0f;

  // Compatibility: dashboard command style {"cmd":"..."} + requested JSON style
  String cmd;
  if (extractStringValue(json, "\"cmd\"", cmd)) {
    cmd.toUpperCase();
    if (cmd == "SET_SAFE_MODE") {
      int enabledInt = 1;
      if (extractIntValue(json, "\"enabled\"", enabledInt)) {
        setSafeMode(enabledInt != 0);
      } else {
        setSafeMode(containsKey(json, "true"));
      }
    } else if (cmd == "SET_BRIGHTNESS") {
      if (extractIntValue(json, "\"value\"", iv)) {
        beginSoftStartTo((uint8_t)constrain(iv, 0, 255));
      }
    } else if (cmd == "SET_FAN_SPEED") {
      if (extractIntValue(json, "\"value\"", iv)) {
        uint8_t v = powerScaleValue((uint8_t)constrain(iv, 0, 255));
        fan1Target = v;
        fan2Target = v;
      }
    } else if (cmd == "SET_FAN") {
      int fanId = 1;
      int onInt = 1;
      extractIntValue(json, "\"fan\"", fanId);
      if (containsKey(json, "\"on\"")) {
        onInt = containsKey(json, "true") ? 1 : 0;
      }
      uint8_t val = onInt ? powerScaleValue(fan1Target > 0 ? fan1Target : 140) : 0;
      if (fanId == 1) fan1Target = val;
      if (fanId == 2) fan2Target = val;
      if (fanId == 3) {
        // Optional third channel mapped to both fans for compatibility
        fan1Target = val;
        fan2Target = val;
      }
    } else if (cmd == "SET_LED_EFFECT") {
      if (extractStringValue(json, "\"effect\"", effect)) {
        effect.toUpperCase();
        if (effect == "RAINBOW") effectMode = MODE_RAINBOW;
        else if (effect == "PULSE") effectMode = MODE_PULSE;
        else if (effect == "MUSIC_MODE" || effect == "MUSIC") effectMode = MODE_MUSIC;
        else if (effect == "LIGHTNING") effectMode = MODE_LIGHTNING;
        else if (effect == "STATIC_COLOR") effectMode = MODE_STATIC;
        else if (effect == "OFF") effectMode = MODE_OFF;
      }
      CRGB c;
      if (extractColorArray(json, c)) staticColor = c;
    } else if (cmd == "SYNC") {
      if (extractIntValue(json, "\"brightness\"", iv)) beginSoftStartTo((uint8_t)constrain(iv, 0, 255));
      if (extractIntValue(json, "\"fanSpeed\"", iv)) {
        uint8_t v = powerScaleValue((uint8_t)constrain(iv, 0, 255));
        fan1Target = v;
        fan2Target = v;
      }
      if (containsKey(json, "\"safeMode\"")) {
        bool modeVal = containsKey(json, "true");
        setSafeMode(modeVal);
      }
    }
  }

  // Requested protocol exact forms:
  // {"effect":"RAINBOW","brightness":60,"speed":50}
  // {"effect":"PULSE","color":[255,0,100]}
  // {"effect":"MUSIC","sensitivity":80}
  // {"fans":[255,0]}
  // {"leds":"OFF"}

  if (extractStringValue(json, "\"effect\"", effect)) {
    String e = effect;
    e.toUpperCase();
    if (e == "RAINBOW") effectMode = MODE_RAINBOW;
    else if (e == "PULSE") effectMode = MODE_PULSE;
    else if (e == "MUSIC") effectMode = MODE_MUSIC;
    else if (e == "LIGHTNING") effectMode = MODE_LIGHTNING;
    else if (e == "STATIC" || e == "STATIC_COLOR") effectMode = MODE_STATIC;
    else if (e == "OFF") effectMode = MODE_OFF;
  }

  if (extractIntValue(json, "\"brightness\"", iv)) {
    beginSoftStartTo((uint8_t)constrain(iv, 0, 255));
  }

  if (extractIntValue(json, "\"speed\"", iv)) {
    effectSpeed = (uint8_t)constrain(iv, 0, 255);
  }

  if (extractIntValue(json, "\"sensitivity\"", iv)) {
    musicSensitivity = (uint8_t)constrain(iv, 0, 255);
  }

  CRGB c;
  if (extractColorArray(json, c)) {
    staticColor = c;
  }

  int f1 = -1, f2 = -1;
  if (extractFansArray(json, f1, f2)) {
    fan1Target = powerScaleValue((uint8_t)constrain(f1, 0, 255));
    fan2Target = powerScaleValue((uint8_t)constrain(f2, 0, 255));
  }

  String ledsCmd;
  if (extractStringValue(json, "\"leds\"", ledsCmd)) {
    ledsCmd.toUpperCase();
    if (ledsCmd == "OFF") effectMode = MODE_OFF;
  }

  if (extractFloatValue(json, "\"powerScale\"", fv)) {
    // Optional external hint. SAFE mode remains authority.
    (void)fv;
  }

  Serial.print(F("[CMD] "));
  Serial.println(json);
}

void enqueueOrApplyCommand(const String &json) {
  uint32_t now = millis();
  if (now - lastCommandApplyMs >= COMMAND_GAP_MS && !awaitingApply) {
    applyCommandNow(json);
    lastCommandApplyMs = now;
  } else {
    pendingCommand = json;
    awaitingApply = true;
  }
}

void processPendingCommand() {
  if (!awaitingApply) return;
  uint32_t now = millis();
  if (now - lastCommandApplyMs < COMMAND_GAP_MS) return;
  applyCommandNow(pendingCommand);
  lastCommandApplyMs = now;
  awaitingApply = false;
}

// ==============================
// Rotary encoder
// ==============================
void IRAM_ATTR encoderISR() {
  uint8_t a = digitalRead(PIN_ENC_A);
  uint8_t b = digitalRead(PIN_ENC_B);
  uint8_t state = (a << 1) | b;
  uint8_t combined = (encLastState << 2) | state;

  if (combined == 0b1101 || combined == 0b0100 || combined == 0b0010 || combined == 0b1011) encoderDelta++;
  if (combined == 0b1110 || combined == 0b0111 || combined == 0b0001 || combined == 0b1000) encoderDelta--;
  encLastState = state;
}

void handleEncoder() {
  static uint32_t lastEncoderMs = 0;
  if (millis() - lastEncoderMs < 20) return;
  lastEncoderMs = millis();

  int16_t delta;
  noInterrupts();
  delta = encoderDelta;
  encoderDelta = 0;
  interrupts();

  if (delta != 0) {
    int next = (int)targetBrightness + delta * 2;
    next = constrain(next, 0, 255);
    beginSoftStartTo((uint8_t)next);
    Serial.print(F("[ENC] brightness target="));
    Serial.println(targetBrightness);
  }

  static bool lastBtn = HIGH;
  bool btn = digitalRead(PIN_ENC_SW);
  if (lastBtn == HIGH && btn == LOW) {
    // Push cycles effects
    effectMode = (EffectMode)((effectMode + 1) % 6);
    Serial.print(F("[ENC] mode="));
    Serial.println(effectMode);
  }
  lastBtn = btn;
}

// ==============================
// Effects + telemetry + OLED
// ==============================
void renderRainbow() {
  static uint8_t hueOffset = 0;
  uint8_t speedStep = max<uint8_t>(1, effectSpeed / 32);
  for (uint16_t i = 0; i < LED_COUNT; i++) {
    leds[i] = CHSV((uint8_t)(i * 8 + hueOffset), 255, 255);
  }
  hueOffset += speedStep;
}

void renderPulse() {
  static uint16_t pulsePhase = 0;
  uint8_t speedStep = max<uint8_t>(1, effectSpeed / 16);
  pulsePhase += speedStep;
  uint8_t breath = (sin8(pulsePhase) / 2) + 127;
  CRGB c = staticColor;
  c.nscale8_video(breath);
  fill_solid(leds, LED_COUNT, c);
}

void renderMusic() {
  int centered = abs(micRaw - 512);
  int mapped = map(centered, 0, 512, 0, 255);
  mapped = (mapped * musicSensitivity) / 128;
  mapped = constrain(mapped, 0, 255);
  uint8_t lit = map(mapped, 0, 255, 0, LED_COUNT);
  for (uint16_t i = 0; i < LED_COUNT; i++) {
    if (i < lit) {
      leds[i] = CHSV((uint8_t)(i * 6 + millis() / 8), 255, 255);
    } else {
      leds[i] = CRGB::Black;
    }
  }
}

void renderLightning() {
  static uint32_t lastFlash = 0;
  static bool flashing = false;
  if (millis() - lastFlash > (120 + (255 - effectSpeed) * 2)) {
    lastFlash = millis();
    flashing = random8() > 170;
  }
  if (flashing) {
    fill_solid(leds, LED_COUNT, CRGB(180, 180, 255));
    int idx = random16(LED_COUNT);
    leds[idx] = CRGB::White;
  } else {
    fill_solid(leds, LED_COUNT, CRGB(6, 6, 16));
  }
}

void renderStatic() {
  fill_solid(leds, LED_COUNT, staticColor);
}

void renderOff() {
  fill_solid(leds, LED_COUNT, CRGB::Black);
}

const __FlashStringHelper* modeName() {
  switch (effectMode) {
    case MODE_RAINBOW: return F("RAINBOW");
    case MODE_PULSE: return F("PULSE");
    case MODE_MUSIC: return F("MUSIC");
    case MODE_LIGHTNING: return F("LIGHTNING");
    case MODE_STATIC: return F("STATIC");
    default: return F("OFF");
  }
}

void updateEffects() {
  switch (effectMode) {
    case MODE_RAINBOW: renderRainbow(); break;
    case MODE_PULSE: renderPulse(); break;
    case MODE_MUSIC: renderMusic(); break;
    case MODE_LIGHTNING: renderLightning(); break;
    case MODE_STATIC: renderStatic(); break;
    default: renderOff(); break;
  }

  uint8_t visBrightness = safeBrightnessCap(currentBrightness);
  if (safeMode) {
    visBrightness = (uint8_t)(visBrightness * SAFE_POWER_SCALE);
  }
  FastLED.setBrightness(visBrightness);
  FastLED.show();
}

void updateSensors() {
  static int micFiltered = 512;
  int raw = analogRead(PIN_MIC);
  micFiltered = (micFiltered * 7 + raw) / 8;
  micRaw = micFiltered;

  // Pseudo telemetry from available signals
  float fanLoad = (fan1Target + fan2Target) / 510.0f;
  pseudoTempC = 27.0f + fanLoad * 8.0f + (abs(micRaw - 512) / 512.0f) * 2.0f;
  pseudoRpm = (uint16_t)(600 + fanLoad * 1800);
}

void applyFans() {
  analogWrite(PIN_FAN_1, fan1Target);
  analogWrite(PIN_FAN_2, fan2Target);
}

void updateConnectionWatchdog() {
  hostConnected = (millis() - lastSerialRxMs) < 5000;
}

void sendTelemetry() {
  if (millis() - lastTelemetryMs < 250) return;
  lastTelemetryMs = millis();

  Serial.print(F("{\"type\":\"telemetry\",\"board\":\"DFRduino Nano Robot\",\"shield\":\"DFRobot Gravity V4.0\",\"mode\":\""));
  Serial.print(modeName());
  Serial.print(F("\",\"temp\":"));
  Serial.print(pseudoTempC, 1);
  Serial.print(F(",\"rpm\":"));
  Serial.print(pseudoRpm);
  Serial.print(F(",\"mic\":"));
  Serial.print(map(abs(micRaw - 512), 0, 512, 0, 255));
  Serial.print(F(",\"connected\":"));
  Serial.print(hostConnected ? F("true") : F("false"));
  Serial.println(F("}"));
}

void updateOled() {
  if (millis() - lastOledMs < 150) return;
  lastOledMs = millis();

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print(F("CORELIGHT v0.8"));

  display.setCursor(0, 14);
  display.print(F("MODE: "));
  display.print(modeName());

  display.setCursor(0, 26);
  display.print(F("BRT: "));
  display.print((int)currentBrightness);
  display.print(F(" SAFE:"));
  display.print(safeMode ? F("ON") : F("OFF"));

  display.setCursor(0, 38);
  display.print(F("MIC: "));
  display.print(map(abs(micRaw - 512), 0, 512, 0, 255));

  display.setCursor(0, 50);
  display.print(F("LINK: "));
  display.print(hostConnected ? F("ONLINE") : F("WAIT"));
  display.display();
}

void readSerialLines() {
  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\r') continue;
    if (ch == '\n') {
      String line = trimCopy(serialLine);
      serialLine = "";
      if (line.length() == 0) continue;
      lastSerialRxMs = millis();
      enqueueOrApplyCommand(line);
    } else {
      serialLine += ch;
      if (serialLine.length() > 240) {
        serialLine = "";
      }
    }
  }
}

// ==============================
// Setup / loop
// ==============================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println(F("[BOOT] Neon Protocol CoreLight v0.8"));

  pinMode(PIN_FAN_1, OUTPUT);
  pinMode(PIN_FAN_2, OUTPUT);
  pinMode(PIN_ENC_A, INPUT_PULLUP);
  pinMode(PIN_ENC_B, INPUT_PULLUP);
  pinMode(PIN_ENC_SW, INPUT_PULLUP);

  encLastState = (digitalRead(PIN_ENC_A) << 1) | digitalRead(PIN_ENC_B);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_A), encoderISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_B), encoderISR, CHANGE);

  FastLED.addLeds<NEOPIXEL, PIN_LED_DATA>(leds, LED_COUNT);
  FastLED.clear(true);
  beginSoftStartTo(SAFE_BRIGHTNESS_MAX);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[OLED] init failed"));
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println(F("CORELIGHT BOOT"));
    display.println(F("SAFE MODE ON"));
    display.display();
  }

  setSafeMode(SAFE_MODE_DEFAULT);
  effectMode = MODE_RAINBOW;
  fan1Target = 0;
  fan2Target = 0;
  lastSerialRxMs = millis();
  lastCommandApplyMs = millis() - COMMAND_GAP_MS;
}

void loop() {
  readSerialLines();
  processPendingCommand();
  updateConnectionWatchdog();
  updateSensors();
  handleEncoder();
  updateSoftStart();
  applyFans();
  updateEffects();
  sendTelemetry();
  updateOled();
}
