const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const PACKAGE = 'com.velqara.client';

const packageJava = `package ${PACKAGE};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class VelqaraOverlayPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new VelqaraOverlayModule(context));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext context) {
    return Collections.emptyList();
  }
}
`;

const moduleJava = `package ${PACKAGE};

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.content.pm.PackageManager;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class VelqaraOverlayModule extends ReactContextBaseJavaModule {
  private final ReactApplicationContext context;

  VelqaraOverlayModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
  }

  @Override
  public String getName() { return "VelqaraOverlay"; }

  @ReactMethod
  public void requestOverlayPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
      Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
    }
  }

  @ReactMethod
  public void startOverlay() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
      requestOverlayPermission();
      return;
    }
    Intent intent = new Intent(context, VelqaraOverlayService.class);
    context.startService(intent);
  }

  @ReactMethod
  public void stopOverlay() {
    context.stopService(new Intent(context, VelqaraOverlayService.class));
  }

  @ReactMethod
  public void launchMinecraft(Promise promise) {
    String[] packages = { "com.mojang.minecraftpe", "com.mojang.minecraftpe.preview", "com.mojang.minecraftpe.beta" };
    PackageManager manager = context.getPackageManager();
    for (String packageName : packages) {
      try {
        Intent launch = manager.getLaunchIntentForPackage(packageName);
        if (launch != null) {
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
          context.startActivity(launch);
          promise.resolve(packageName);
          return;
        }
      } catch (Exception ignored) {}
    }
    promise.reject("MINECRAFT_NOT_FOUND", "Minecraft package was not found");
  }
}
`;

const serviceJava = `package ${PACKAGE};

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.ServiceInfo;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class VelqaraOverlayService extends Service {
  private WindowManager windowManager;
  private TextView badge;
  private WindowManager.LayoutParams params;
  private float downX;
  private float downY;
  private int startX;
  private int startY;

  @Override
  public void onCreate() {
    super.onCreate();
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      String channelId = "velqara_overlay";
      NotificationChannel channel = new NotificationChannel(channelId, "Velqara overlay", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Keeps Velqara HUD visible over Minecraft");
      ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
      Notification notification = new Notification.Builder(this, channelId).setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle("Velqara HUD").setContentText("Оверлей работает поверх Minecraft").setOngoing(true).build();
      if (android.os.Build.VERSION.SDK_INT >= 34) startForeground(1001, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE); else startForeground(1001, notification);
    }
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return;
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    badge = new TextView(this);
    badge.setText("VELQARA   •   FPS —   CPS —   BPS —");
    badge.setTextColor(Color.WHITE);
    badge.setTextSize(12);
    badge.setPadding(18, 12, 18, 12);
    badge.setTypeface(null, 1);
    GradientDrawable hudBg = new GradientDrawable();
    hudBg.setColor(Color.argb(225, 17, 13, 29));
    hudBg.setCornerRadius(64);
    hudBg.setStroke(1, Color.argb(230, 168, 85, 247));
    badge.setBackground(hudBg);
    badge.setOnClickListener(v -> badge.setText(badge.getText().toString().contains("HUD") ? "VELQARA   •   FPS —   CPS —   BPS —" : "VELQARA HUD   •   Watermark   •   Array list"));
    badge.setOnTouchListener(new View.OnTouchListener() {
      @Override public boolean onTouch(View v, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
          downX = event.getRawX(); downY = event.getRawY(); startX = params.x; startY = params.y; return true;
        }
        if (event.getAction() == MotionEvent.ACTION_MOVE) {
          params.x = startX - (int) (event.getRawX() - downX);
          params.y = startY + (int) (event.getRawY() - downY);
          windowManager.updateViewLayout(badge, params); return true;
        }
        if (event.getAction() == MotionEvent.ACTION_UP) { v.performClick(); return true; }
        return false;
      }
    });
    int type = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
    params = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.END;
    params.x = 18; params.y = 80;
    windowManager.addView(badge, params);
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
  @Override public void onDestroy() { if (windowManager != null && badge != null) windowManager.removeView(badge); super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
`;

