import { useAuthStore, User } from '../store/authStore';

/**
 * Convenience hook for authentication state.
 * Returns auth state plus computed `isOnboarded` flag.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const loadUser = useAuthStore((s) => s.loadUser);
  const setUser = useAuthStore((s) => s.setUser);

  /**
   * A user is considered onboarded if their profile exists.
   * For now we check if the user object has a name (minimal check).
   * This will be expanded when profile data is added.
   */
  const isOnboarded = !!(user && (user.profile || (user as any).name));

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    isOnboarded,
    login,
    register,
    logout,
    loadUser,
    setUser,
  };
}
