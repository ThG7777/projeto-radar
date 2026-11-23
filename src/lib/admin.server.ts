import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: só administradores podem fazer isso.");
}
