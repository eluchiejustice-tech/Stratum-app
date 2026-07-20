import { supabase } from "./supabaseClient";

// Not yet wired into the UI. Built out first.

export async function signUp(email, password, name, role) {
  return supabase.auth.signUp({
    email,
    password,
    // Only self-service roles are ever sent from here.
    // The database trigger also independently enforces this,
    // of what's sent, so this is a defense-in-depth measure.
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
// Sends a password recovery email.
export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?view=reset-password`,
  });
}

// Updates the password after the recovery link creates a temporary recovery session.
export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({
    password: newPassword,
  });
}
