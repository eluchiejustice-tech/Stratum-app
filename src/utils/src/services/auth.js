import { supabase } from "./supabaseClient";

// Not yet wired into the UI. Built out fully in Stage 3.

export async function signUp(email, password, name) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId) {
  return supabase.from("profiles").select("*").eq("id", userId).single();
}
