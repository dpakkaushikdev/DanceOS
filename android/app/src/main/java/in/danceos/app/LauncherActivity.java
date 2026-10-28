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
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

/*
 * ⚠ HAND-EDITED AFTER `bubblewrap update` (1.3.1 → 1.3.3, 28 Oct 2026). `bubblewrap
 * update` REGENERATES THIS FILE and wipes the location step below — re-apply it
 * from git after every update (CLAUDE.md, the 1.3.3 block).
 *
 * THE LOCATION IS ASKED HERE, NOT BY THE PAGE. In 1.3.0 the page asked and Chrome
 * delegated the question to this app — but by then this activity has finished and
 * Chrome's screen is the one showing, so the library opened Android's dialog from
 * the BACKGROUND, which HyperOS (Redmi Note 13, Android 15) silently blocks. Asked
 * from here, over the splash and before Chrome is launched, it is a foreground
 * request — the way a native app like Cult asks.
 *
 * ⚠ ASKED ON EVERY OPEN UNTIL IT IS ALLOWED (1.3.3, the user: "if gps is not on
 * then again at restart it can ask; if user allows then it will directly be on, as
 * app permission is allowed"). No marker of our own any more: 1.3.1 keyed the
 * question to bubblewrap's first-open marker (spent by an install over 1.3.0, so
 * an update never asked) and 1.3.2 to its own (which counted a dialog closed
 * without an answer as asked). Android itself ends the asking — after two Don't
 * allows it answers DENIED at once, with no dialog — so this is one dialog per
 * open for somebody who has not decided, and nothing for somebody who has.
 * "Only this time" lapses when the app is left for a while, so it asks again on
 * the open after that, which is what those words promise.
 *
 * `dos_first_open` on the launch URL now simply says whether the location is
 * allowed: true → the page reads the position (delegation answers without a
 * dialog, the permission is held); false → the page never asks. The name stays
 * because `proxy.ts` reads it.
 */
public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String PARAM_FIRST_OPEN = "dos_first_open";
    private static final int REQUEST_LOCATION = 4207;

    private boolean hasLocation() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
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
     *  the location, hold the launch and ask Android — FINE and COARSE together,
     *  which is what shows Precise / Approximate (asking FINE alone is ignored on
     *  Android 12+). The answer, whatever it is, launches the TWA. */
    @Override
    protected boolean shouldLaunchImmediately() {
        if (hasLocation()) {
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
