# BricDoc Android Application & Google Play Store Guide

This document specifies the setup, mobile build, signing, and Google Play Store submission roadmap for **BricDoc** on Android.

---

## 1. Application Identification

- **App Name:** BricDoc
- **Package ID:** `com.bricdoc.app`
- **Minimum SDK:** API 24 (Android 7.0 Nougat)
- **Target SDK:** API 35 (Android 15)
- **Version Code:** 1
- **Version Name:** 1.0.0

---

## 2. Android Manifest & Permissions Checklist

```xml
<!-- Required for API communication -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Required for document scanner camera integration -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Media and Downloads on modern Android (Scoped Storage) -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

---

## 3. Local Mobile Development Setup

1. **Install Capacitor CLI:**
   ```bash
   cd mobile
   npm install @capacitor/core @capacitor/cli @capacitor/android
   ```

2. **Add Android Platform:**
   ```bash
   npx cap add android
   ```

3. **Export Web Build:**
   ```bash
   cd ../frontend
   npm run build
   cd ../mobile
   npx cap sync
   ```

4. **Launch Android Studio:**
   ```bash
   npx cap open android
   ```

---

## 4. Release Keystore Generation & Signing Instructions

> **CRITICAL SECURITY RULE:** Never commit `release-key.keystore` or passwords into Git repositories. Store them in secure local secrets managers.

Generate a release signing key using `keytool`:
```bash
keytool -genkey -v -keystore release-key.keystore -alias bricdoc-key -keyalg RSA -keysize 2048 -validity 10000
```

Configure `android/app/build.gradle`:
```groovy
android {
    signingConfigs {
        release {
            storeFile file("release-key.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "bricdoc-key"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

Generate the signed **Android App Bundle (.aab)**:
```bash
cd android
./gradlew bundleRelease
```
The generated bundle will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 5. Google Play Store Listing & Data Safety Preparation

### Store Listing Copy
- **App Title (max 30 chars):** BricDoc — All-in-One PDF & AI
- **Short Description (max 80 chars):** Merge, split, compress, edit, convert, and chat with your documents using AI.
- **Full Description:**
  > BricDoc is your production-grade document productivity workspace.
  >
  > • **Organize & Optimize:** Merge multiple files in any order, split by ranges, rotate pages, and compress PDF sizes without losing clarity.
  > • **Bidirectional Conversion:** Turn PDFs into Word (DOCX), Excel, and high-res images, or convert scans directly to PDF.
  > • **Edit & Annotate:** Insert notes, draw freehand diagrams, and highlight text on our interactive sheet viewer.
  > • **AES-256 Security:** Encrypt documents with passwords and permanently redact confidential content.
  > • **Grounded AI Intelligence:** Summarize long reports and ask questions with verified page citations.
  > • **Private Vault:** Secure cloud library accessible everywhere.

### Screenshots Checklist
- 16:9 / 9:16 phone screenshots (minimum 4 screens: Home, Tool Workspace, Document Editor, AI Chat)
- 7-inch tablet screenshots
- 10-inch tablet screenshots
- High-res icon: 512 x 512 PNG (32-bit with alpha)
- Feature graphic: 1024 x 500 JPG/PNG

### Data Safety Questionnaire Answers
- **Data collected:** Account information (email, full name) for user authentication.
- **Data security:** Data encrypted in transit using TLS 1.3; data encrypted at rest in private storage.
- **Data sharing:** No user data or document content is shared with third parties or advertisers.
- **Account deletion:** In-app account and data deletion fully supported.
