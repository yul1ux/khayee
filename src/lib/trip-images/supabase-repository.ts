import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TripImageRecord,
  TripImageRepository,
} from "./service";

export function createSupabaseTripImageRepository(
  supabase: SupabaseClient,
): TripImageRepository {
  return {
    async getEditableTrip(tripId, userId) {
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roleError) {
        return { data: null, error: roleError };
      }

      const roleNames = (roles ?? []).map(({ role }) => role);
      if (!roleNames.includes("organizer") || roleNames.includes("admin")) {
        return { data: null, error: null };
      }

      // The trip SELECT policy exposes non-published trips only to their owner
      // once administrator access has been excluded above.
      const { data, error } = await supabase
        .from("trips")
        .select("id, status")
        .eq("id", tripId)
        .maybeSingle();

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    },

    async countImages(tripId) {
      const { count, error } = await supabase
        .from("trip_images")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId);

      return { data: count, error };
    },

    async getNextSortOrder(tripId) {
      const { data, error } = await supabase
        .from("trip_images")
        .select("sort_order")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        data: data ? data.sort_order + 1 : 0,
        error,
      };
    },

    async insertImage(input) {
      const { data, error } = await supabase
        .from("trip_images")
        .insert(input)
        .select("id")
        .single();

      return { data, error };
    },

    async getImage(imageId) {
      const { data, error } = await supabase
        .from("trip_images")
        .select("id, trip_id, storage_path, alt_text, sort_order")
        .eq("id", imageId)
        .maybeSingle();

      return { data: data as TripImageRecord | null, error };
    },

    async deleteImage(imageId) {
      const { data, error } = await supabase
        .from("trip_images")
        .delete()
        .eq("id", imageId)
        .select("id")
        .maybeSingle();

      return { data: data !== null, error };
    },
  };
}
