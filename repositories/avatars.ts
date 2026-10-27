import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, photoPath } from "@/lib/media/photo";

/** A PICTURE FETCHED FROM SOMEWHERE ELSE, BECOMING THE PROFILE PHOTO
 *  (27 Oct 2026, lifted out of `repositories/instagram.ts` when Google sign-in
 *  needed the identical two steps).
 *
 *  The two steps a picked photo takes (`PhotoPicker` → `setMyAvatarAction`),
 *  run on the server with the PERSON's session: the object goes into their own
 *  `avatars/{user}/` folder, where the storage policy decides, and
 *  `set_my_profile_photo` records it after re-checking the folder. Resolves to
 *  the stored path.
 *
 *  ⚠ THE SESSION MUST BE THEIRS, never the service role. The folder in the
 *  path is the whole of the authority check, and a service-role client would
 *  sail past the policy that reads it.
 *
 *  ⚠ `set_my_profile_photo` REFUSES A PERSON WITH NO PROFILE ROW ("finish
 *  onboarding first"), so this cannot run before onboarding's first Continue
 *  has made the row. Both callers wait for it. */
export async function storeRemoteAvatar(
  supabase: SupabaseClient,
  input: { userId: string; bytes: Uint8Array; type: "image/jpeg" | "image/png" | "image/webp" }
): Promise<string> {
  const path = photoPath({ kind: "avatar", id: input.userId }, { name: "remote", type: input.type });
  const up = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, input.bytes, { contentType: input.type, upsert: false });
  if (up.error) throw new Error(`Could not store the picture: ${up.error.message}`);
  const { data, error } = await supabase.rpc("set_my_profile_photo", { p_path: path });
  if (error) {
    /* the object is orphaned without its row — take it back down */
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return (data as string | null) ?? path;
}
