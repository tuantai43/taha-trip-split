import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (new Proxy({} as SupabaseClient, {
      get(_, prop) {
        if (prop === "auth")
          return new Proxy(
            {},
            {
              get() {
                return () => ({
                  data: null,
                  error: { message: "Supabase not configured" },
                });
              },
            },
          );
        if (prop === "from")
          return () =>
            new Proxy(
              {},
              {
                get() {
                  return () => ({
                    data: null,
                    error: { message: "Supabase not configured" },
                  });
                },
              },
            );
        return () => {};
      },
    }) as unknown as SupabaseClient);
