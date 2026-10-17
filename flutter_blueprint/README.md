# flutter_blueprint — CloudST eLetterhead Client Core Engine

Master Flutter blueprint compiled into every white-label client app
(Android APK · iOS IPA · Windows EXE · Web PWA).

## Pipeline contract (`build-engine/` reads this)

1. Pipeline copies this folder into an isolated workspace.
2. `flutter create . --platforms <targets>` scaffold native runners around
   the existing `lib/`, `pubspec.yaml` and `assets/`.
3. Pipeline injects client assets:
   - `assets/template_letterhead.pdf` ← client's letterhead blueprint
   - `assets/images/icon_source.png`  ← client launcher icon (square PNG)
   - `assets/images/splash_source.png` ← client boot flash
4. Pipeline rewrites branding:
   - `lib/core/brand.dart` → `APP_NAME` / `APP_PACKAGE`
   - `android/app/src/main/AndroidManifest.xml` → `android:label`
   - `android/app/build.gradle` → `applicationId "<package_identity>"`
   - `ios/Runner.xcodeproj` → `PRODUCT_BUNDLE_IDENTIFIER`
   - `windows/runner/Runner.rc` → display strings
5. Generators: `flutter pub run flutter_launcher_icons`, `flutter pub run flutter_native_splash:create`
6. Compile per platform → artifact uploaded to Supabase `app-artifacts`.

## App architecture (all offline, no cloud calls)

- `lib/ui/history_screen.dart` — dashboard/history (Hive, device-only)
- `lib/ui/editor_screen.dart` — form fields + vector signature pad
- `lib/core/pdf_engine.dart` — letterhead underlay + content + signature merge
- `lib/core/pdf_output.dart` — private-documents save + share-sheet exports
- `lib/ui/storage_notice.dart` — destructive-reset warning (PRD Boundary #2)
