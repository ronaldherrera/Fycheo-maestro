/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseDemoUrl = import.meta.env.VITE_DEMO_SUPABASE_URL;
const supabaseDemoAnonKey = import.meta.env.VITE_DEMO_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan variables de entorno para Supabase en Maestro");
}

if (!supabaseDemoUrl || !supabaseDemoAnonKey) {
  console.error("Faltan variables de entorno para el Supabase de la Demo en Maestro");
}

export const supabase = createClient(
  supabaseUrl || "", 
  supabaseAnonKey || ""
);

export const supabaseDemo = createClient(
  supabaseDemoUrl || "",
  supabaseDemoAnonKey || ""
);