module.exports = function withVelqaraOverlay(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const requiredPermissions = ['android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE', 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'];
    for (const permission of requiredPermissions) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === permission)) manifest['uses-permission'].push({ $: { 'android:name': permission } });
    }
    if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === 'android.permission.SYSTEM_ALERT_WINDOW')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' } });
    }
    manifest.queries = manifest.queries || [];
    const minecraftPackages = ['com.mojang.minecraftpe', 'com.mojang.minecraftpe.preview', 'com.mojang.minecraftpe.beta'];
    for (const packageName of minecraftPackages) {
      if (!manifest.queries.some((query) => (query.package || []).some((entry) => entry.$?.['android:name'] === packageName))) {
        manifest.queries.push({ package: [{ $: { 'android:name': packageName } }] });
      }
    }
    const application = manifest.application?.[0];
    if (application) { application.$ = application.$ || {}; application.$['android:icon'] = '@drawable/velqara_icon'; application.$['android:roundIcon'] = '@drawable/velqara_icon'; }
    if (application) {
      application.service = application.service || [];
      if (!application.service.some((s) => s.$?.['android:name'] === '.VelqaraOverlayService')) {
        application.service.push({ $: { 'android:name': '.VelqaraOverlayService', 'android:exported': 'false', 'android:foregroundServiceType': 'specialUse' } });
      }
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const root = config.modRequest.platformProjectRoot;
    const javaDir = path.join(root, 'app', 'src', 'main', 'java', ...PACKAGE.split('.'));
    fs.mkdirSync(javaDir, { recursive: true });
    const drawableDir = path.join(root, 'app', 'src', 'main', 'res', 'drawable');
    fs.mkdirSync(drawableDir, { recursive: true });
    fs.writeFileSync(path.join(drawableDir, 'velqara_icon.xml'), "<?xml version=\"1.0\" encoding=\"utf-8\"?>\\n<vector xmlns:android=\"http://schemas.android.com/apk/res/android\" android:width=\"108dp\" android:height=\"108dp\" android:viewportWidth=\"108\" android:viewportHeight=\"108\">\\n  <path android:fillColor=\"#A855F7\" android:pathData=\"M16,0 L92,0 C101,0 108,7 108,16 L108,92 C108,101 101,108 92,108 L16,108 C7,108 0,101 0,92 L0,16 C0,7 7,0 16,0 Z\"/>\\n  <path android:fillColor=\"#FFFFFF\" android:pathData=\"M25,24 L41,24 L54,64 L67,24 L83,24 L62,84 L46,84 Z\"/>\\n</vector>");
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayPackage.java'), packageJava);
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayModule.java'), moduleJava);
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayService.java'), serviceJava);
    const mainCandidates = [];
    function walk(dir) { for (const item of fs.readdirSync(dir)) { const full = path.join(dir, item); if (fs.statSync(full).isDirectory()) walk(full); else if (item === 'MainApplication.kt' || item === 'MainApplication.java') mainCandidates.push(full); } }
    walk(path.join(root, 'app', 'src', 'main', 'java'));
    if (mainCandidates[0]) {
      let contents = fs.readFileSync(mainCandidates[0], 'utf8');
      if (!contents.includes('VelqaraOverlayPackage()')) {
        const marker = 'val packages = PackageList(this).packages';
        if (contents.includes(marker)) {
          contents = contents.replace(marker, `${marker}\n            packages.add(VelqaraOverlayPackage())`);
        } else {
          const applyMarker = 'PackageList(this).packages.apply {';
          contents = contents.replace(applyMarker, `${applyMarker}\n          add(VelqaraOverlayPackage())`);
        }
        fs.writeFileSync(mainCandidates[0], contents);
      }
    }
    return config;
  }]);
};
