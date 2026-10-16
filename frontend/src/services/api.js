import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let csrfToken = null

export const fetchCsrfToken = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/csrf-token`, { withCredentials: true })
    csrfToken = res.data.csrfToken
    return csrfToken
  } catch {
    return null
  }
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true
      const { refreshToken, setToken, logout } = useAuthStore.getState()

      if (refreshToken) {
        try {
          const res = await api.post('/auth/refresh', { refreshToken })
          setToken(res.data.accessToken)
          originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`
          return api(originalRequest)
        } catch {
          logout()
          window.location.href = '/login'
        }
      } else {
        logout()
        window.location.href = '/login'
      }
    }

    if (error.response?.status === 401 && !error.response?.data?.code) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  setPassword: (password) => api.post('/auth/set-password', { password }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/auth/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteAccount: () => api.delete('/auth/account'),
}

export const dashboardAPI = {
  getDashboard: () => api.get('/dashboard'),
  getAnalytics: () => api.get('/dashboard/analytics'),
  getWeakTopics: () => api.get('/dashboard/weak-topics'),
  getDifficultyProgress: (days) => api.get('/dashboard/difficulty-progress', { params: { days } }),
}

export const problemsAPI = {
  getProblems: (params) => api.get('/problems', { params }),
  getTopics: () => api.get('/problems/topics'),
}

export const submissionsAPI = {
  getSubmissions: () => api.get('/submissions'),
  analyze: (data) => api.post('/submissions/analyze', data),
  detectPattern: (data) => api.post('/submissions/detect-pattern', data),
}

export const aiAPI = {
  getConversations: () => api.get('/ai/conversations'),
  createConversation: (data) => api.post('/ai/conversations', data),
  sendMessage: (data) => api.post('/ai/chat', data),
  chatStream: async function* (data) {
    const token = useAuthStore.getState().token
    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split('\n').filter((l) => l.startsWith('data: '))
      for (const line of lines) {
        const payload = JSON.parse(line.slice(6))
        if (payload.done) return
        if (payload.content) yield payload.content
      }
    }
  },
  generateRevisionPlan: (data) => api.post('/ai/revision-plan', data),
  getRevisionPlans: () => api.get('/ai/revision-plans'),
  explainCode: (data) => api.post('/ai/explain', data),
}

export const leetcodeAPI = {
  getStatus: () => api.get('/leetcode/status'),
  getSessionStatus: () => api.get('/leetcode/session-status'),
  getProfile: (username) => api.get(`/leetcode/profile/${username}`),
  connect: (username) => api.post('/leetcode/connect', { username }),
  sync: () => api.post('/leetcode/sync'),
  saveSession: (session) => api.post('/leetcode/session', { session }),
  disconnect: () => api.post('/leetcode/disconnect'),
}

export const githubAPI = {
  getStatus: () => api.get('/github/status'),
  getRepos: () => api.get('/github/repos'),
  getStats: () => api.get('/github/stats'),
  getRepoStats: (owner, repo) => api.get(`/github/repo/${owner}/${repo}`),
  disconnect: () => api.post('/github/disconnect'),
}

export const notificationsAPI = {
  getNotifications: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
}

export const bookmarksAPI = {
  getBookmarks: () => api.get('/bookmarks'),
  addBookmark: (problemId, note) => api.post('/bookmarks', { problemId, note }),
  removeBookmark: (id) => api.delete(`/bookmarks/${id}`),
  toggleBookmark: (problemId) => api.post('/bookmarks/toggle', { problemId }),
}

export const graphAPI = {
  getGraph: () => api.get('/graph'),
  getStats: () => api.get('/graph/stats'),
  getNodeDetails: (nodeId) => api.get(`/graph/node/${encodeURIComponent(nodeId)}`),
}

export default api
