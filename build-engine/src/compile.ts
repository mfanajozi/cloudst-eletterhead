/**
 * CloudST eLetterhead — Compilation Engine (runs on the CI runner)
 *
 * ONE execution = ONE platform build for ONE client.
 * See the env contract in the header of this file's package README / workflow.
 */
import { execSync, type StdioOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── env contract ─────────────────────────────────────────────────────────────
const PLATFORM = env("PLATFORM"); // android | ios | windows | web
const CLIENT_ID = env("CLIENT_ID");
const BUILD_ID = env("BUILD_ID");
const APP_NAME = env("APP_NAME", "CloudST Client");
const PACKAGE_ID = env("PACKAGE_ID", "com.cloudst.eletterhead");
const VERSION_CODE = env("VERSION_CODE", "1.0.0");
const BUILD_NUMBER = env("BUILD_NUMBER", "1");
const SUPA_URL = (env("SUPABASE_URL") ?? "").replace(/\/+$/, "");
// Accept either secret name — the repo may be configured with the guide's
// SUPABASE_SECRET_KEY or the canonical SUPABASE_SERVICE_ROLE_KEY.
const SUPA_SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

const engineRoot = path.dirname(fileURLToPath(import.meta.url)); // …/build-engine/src
// The engine lives at <repo>/build-engine/src/compile.ts — the repository root
// (where flutter_blueprint/, engine-workspace/ and engine-output/ live) is two
// levels up. The CI workflow checks out the repo at its root, so this must
// resolve there — resolving only one level put the blueprint lookup inside
// build-engine/ and failed every CI run with ENOENT.
const repoRoot = path.resolve(engineRoot, "..", "..");
const BLUEPRINT_DIR = path.join(repoRoot, "flutter_blueprint");
const WORKSPACE = path.join(
  repoRoot,
  "engine-workspace",
  `build_${BUILD_ID.replace(/[^a-zA-Z0-9-]/g, "")}`
);

type Platform = "android" | "ios" | "windows" | "web";

// ─── supabase helpers (service-role over REST/storage) ────────────────────────
async function updateBuild(patch: Record<string, unknown>) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/app_builds?id=eq.${BUILD_ID}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPA_SERVICE,
        Authorization: `Bearer ${SUPA_SERVICE}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) throw new Error(`app_builds PATCH failed: ${res.status}`);
}

// New-format keys (sb_secret_…) are rejected by Storage when only the
// Authorization header is present — every call sends apikey as well.
async function downloadAsset(fileName: string): Promise<Buffer> {
  const res = await fetch(
    `${SUPA_URL}/storage/v1/object/letterhead-assets/${CLIENT_ID}/${fileName}`,
    { headers: { Authorization: `Bearer ${SUPA_SERVICE}`, apikey: SUPA_SERVICE } }
  );
  if (!res.ok)
    throw new Error(
      `Asset download failed (${fileName}): HTTP ${res.status}`
    );
  return Buffer.from(await res.arrayBuffer());
}

async function uploadArtifact(
  fileName: string,
  body: Buffer,
  contentType: string
) {
  const objectPath = `app-artifacts/${CLIENT_ID}/${fileName}`;
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPA_SERVICE}`,
      apikey: SUPA_SERVICE,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Artifact upload failed (${objectPath}): ${text}`);
  }
  return objectPath;
}

async function createSignedUrl(objectPath: string): Promise<string> {
  // Current Storage REST signs multiples paths at once under /object/sign/{bucket}
  // with a `paths` array, and returns a matching array of signedURL entries.
  const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/app-artifacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPA_SERVICE}`,
      apikey: SUPA_SERVICE,
    },
    body: JSON.stringify({
      paths: [objectPath.replace(/^app-artifacts\//, "")],
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    }),
  });
  if (!res.ok) throw new Error(`Signed URL failed: ${res.status}`);
  const signed = (await res.json()) as Array<{ error: string | null; signedURL: string }>;
  if (!Array.isArray(signed) || signed.length === 0)
    throw new Error("Signed URL request returned no entries");
  if (signed[0].error) throw new Error(`Signed URL error: ${signed[0].error}`);
  return `${SUPA_URL}/storage/v1${signed[0].signedURL}`;
}

