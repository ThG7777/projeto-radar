import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Offer = Database["public"]["Tables"]["offers"]["Row"];
export type Destination = Database["public"]["Tables"]["destinations"]["Row"];
export type Settings = Database["public"]["Tables"]["app_settings"]["Row"];
export type OfferStatus = "new" | "approved" | "posted" | "rejected";

export const isAdminQuery = queryOptions({
  queryKey: ["is-admin"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { isAdmin: false, email: null as string | null };
    const { data, error } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (error) throw error;
    return { isAdmin: Boolean(data), email: u.user.email ?? null };
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const offersQuery = (status: OfferStatus) =>
  queryOptions({
    queryKey: ["offers", status],
    queryFn: async () => {
      let q = supabase.from("offers").select("*").eq("status", status);
      q = status === "posted" ? q.order("posted_at", { ascending: false }) : q.order("score", { ascending: false });
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data;
    },
  });

export const offerCountsQuery = queryOptions({
  queryKey: ["offers", "counts"],
  queryFn: async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const count = async (build: () => PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count: c, error } = await build();
      if (error) throw error;
      return c ?? 0;
    };
    const head = { count: "exact" as const, head: true };
    const [fresh, approved, postedToday] = await Promise.all([
      count(() => supabase.from("offers").select("id", head).eq("status", "new")),
      count(() => supabase.from("offers").select("id", head).eq("status", "approved")),
      count(() =>
        supabase.from("offers").select("id", head).eq("status", "posted").gte("posted_at", startOfDay.toISOString()),
      ),
    ]);
    return { fresh, approved, postedToday };
  },
});

export const destinationsQuery = queryOptions({
  queryKey: ["destinations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("destinations").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
});
