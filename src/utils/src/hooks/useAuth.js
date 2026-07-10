import { useAuthContext } from "../context/AuthContext";

// Thin convenience wrapper so components can `import { useAuth }` without
// needing to know it's backed by AuthContext underneath.
export function useAuth() {
  return useAuthContext();
}
