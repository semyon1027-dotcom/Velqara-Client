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
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

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
}
`;

const serviceJava = `package ${PACKAGE};

import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
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
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return;
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    badge = new TextView(this);
    badge.setText("VELQARA  •  FPS  —  |  CPS  —");
    badge.setTextColor(Color.WHITE);
    badge.setTextSize(12);
    badge.setPadding(18, 12, 18, 12);
    badge.setBackgroundColor(Color.argb(220, 25, 15, 42));
    badge.setOnClickListener(v -> badge.setText(badge.getText().toString().contains("HUD") ? "VELQARA  •  FPS  —  |  CPS  —" : "VELQARA  HUD  •  Watermark  •  Array list"));
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
    if (!manifest['uses-permission'].some((p) => p.$?.['android:name'] === 'android.permission.SYSTEM_ALERT_WINDOW')) {
      manifest['uses-permission'].push({ $: { 'android:name': 'android.permission.SYSTEM_ALERT_WINDOW' } });
    }
    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];
      if (!application.service.some((s) => s.$?.['android:name'] === '.VelqaraOverlayService')) {
        application.service.push({ $: { 'android:name': '.VelqaraOverlayService', 'android:exported': 'false' } });
      }
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
