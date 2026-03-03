# Google Play Release Guide (Project Paige / ProjectM)

This project is set up to package the React app as an Android app using Capacitor.

## 1. Prerequisites
- Node 20+
- Java 17
- Android Studio (latest stable)
- Android SDK + platform tools installed from Android Studio
- A production API URL over HTTPS

## 2. Configure production API
Create `apps/web/.env.production`:

```bash
cp apps/web/.env.production.example apps/web/.env.production
```

Set:

```env
VITE_API_BASE=https://api.your-domain.com/api/v1
```

## 3. Install Capacitor dependencies
From repo root:

```bash
npm --workspace @projectm/web install @capacitor/core @capacitor/cli @capacitor/android
```

## 4. Generate Android project (first time only)
From repo root:

```bash
npm --workspace @projectm/web run android:add
```

This creates `apps/web/android/`.

## 5. Sync latest web build to Android
From repo root:

```bash
npm --workspace @projectm/web run android:sync
```

## 6. Open Android Studio
From repo root:

```bash
npm --workspace @projectm/web run android:open
```

In Android Studio:
- Let Gradle sync.
- Set package name/app name if needed.
- Set app icon if you want a dedicated Android icon set.

## 7. Create signing key
In Android Studio:
- `Build` -> `Generate Signed Bundle / APK`
- Choose `Android App Bundle`
- Create/select keystore
- Keep keystore and passwords backed up securely

## 8. Build release bundle (.aab)
Command line option (after Android project exists):

```bash
npm --workspace @projectm/web run android:bundle
```

Bundle output:
- `apps/web/android/app/build/outputs/bundle/release/app-release.aab`

## 9. Play Console submission checklist
- Create app in Google Play Console
- Upload `app-release.aab`
- Complete:
  - App content questionnaire
  - Data safety form
  - Privacy policy URL
  - Target audience and ads declarations
  - Store listing (icon, screenshots, description)
- Internal testing track first, then production rollout

## 10. Recommended launch checks
- Login/logout and session refresh works
- Booking creation works from Android app
- Messaging works from Android app
- Support tickets create successfully
- API CORS includes `capacitor://localhost`
- PWA manifest icons are valid (`192x192`, `512x512`, maskable icons)

