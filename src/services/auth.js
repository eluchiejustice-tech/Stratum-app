import { supabase } from "./supabaseClient";

// Not yet wired into the UI. Built out fully in Stage 3.

export async function signUp(email, password, name, role) {
  return supabase.auth.signUp({
    email,
    password,
    // Only self-service roles are ever sent here (enforced in RoleSelect.jsx).
    // The database trigger also independently blocks "moderator" regardless
    // of what's sent, so this is a defense-in-depth measure, not the only one.
    options: { data: { name, role } },
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
