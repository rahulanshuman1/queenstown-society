# Build the Android APK

The APK is built in the cloud by GitHub Actions. You do not need Android Studio.

1. Push to `main` (or open the repo's **Actions** tab, choose **Build Android APK** and press **Run workflow**).
2. Wait about 5 to 8 minutes for the run to finish.
3. Open the finished run and download **queenstown-society-apk** from the Artifacts list at the bottom. Unzip it to get `app-debug.apk`.
4. Copy the APK to the phone and open it. Android asks to allow installs from this source. Allow it once.

This is a debug build. It installs on any phone and is fine for testing and for sharing inside the society.
Play Store needs a signed release build (a keystore stored as GitHub secrets). Ask to have that added.

Build on your own computer instead (needs Node 20, JDK 17, Android SDK):

    npm install
    npx cap add android
    npm run android:apk

The APK appears in `android/app/build/outputs/apk/debug/`.

The app shows live data from the phone's own storage, so each phone has its own copy until a shared database is connected (see README.md).
