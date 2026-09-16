import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/api'
import toast from 'react-hot-toast'

export default function OAuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const error = searchParams.get('error')

    if (error) {
      toast.error('Authentication failed. Please try again.')
      navigate('/login')
      return
    }

    const exchangeTokens = async () => {
      try {
        const { data } = await api.get('/api/auth/oauth-exchange')
        if (data.token) {
          setAuth(null, data.token, data.refreshToken)
          window.location.href = '/dashboard'
        } else {
          toast.error('No token received')
          navigate('/login')
        }
      } catch {
        toast.error('Authentication failed. Please try again.')
        navigate('/login')
      }
    }

    exchangeTokens()
  }, [searchParams, navigate, setAuth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-400 text-gray-500 text-sm">Completing authentication...</p>
      </div>
    </div>
  )
}