// ─── small fs / shell helpers ─────────────────────────────────────────────────
function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (!v && fallback === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v ?? fallback!;
}

function sh(cmd: string, opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const stdio: StdioOptions = process.env.CI ? "inherit" : "pipe";
  console.log(`\n$ ${cmd}`);
  execSync(cmd, {
    stdio,
    cwd: opts.cwd ?? WORKSPACE,
    env: { ...process.env, ...opts.env },
  });
}

function trySh(cmd: string, opts: { cwd?: string } = {}) {
  try {
    sh(cmd, opts);
    return true;
  } catch {
    return false;
  }
}

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

function write(p: string, contents: string) {
  fs.writeFileSync(p, contents, "utf8");
}

function existsIn(...candidates: string[]) {
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

// ─── branding + repackaging injections ────────────────────────────────────────
function rewriteBrand() {
  // lib/core/brand.dart — display identity surfaced inside the client app
  const brandPath = path.join(WORKSPACE, "lib", "core", "brand.dart");
  let brand = read(brandPath)
    .replace(/const String APP_NAME = '.*';/, `const String APP_NAME = '${APP_NAME.replace(/'/g, "\\'")}';`)
    .replace(/const String APP_PACKAGE = '.*';/, `const String APP_PACKAGE = '${PACKAGE_ID}';`);
  write(brandPath, brand);

  // Android
  const manifestPath = path.join(
    WORKSPACE,
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  if (fs.existsSync(manifestPath)) {
    const manifest = read(manifestPath).replace(
      /android:label="[^"]*"/,
      `android:label="${APP_NAME.replace(/"/g, "&quot;")}"`
    );
    write(manifestPath, manifest);
  }
  repackageAndroid();

  // Android label rewriting must run after flutter create populated dirs
  function repackageAndroid() {
    // Dialect-aware build.gradle rewrite (groovy or Kotlin DSL)
    const gradlePath = existsIn(
      path.join(WORKSPACE, "android", "app", "build.gradle.kts"),
      path.join(WORKSPACE, "android", "app", "build.gradle")
    );
    if (gradlePath) {
      let gradle = read(gradlePath);
      const kts = gradlePath.endsWith(".kts");
      const nsPattern = kts
        ? /namespace = "[^"]*"/
        : /namespace\s+"[^"]*"/;
      if (nsPattern.test(gradle)) {
        gradle = gradle.replace(nsPattern, kts ? `namespace = "${PACKAGE_ID}"` : `namespace "${PACKAGE_ID}"`);
      }
      const appPattern = kts
        ? /applicationId = "[^"]*"/
        : /applicationId\s+"[^"]*"/;
      gradle = gradle.replace(appPattern, kts ? `applicationId = "${PACKAGE_ID}"` : `applicationId "${PACKAGE_ID}"`);
      write(gradlePath, gradle);
    }

    // Move MainActivity into the package-identity directory + rewrite package
    const pkgDir = PACKAGE_ID.split(".");
    const candidates = [
      "kotlin",
      "java",
    ];
    for (const lang of candidates) {
      const base = path.join(WORKSPACE, "android", "app", "src", "main", lang);
      if (!fs.existsSync(base)) continue;
      const found = findFile(base, /^MainActivity\.(kt|java)$/);
      if (!found) continue;
      const content = read(found.path).replace(
        /^package\s+[^\s]+;?/m,
        `package ${PACKAGE_ID}`
      );
      const target = path.join(base, ...pkgDir, found.name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      write(target, content);
      if (target !== found.path) fs.rmSync(found.path);
      break;
    }
  }

  // iOS bundle identifier
  const pbxPath = path.join(WORKSPACE, "ios", "Runner.xcodeproj", "project.pbxproj");
  if (fs.existsSync(pbxPath)) {
    const pbx = read(pbxPath).replace(
      /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*[^;]+;/g,
      `PRODUCT_BUNDLE_IDENTIFIER = ${PACKAGE_ID};`
    );
    write(pbxPath, pbx);
    const plistPath = path.join(WORKSPACE, "ios", "Runner", "Info.plist");
    if (fs.existsSync(plistPath)) {
      const plist = read(plistPath).replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleDisplayName</key>\n\t<string>${APP_NAME.replace(/[<>&]/g, "")}</string>`
      );
      write(plistPath, plist);
    }
  }

  // Windows display strings
  const rcPath = path.join(WORKSPACE, "windows", "runner", "Runner.rc");
  if (fs.existsSync(rcPath)) {
    let rc = read(rcPath)
      .replace(/VALUE "CompanyName", "[^"]*"/, `VALUE "CompanyName", "${APP_NAME}"`)
      .replace(/VALUE "ProductName", "[^"]*"/, `VALUE "ProductName", "${APP_NAME}"`)
      .replace(/VALUE "FileDescription", "[^"]*"/, `VALUE "FileDescription", "${APP_NAME} eLetterhead"`);
    write(rcPath, rc);
  }
}

function findFile(dir: string, test: RegExp): { path: string; name: string } | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(full, test);
      if (nested) return nested;
    } else if (test.test(entry.name)) {
      return { path: full, name: entry.name };
    }
  }
  return null;
}

// ─── android signing (post-build zipalign + apksigner; dialect-proof) ─────────
function prepareAndroidKeystore(): {
  ksPath: string;
  alias: string;
  ksPass: string;
  keyPass: string;
} | null {
  const generatedDir = path.join(WORKSPACE, "signing");
  fs.mkdirSync(generatedDir, { recursive: true });
  const alias = process.env.KEY_ALIAS || "cloudst_release";
  const ksPass = process.env.KEYSTORE_PASSWORD || randomPassword();
  const keyPass = process.env.KEY_PASSWORD || ksPass;

  let ksPath: string;
  if (process.env.KEYSTORE_BASE64) {
    ksPath = path.join(generatedDir, "release.keystore");
    fs.writeFileSync(ksPath, Buffer.from(process.env.KEYSTORE_BASE64, "base64"));
  } else {
    // Compliance: generate a UNIQUE keystore per generated app (keytool).
    ksPath = path.join(generatedDir, `${CLIENT_ID.slice(0, 8)}.release.keystore`);
    const dname = `CN=${APP_NAME}, OU=CloudST eLetterhead, O=${APP_NAME.replace(/[^\w ]/g, "") || "Client"}, C=US`;
    trySh(
      `keytool -genkeypair -v -keystore "${ksPath}" -alias ${alias} ` +
        `-keyalg RSA -keysize 2048 -validity 10000 -storepass ${ksPass} ` +
        `-keypass ${keyPass} -dname "${dname}"`
    );
    if (!fs.existsSync(ksPath)) return null;
  }

  // Publish the keystore next to the artifact so the client's app owner can
  // sign subsequent updates with the same identity.
  trySh(`echo "${ksPass}" > "${path.join(generatedDir, "keystore.password")}"`);
  return { ksPath, alias, ksPass, keyPass };
}

function signAndroidApk(ks: NonNullable<ReturnType<typeof prepareAndroidKeystore>>, apk: string) {
  const bt = latestBuildToolsDir();
  if (!bt) throw new Error("Android build-tools directory not found for signing");
  const zipalign = path.join(bt, process.platform === "win32" ? "zipalign.exe" : "zipalign");
  const signer = path.join(bt, process.platform === "win32" ? "apksigner.bat" : "apksigner");
  const aligned = apk.replace(/\.apk$/, ".aligned.apk");
  const signed = apk.replace(/\.apk$/, ".signed.apk");

  sh(`"${zipalign}" -f 4 "${apk}" "${aligned}"`);
  sh(
    `"${signer}" sign --ks "${ks.ksPath}" --ks-key-alias ${ks.alias} ` +
      `--ks-pass pass:${ks.ksPass} --key-pass pass:${ks.keyPass} ` +
      `--out "${signed}" "${aligned}"`
  );
  sh(`"${signer}" verify "${signed}"`);
  fs.rmSync(aligned, { force: true });
  fs.rmSync(apk, { force: true });
  fs.renameSync(signed, apk);
}

function latestBuildToolsDir(): string | null {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk || !fs.existsSync(path.join(sdk, "build-tools"))) return null;
  const dirs = fs
    .readdirSync(path.join(sdk, "build-tools"))
    .filter((d) => /^\d+(\.\d+)*$/.test(d))
    .sort((a, b) => compareVersions(b, a));
  return dirs.length ? path.join(sdk, "build-tools", dirs[0]) : null;
}

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

function randomPassword() {
  return (
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).toUpperCase().slice(2, 12) +
    "!1"
  );
}

function zipDir(sourceDir: string, outZip: string) {
  const absOut = path.resolve(outZip);
  if (process.platform === "win32") {
    sh(
      `powershell -NoProfile -Command "Compress-Archive -Path '${path.resolve(sourceDir)}\\*' -DestinationPath '${absOut}' -Force"`,
      { cwd: WORKSPACE }
    );
  } else {
    sh(`(cd "${path.resolve(sourceDir)}" && zip -qr "${absOut}" .)`, { cwd: WORKSPACE });
  }
}

// ─── main flow ────────────────────────────────────────────────────────────────
async function main() {
  if (["android", "ios", "windows", "web"].indexOf(PLATFORM) < 0) {
    throw new Error(`Unknown PLATFORM: ${PLATFORM}`);
  }

  console.log(`▶ Compiling ${PLATFORM} client for ${APP_NAME} (${PACKAGE_ID})`);
  await updateBuild({ status: "compiling", error_log: null });

  fs.rmSync(WORKSPACE, { recursive: true, force: true });
  fs.mkdirSync(WORKSPACE, { recursive: true });
  console.log(`[1/6] Workspace at ${WORKSPACE}`);
  fs.cpSync(BLUEPRINT_DIR, WORKSPACE, { recursive: true });

  console.log("[2/6] Scaffolding native runners (flutter create)");
  sh(
    `flutter config --no-analytics`,
    { cwd: WORKSPACE }
  );
  // Scaffold ALL platforms, not just the target: flutter_launcher_icons'
  // shared pubspec config (ios: true) and other per-platform generators
  // touch icon paths in ios/, windows/ etc. Scaffolding every platform
  // guarantees those directories exist no matter which one we compile.
  sh(
    `flutter create . --platforms android,ios,web,windows --org ${PACKAGE_ID.split(".").slice(0, 2).join(".")}`,
    { cwd: WORKSPACE }
  );

  console.log("[3/6] Injecting client assets + branding");
  const assetsDir = path.join(WORKSPACE, "assets");
  fs.writeFileSync(path.join(assetsDir, "template_letterhead.pdf"), await downloadAsset("template_letterhead.pdf"));
  fs.writeFileSync(path.join(assetsDir, "images", "icon_source.png"), await downloadAsset("icon_source.png"));
  fs.writeFileSync(path.join(assetsDir, "images", "splash_source.png"), await downloadAsset("splash_source.png"));
  rewriteBrand();

  console.log("[4/6] Generating launcher icons + native splash");
  sh("flutter pub get");
  sh("dart run flutter_launcher_icons");
  sh("dart run flutter_native_splash:create");

  console.log(`[5/6] Compiling ${PLATFORM} — release`);
  let artifact: { file: string; name: string; contentType: string } | null = null;

  if (PLATFORM === "android") {
    sh(
      `flutter build apk --release --build-name=${VERSION_CODE} --build-number=${BUILD_NUMBER}`
    );
    const apk = path.join(
      WORKSPACE,
      "build",
      "app",
      "outputs",
      "flutter-apk",
      "app-release.apk"
    );
    if (!fs.existsSync(apk)) throw new Error(`APK not found at ${apk}`);
    // Unique production keystore + zipalign + apksigner (post-build signing)
    const ks = prepareAndroidKeystore();
    if (!ks) throw new Error("Keystore generation failed — cannot ship unsigned APK");
    signAndroidApk(ks, apk);
    artifact = {
      file: apk,
      name: `${PLATFORM}-v${VERSION_CODE}.apk`,
      contentType: "application/vnd.android.package-archive",
    };
  } else if (PLATFORM === "web") {
    sh("flutter build web --release");
    artifact = {
      file: path.join(WORKSPACE, "build", "web"),
      name: `${PLATFORM}-v${VERSION_CODE}.zip`,
      contentType: "application/zip",
    };
  } else if (PLATFORM === "windows") {
    sh("flutter build windows --release");
    const exeDir = path.join(WORKSPACE, "build", "windows", "x64", "runner", "Release");
    if (!fs.existsSync(exeDir)) throw new Error(`Windows Release dir not found: ${exeDir}`);
    artifact = {
      file: exeDir,
      name: `${PLATFORM}-v${VERSION_CODE}.zip`,
      contentType: "application/zip",
    };
  } else {
    // iOS — no certificates configured: emit .app for enterprise signing
    // (Apple P12 / provisioning secrets can be wired later).
    sh("flutter build ios --release --no-codesign");
    const appDir = path.join(WORKSPACE, "build", "ios", "iphoneos", "Runner.app");
    if (!fs.existsSync(appDir)) throw new Error(`iOS .app not found: ${appDir}`);
    artifact = {
      file: path.dirname(appDir),
      name: `${PLATFORM}-v${VERSION_CODE}-unsigned.zip`,
      contentType: "application/zip",
    };
  }

  // zip directory-derived artifacts (web/windows/ios); android uploads the apk itself
  let uploadPath = artifact.file;
  if (!(await isFile(artifact.file))) {
    const target = path.join(WORKSPACE, "artifacts", artifact.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    zipDir(artifact.file, target);
    uploadPath = target;
  }

  console.log("[6/6] Publishing artifact → Supabase app-artifacts");
  const body = fs.readFileSync(uploadPath);
  const objectPath = await uploadArtifact(
    `${PLATFORM}/${path.basename(uploadPath)}`,
    body,
    artifact.contentType
  );
  const downloadUrl = await createSignedUrl(objectPath);

  // Keep a copy for the workflow's GH-artifact fallback download
  const ciCopy = path.join(repoRoot, "engine-output", PLATFORM, path.basename(uploadPath));
  fs.mkdirSync(path.dirname(ciCopy), { recursive: true });
  fs.cpSync(uploadPath, ciCopy);

  await updateBuild({
    status: "completed",
    download_url: downloadUrl,
    version_code: VERSION_CODE,
    build_number: Number(BUILD_NUMBER) || 1,
  });

  fs.rmSync(WORKSPACE, { recursive: true, force: true });
  console.log(`✅ ${PLATFORM} build completed → ${downloadUrl}`);
}

async function isFile(p: string) {
  try {
    return (await fs.promises.stat(p)).isFile();
  } catch {
    return false;
  }
}

main().catch(async (err) => {
  console.error("❌ BUILD FAILED:", err instanceof Error ? err.message : err);
  try {
    await updateBuild({
      status: "failed",
      error_log: String(err instanceof Error ? err.stack ?? err.message : err).slice(0, 4000),
    });
  } catch {
    /* status write best-effort */
  }
  fs.rmSync(WORKSPACE, { recursive: true, force: true });
  process.exitCode = 1;
});
