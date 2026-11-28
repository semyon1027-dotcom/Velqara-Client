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
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new VelqaraOverlayModule(context));
    return modules;
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) {
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
  VelqaraOverlayModule(ReactApplicationContext context) { super(context); this.context = context; }
  @Override public String getName() { return "VelqaraOverlay"; }

  @ReactMethod
  public void requestOverlayPermission(Promise promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
      promise.resolve(true);
      return;
    }
    try {
      Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(intent);
      promise.resolve(false);
    } catch (Exception error) { promise.reject("OVERLAY_SETTINGS_FAILED", error); }
  }

  @ReactMethod
  public void startOverlay(Promise promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
      promise.reject("OVERLAY_PERMISSION_REQUIRED", "Display over other apps permission is required");
      return;
    }
    try {
      Intent intent = new Intent(context, VelqaraOverlayService.class);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
      else context.startService(intent);
      promise.resolve(true);
    } catch (Exception error) { promise.reject("OVERLAY_START_FAILED", error); }
  }

  @ReactMethod
  public void stopOverlay(Promise promise) {
    try { context.stopService(new Intent(context, VelqaraOverlayService.class)); promise.resolve(true); }
    catch (Exception error) { promise.reject("OVERLAY_STOP_FAILED", error); }
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

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class VelqaraOverlayService extends Service {
  private static final String CHANNEL_ID = "velqara_overlay";
  private WindowManager windowManager;
  private TextView badge;
  private WindowManager.LayoutParams params;
  private float downX;
  private float downY;
  private int startX;
  private int startY;

  private void startNotification() {
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Velqara HUD", NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("HUD Velqara поверх Minecraft");
      manager.createNotificationChannel(channel);
    }
    Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pending = open == null ? null : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
    builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Velqara HUD").setContentText("Оверлей работает поверх Minecraft").setOngoing(true).setCategory(Notification.CATEGORY_SERVICE);
    if (pending != null) builder.setContentIntent(pending);
    startForeground(2401, builder.build());
  }

  @Override public void onCreate() {
    super.onCreate();
    startNotification();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) { stopSelf(); return; }
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    badge = new TextView(this);
    badge.setText("VELQARA  •  FPS —  •  CPS —  •  BPS —");
    badge.setTextColor(Color.WHITE);
    badge.setTextSize(12);
    badge.setTypeface(null, android.graphics.Typeface.BOLD);
    badge.setPadding(24, 14, 24, 14);
    GradientDrawable background = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { Color.rgb(112, 35, 190), Color.rgb(25, 196, 222) });
    background.setCornerRadius(80f);
    background.setStroke(2, Color.argb(190, 255, 255, 255));
    badge.setBackground(background);
    badge.setOnClickListener(v -> badge.setText(badge.getText().toString().contains("HUD") ? "VELQARA  •  FPS —  •  CPS —  •  BPS —" : "VELQARA  HUD  •  Watermark  •  Array list"));
    badge.setOnTouchListener(new View.OnTouchListener() {
      @Override public boolean onTouch(View v, MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN) { downX = event.getRawX(); downY = event.getRawY(); startX = params.x; startY = params.y; return true; }
        if (event.getAction() == MotionEvent.ACTION_MOVE) { params.x = startX - (int)(event.getRawX() - downX); params.y = startY + (int)(event.getRawY() - downY); if (windowManager != null) windowManager.updateViewLayout(badge, params); return true; }
        if (event.getAction() == MotionEvent.ACTION_UP) { v.performClick(); return true; }
        return false;
      }
    });
    int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
    params = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
    params.gravity = Gravity.TOP | Gravity.END;
    params.x = 16; params.y = 90;
    try { windowManager.addView(badge, params); } catch (Exception error) { stopSelf(); }
  }

  @Override public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }
  @Override public void onDestroy() { if (windowManager != null && badge != null) { try { windowManager.removeView(badge); } catch (Exception ignored) {} } super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
`;

module.exports = function withVelqaraOverlay(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const permissions = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    ];
    for (const name of permissions) {
      if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === name)) manifest['uses-permission'].push({ $: { 'android:name': name } });
    }
    manifest.queries = manifest.queries || [];
    for (const packageName of ['com.mojang.minecraftpe', 'com.mojang.minecraftpe.preview', 'com.mojang.minecraftpe.beta']) {
      if (!manifest.queries.some((query) => (query.package || []).some((entry) => entry.$?.['android:name'] === packageName))) manifest.queries.push({ package: [{ $: { 'android:name': packageName } }] });
    }
    const application = manifest.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$['android:icon'] = '@drawable/velqara_icon';
      application.$['android:roundIcon'] = '@drawable/velqara_icon';
      application.service = application.service || [];
      let service = application.service.find((s) => s.$?.['android:name'] === '.VelqaraOverlayService');
      if (!service) { service = { $: { 'android:name': '.VelqaraOverlayService', 'android:exported': 'false' } }; application.service.push(service); }
      service.$['android:foregroundServiceType'] = 'specialUse';
      service.property = service.property || [];
      if (!service.property.some((p) => p.$?.['android:name'] === 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE')) service.property.push({ $: { 'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE', 'android:value': 'overlay HUD' } });
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const root = config.modRequest.platformProjectRoot;
    const javaDir = path.join(root, 'app', 'src', 'main', 'java', ...PACKAGE.split('.'));
    fs.mkdirSync(javaDir, { recursive: true });
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayPackage.java'), packageJava);
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayModule.java'), moduleJava);
    fs.writeFileSync(path.join(javaDir, 'VelqaraOverlayService.java'), serviceJava);
    const iconSource = path.join(config.modRequest.projectRoot, 'assets', 'velqara_icon.png');
    const drawableDir = path.join(root, 'app', 'src', 'main', 'res', 'drawable');
    fs.mkdirSync(drawableDir, { recursive: true });
    if (fs.existsSync(iconSource)) fs.copyFileSync(iconSource, path.join(drawableDir, 'velqara_icon.png'));
    const mainCandidates = [];
    function walk(dir) { for (const item of fs.readdirSync(dir)) { const full = path.join(dir, item); if (fs.statSync(full).isDirectory()) walk(full); else if (item === 'MainApplication.kt' || item === 'MainApplication.java') mainCandidates.push(full); } }
    walk(path.join(root, 'app', 'src', 'main', 'java'));
    if (mainCandidates[0]) {
      let contents = fs.readFileSync(mainCandidates[0], 'utf8');
      if (!contents.includes('VelqaraOverlayPackage()')) {
        const marker = 'val packages = PackageList(this).packages';
        if (contents.includes(marker)) contents = contents.replace(marker, `${marker}\n            packages.add(VelqaraOverlayPackage())`);
        else contents = contents.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n          add(VelqaraOverlayPackage())');
        fs.writeFileSync(mainCandidates[0], contents);
      }
    }
    return config;
  }]);
};
