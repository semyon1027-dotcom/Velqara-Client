package com.grpromt.standchillowlauncher;

import android.app.*;
import android.content.*;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import java.util.*;

public final class MainActivity extends Activity {
    private static final String PREFS = "launcher";
    private final int PURPLE = Color.rgb(184, 140, 255);
    private SharedPreferences prefs;
    private Spinner apps;
    private final ArrayList<ResolveInfo> launchables = new ArrayList<>();

    @Override public void onCreate(Bundle state) { super.onCreate(state); prefs = getSharedPreferences(PREFS, 0); showKeyGate(); }

    private void showKeyGate() {
        LinearLayout root = base();
        TextView title = title("STANDCHILLOW CLIENT"); root.addView(title);
        TextView sub = text("Private launcher · offline shell"); root.addView(sub);
        EditText key = new EditText(this); key.setHint("Enter access key"); key.setSingleLine(); key.setTextColor(Color.WHITE); key.setHintTextColor(0xff8d849d); root.addView(key, lp());
        Button unlock = button("UNLOCK CLIENT"); root.addView(unlock, lp());
        TextView status = text(""); root.addView(status);
        unlock.setOnClickListener(v -> { String value = key.getText().toString().trim(); if (value.equals("GRPROMT-LOCAL") || value.equals(prefs.getString("key", ""))) { prefs.edit().putString("key", value).apply(); showLauncher(); } else status.setText("Invalid key"); });
        setContentView(root);
    }

    private void showLauncher() {
        LinearLayout root = base(); root.addView(title("STANDCHILLOW CLIENT")); root.addView(text("Safe launcher mode · no game code is modified"));
        apps = new Spinner(this); loadApps(); apps.setAdapter(adapter()); root.addView(apps, lp());
        Button launch = button("LAUNCH SELECTED GAME"); root.addView(launch, lp());
        Button refresh = button("REFRESH APPS"); root.addView(refresh, lp());
        Switch theme = new Switch(this); theme.setText("Light theme"); theme.setTextColor(Color.WHITE); theme.setChecked(prefs.getBoolean("light", false)); root.addView(theme, lp());
        theme.setOnCheckedChangeListener((b, checked) -> { prefs.edit().putBoolean("light", checked).apply(); applyTheme(checked); showLauncher(); });
        TextView hint = text("Key: GRPROMT-LOCAL  ·  Select the installed private client above"); root.addView(hint);
        launch.setOnClickListener(v -> launchSelected()); refresh.setOnClickListener(v -> { loadApps(); apps.setAdapter(adapter()); });
        setContentView(root);
    }

    private void loadApps() { launchables.clear(); Intent query = new Intent(Intent.ACTION_MAIN); query.addCategory(Intent.CATEGORY_LAUNCHER); launchables.addAll(getPackageManager().queryIntentActivities(query, 0)); }
    private ArrayAdapter<String> adapter() { ArrayList<String> names = new ArrayList<>(); for (ResolveInfo r : launchables) names.add(r.loadLabel(getPackageManager()).toString()); if (names.isEmpty()) names.add("No launchable apps found"); return new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names); }
    private void launchSelected() { if (launchables.isEmpty()) return; ResolveInfo r = launchables.get(apps.getSelectedItemPosition()); Intent i = getPackageManager().getLaunchIntentForPackage(r.activityInfo.packageName); if (i != null) startActivity(i); }
    private LinearLayout base() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); l.setPadding(44, 55, 44, 30); applyTheme(prefs.getBoolean("light", false), l); return l; }
    private void applyTheme(boolean light) { if (getWindow().getDecorView() != null) getWindow().getDecorView().setBackgroundColor(light ? 0xfff6f0ff : 0xff100d18); }
    private void applyTheme(boolean light, View v) { v.setBackgroundColor(light ? 0xfff6f0ff : 0xff100d18); }
    private TextView title(String s) { TextView t = text(s); t.setTextSize(26); t.setTextColor(PURPLE); t.setTypeface(null, 1); t.setPadding(0, 0, 0, 12); return t; }
    private TextView text(String s) { TextView t = new TextView(this); t.setText(s); t.setTextColor(0xffeee9f5); t.setTextSize(15); t.setPadding(0, 8, 0, 8); return t; }
    private Button button(String s) { Button b = new Button(this); b.setText(s); b.setTextColor(Color.WHITE); b.setBackgroundColor(0xff7148a8); return b; }
    private LinearLayout.LayoutParams lp() { return new LinearLayout.LayoutParams(-1, -2); }
}
