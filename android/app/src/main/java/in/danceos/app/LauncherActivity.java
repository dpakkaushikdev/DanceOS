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
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.StrictMode;

import androidx.core.location.LocationManagerCompat;

import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;

/*
 * ⚠ HAND-EDITED AFTER `bubblewrap update` (1.3.1 → 1.3.5, 28 Oct 2026). `bubblewrap
 * update` REGENERATES THIS FILE and wipes everything below — re-apply it from git
 * after every update (CLAUDE.md, the 1.3.5 block). `build.gradle` needs nothing:
 * play-services-location rides in through the locationdelegation library.
 *
 * THE LOCATION IS ASKED HERE, NOT BY THE PAGE. In 1.3.0 the page asked and Chrome
 * delegated the question to this app — but by then this activity has finished and
 * Chrome's screen is the one showing, so the library opened Android's dialog from
 * the BACKGROUND, which HyperOS (Redmi Note 13, Android 15) silently blocks. Asked
 * from here, over the splash and before Chrome is launched, it is a foreground
 * request — the way a native app like Cult asks.
 *
 * THE STANDARD SHAPE (1.3.4, the user: "use the standard approach that is most
 * widely accepted"): the system dialog at launch while the location is not held
 * and has not been REFUSED — a refusal is remembered and nothing asks at launch
 * again (Discover's "Turn on location" row takes over). A grant is NOT
 * remembered (1.3.5): "Only this time" lapses once the app is left for a while,
 * and Android's meaning of those words is "ask me again next time", so the next
 * open asks again. Closing the app with the dialog open delivers no result and
 * counts as nothing.
 *
 * THE PERMISSION IS NOT THE SWITCH (1.3.5, the user: "i selected Only this time,
 * still it hasn't picked my location, neither gps on my device got on"). The
 * permission lets the app use location; the phone's own Location switch is a
 * second thing, and with it off every read fails silently. Native apps follow
 * the permission with Google's one-tap "turn on location?" dialog, so this does
 * too: permission held + switch off → the dialog, and the launch waits for it. A
 * Cancel is remembered and not asked again at launch until the switch has been
 * seen on once more (then off again is a new question).
 *
 * `dos_first_open` on the launch URL says whether the location is allowed, on
 * every open: true → the page reads the position (delegation answers without a
 * dialog, the permission is held); false → the page never asks on its own. The
 * name stays because `proxy.ts` reads it.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String PARAM_FIRST_OPEN = "dos_first_open";
    /* new keys (1.3.5): 1.3.2's `dos.location_asked` was written on showing the
       dialog and 1.3.4's `dos.location_answered` on any answer, grants included */
    private static final String KEY_LOCATION_DENIED = "dos.location_denied";
    private static final String KEY_SETTINGS_DECLINED = "dos.location_settings_declined";
    private static final int REQUEST_LOCATION = 4207;
    private static final int REQUEST_LOCATION_SETTINGS = 4208;

    private boolean hasLocation() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isDeviceLocationOn() {
        LocationManager manager = (LocationManager) getSystemService(LOCATION_SERVICE);
        return manager != null && LocationManagerCompat.isLocationEnabled(manager);
    }

    private boolean flag(String key) {
        StrictMode.ThreadPolicy originalPolicy = StrictMode.allowThreadDiskReads();
        try {
            return getPreferences(MODE_PRIVATE).getBoolean(key, false);
        } finally {
            StrictMode.setThreadPolicy(originalPolicy);
        }
    }

    private void setFlag(String key, boolean value) {
        getPreferences(MODE_PRIVATE).edit().putBoolean(key, value).apply();
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
     *  the location and without a refusal on record, hold the launch and ask
     *  Android — FINE and COARSE together, which is what shows Precise /
     *  Approximate (asking FINE alone is ignored on Android 12+). With the
     *  location but the phone's switch off, hold it for Google's dialog instead. */
    @Override
    protected boolean shouldLaunchImmediately() {
        if (!hasLocation()) {
            if (flag(KEY_LOCATION_DENIED)) {
                return true;
            }
            requestPermissions(new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQUEST_LOCATION);
            return false;
        }
        return !askToTurnOnDeviceLocation();
    }

    /** Permission held but the phone's own Location switch off: Google's one-tap
     *  "turn on location?" dialog. Returns true while the dialog is on its way —
     *  the launch then waits for onActivityResult. */
    private boolean askToTurnOnDeviceLocation() {
        if (isDeviceLocationOn()) {
            /* seen on: a later off is a fresh question */
            if (flag(KEY_SETTINGS_DECLINED)) setFlag(KEY_SETTINGS_DECLINED, false);
            return false;
        }
        if (flag(KEY_SETTINGS_DECLINED)) {
            return false;
        }
        LocationSettingsRequest request = new LocationSettingsRequest.Builder()
                .addLocationRequest(new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10000).build())
                .setAlwaysShow(true)
                .build();
        LocationServices.getSettingsClient(this)
                .checkLocationSettings(request)
                .addOnSuccessListener(response -> launchTwa())
                .addOnFailureListener(e -> {
                    if (e instanceof ResolvableApiException) {
                        try {
                            ((ResolvableApiException) e).startResolutionForResult(this, REQUEST_LOCATION_SETTINGS);
                            return;
                        } catch (IntentSender.SendIntentException ignored) {
                            /* no dialog to show — open the site as it is */
                        }
                    }
                    launchTwa();
                });
        return true;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_LOCATION) {
            return;
        }
        boolean granted = hasLocation();
        /* empty arrays mean the request was interrupted, not answered; only a
           refusal is remembered — a grant may be "only this time" */
        if (grantResults.length > 0 && !granted) {
            setFlag(KEY_LOCATION_DENIED, true);
        }
        if (granted && askToTurnOnDeviceLocation()) {
            return;
        }
        launchTwa();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_LOCATION_SETTINGS) {
            if (resultCode != RESULT_OK) {
                setFlag(KEY_SETTINGS_DECLINED, true);
            }
            launchTwa();
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        /* whether the location is allowed right now — read after the answer, since
           launchTwa runs only once the dialogs have closed */
        uri = uri
                .buildUpon()
                .appendQueryParameter(PARAM_FIRST_OPEN, String.valueOf(hasLocation()))
                .build();

        return uri;
    }
}
