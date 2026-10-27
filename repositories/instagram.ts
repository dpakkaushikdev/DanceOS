import type { SupabaseClient } from "@supabase/supabase-js";
import { storeRemoteAvatar } from "@/repositories/avatars";

/** CONNECTED INSTAGRAM ACCOUNTS (18 Oct 2026, `20261027090000_instagram_is_connected`).
 *  Readable by anybody (the handle is public once it is on a profile); written
 *  only by `connect_instagram` under the service role, from the OAuth callback.
 *  Whether a chip wears the tick is `verifiedInstagram` in `lib/constants/socials`. */

/** WHO, AMONG THESE PEOPLE, HAS CONNECTED INSTAGRAM — ids in, id → username out.
 *  One read per page, never one per row. Empty in, empty out, no round trip; a
 *  failed read is "nobody", never an error, so a page never fails over a tick. */
export async function findInstagramUsernames(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))].slice(0, 400);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("instagram_connections").select("user_id, username").in("user_id", unique).is("deleted_at", null);
  if (error || !data) return new Map();
  return new Map((data as Array<{ user_id: string; username: string }>).map((r) => [r.user_id, r.username]));
}

/** the callback's one write — service-role client only */
export async function connectInstagram(
  admin: SupabaseClient,
  input: { userId: string; igUserId: string; username: string; accountType: string | null }
): Promise<void> {
  const { error } = await admin.rpc("connect_instagram", {
    p_user_id: input.userId,
    p_ig_user_id: input.igUserId,
    p_username: input.username,
    p_account_type: input.accountType,
  });
  if (error) throw new Error(error.message);
}

/** THE INSTAGRAM PICTURE BECOMES THE PROFILE PHOTO (20 Oct 2026) — the same two
 *  steps a picked photo takes (`PhotoPicker` → `setMyAvatarAction`), run on the
 *  server with the PERSON's session: the object goes into their own
 *  `avatars/{user}/` folder, where the storage policy decides, and
 *  `set_my_profile_photo` records it after re-checking the folder. Resolves to
 *  the stored path. */
/*  ⚠ THE BODY MOVED TO `repositories/avatars.ts` (27 Oct 2026) when Google
 *  sign-in wanted the same two steps — one rule, so the two cannot drift. The
 *  stored path is unchanged: `photoPath` builds it from the folder, a random
 *  name and the content type, and never from the caller's label. */
export async function storeInstagramPictureAsAvatar(
  supabase: SupabaseClient,
  input: { userId: string; bytes: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" }
): Promise<string> {
  return storeRemoteAvatar(supabase, input);
}

/** the person's own way out; their Instagram link stays, without the tick */
export async function disconnectInstagram(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("disconnect_instagram");
  if (error) throw new Error(error.message);
}
