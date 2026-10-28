/** THE WELCOME REEL (28 Oct 2026, the user: "cult fit has 3 videos of 5-7
 *  seconds which play one after another on the signup page … make sure these
 *  videos are easily replaceable").
 *
 *  HOW TO REPLACE A VIDEO: drop a new file over `public/welcome/welcome-N.mp4`
 *  (and its still, `welcome-N.jpg`, shown while the video loads) and push.
 *  Nothing else changes. The clips were cut with ffmpeg from the user's own
 *  footage — portrait, 720×1280, H.264, 30 fps, 6.5 s, no sound (phones only
 *  autoplay a muted video), ~1 MB each; a replacement should match that shape,
 *  and must stay small: the whole reel downloads on the first open.
 *
 *  To add a fourth, add a row here and the two files. To reorder, reorder the
 *  rows. The two lines are the caption drawn over the clip's lower part — the
 *  second one in the accent colour. */
export interface WelcomeClip {
  src: string;
  poster: string;
  line1: string;
  line2: string;
}

export const WELCOME_CLIPS: readonly WelcomeClip[] = [
  /* a classical soloist on a dark stage */
  { src: "/welcome/welcome-1.mp4", poster: "/welcome/welcome-1.jpg", line1: "The Stage", line2: "is yours." },
  /* a studio class, the floor full */
  { src: "/welcome/welcome-2.mp4", poster: "/welcome/welcome-2.jpg", line1: "Learn from the best.", line2: "Classes and studios near you." },
  /* a street dancer in the open */
  { src: "/welcome/welcome-3.mp4", poster: "/welcome/welcome-3.jpg", line1: "Dance First,", line2: "Think Later!" },
];
