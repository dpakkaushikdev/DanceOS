/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package in.danceos.app;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.StrictMode;

/*
 * ⚠ HAND-EDITED AFTER `bubblewrap update` (1.3.1 → 1.3.4, 28 Oct 2026). `bubblewrap
 * update` REGENERATES THIS FILE and wipes the location step below — re-apply it
 * from git after every update (CLAUDE.md, the 1.3.4 block).
 *
 * THE LOCATION IS ASKED HERE, NOT BY THE PAGE. In 1.3.0 the page asked and Chrome
 * delegated the question to this app — but by then this activity has finished and
 * Chrome's screen is the one showing, so the library opened Android's dialog from
 * the BACKGROUND, which HyperOS (Redmi Note 13, Android 15) silently blocks. Asked
 * from here, over the splash and before Chrome is launched, it is a foreground
 * request — the way a native app like Cult asks.
 *
 * THE STANDARD SHAPE (1.3.4, the user: "use the standard approach that is most
 * widely accepted"): the system dialog ONCE, at the first launch, and no automatic
 * prompt after that — Discover carries a "Turn on location" row that asks again
 * only when it is pressed, and says where the Settings switch is when Android will
 * not show the dialog any more. (1.3.3 asked at every open until allowed.)
 *
 * The "asked" mark is written when the ANSWER arrives, not when the dialog is shown
 * (1.3.2's mistake): closing the app with the dialog open delivers no result, so
 * the next open asks once more. Android itself delivers an instant DENIED once it
 * has stopped showing the dialog, which marks it like any other answer.
 *
 * `dos_first_open` on the launch URL says whether the location is allowed, on
 * every open: true → the page reads the position (delegation answers without a
 * dialog, the permission is held); false → the page never asks on its own. The
 * name stays because `proxy.ts` reads it.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String PARAM_FIRST_OPEN = "dos_first_open";
    /* a new key, deliberately: 1.3.2's `dos.location_asked` was written on showing
       the dialog, so it may say "asked" on a phone that never answered */
    private static final String KEY_LOCATION_ANSWERED = "dos.location_answered";
    private static final int REQUEST_LOCATION = 4207;

    private boolean hasLocation() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean wasAnswered() {
        StrictMode.ThreadPolicy originalPolicy = StrictMode.allowThreadDiskReads();
        try {
            return getPreferences(MODE_PRIVATE).getBoolean(KEY_LOCATION_ANSWERED, false);
        } finally {
            StrictMode.setThreadPolicy(originalPolicy);
        }
    }

    private void markAnswered() {
        SharedPreferences preferences = getPreferences(MODE_PRIVATE);
        preferences.edit().putBoolean(KEY_LOCATION_ANSWERED, true).apply();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    /** Called by the base onCreate just before it would launch Chrome. Without
     *  the location and without an answer on record, hold the launch and ask
     *  Android — FINE and COARSE together, which is what shows Precise /
     *  Approximate (asking FINE alone is ignored on Android 12+). The answer,
     *  whatever it is, launches the TWA. */
    @Override
    protected boolean shouldLaunchImmediately() {
        if (hasLocation() || wasAnswered()) {
            return true;
        }
        requestPermissions(new String[] {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        }, REQUEST_LOCATION);
        return false;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_LOCATION) {
            /* empty arrays mean the request was interrupted, not answered */
            if (grantResults.length > 0) {
                markAnswered();
            }
            launchTwa();
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        /* whether the location is allowed right now — read after the answer, since
           launchTwa runs only once the dialog has closed */
        uri = uri
                .buildUpon()
                .appendQueryParameter(PARAM_FIRST_OPEN, String.valueOf(hasLocation()))
                .build();

        return uri;
    }
}
