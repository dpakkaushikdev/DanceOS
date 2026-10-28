/** "I'LL LOOK FIRST" — the welcome screen's Skip (28 Oct 2026, the user: "cult
 *  fit app signup has a skip option; when user clicks over skip it can go to
 *  discover page … the profile icon shows no user image as sign up is skipped;
 *  clicking over blank user image redirects to the signup page again").
 *
 *  While this cookie is set, a signed-out open of `/` goes to Discover instead
 *  of the welcome screen, and the blank picture in the top bar is the way back
 *  to sign-in. Nothing clears it but time: signing in makes it moot, and a
 *  person who skipped once should not be made to skip again on every open. */
export const BROWSE_COOKIE = "dos_browse";
export const BROWSE_MAX_AGE_S = 60 * 60 * 24 * 30;
