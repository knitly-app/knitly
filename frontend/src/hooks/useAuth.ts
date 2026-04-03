import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth, type User } from '../api/endpoints'
import { useToast } from '../components/Toast'

export function useAuth() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: auth.me,
    retry: false,
    staleTime: 1000 * 60 * 5,
  })

  const loginMutation = useMutation({
    mutationFn: auth.login,
    onSuccess: (data: User & { restoredFromDeletion?: boolean }) => {
      queryClient.setQueryData(['auth', 'me'], data)
      if (data.restoredFromDeletion) {
        toast.success('Your account has been restored.')
      }
    },
  })

  const signupMutation = useMutation({
    mutationFn: auth.signup,
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
    },
  })

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout: logoutMutation.mutate,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  }
}
