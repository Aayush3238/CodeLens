import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { authAPI, leetcodeAPI, githubAPI } from '../services/api'
import { Button } from '../components/ui'
import {
  User, Key, Trash2, Moon, Sun, Link as LinkIcon, Unlink, RefreshCw,
  CheckCircle, GitBranch, Shield, Settings as SettingsIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'connections', label: 'Connections', icon: LinkIcon },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'appearance', label: 'Appearance', icon: SettingsIcon },
  { id: 'account', label: 'Account', icon: Trash2 },
]

function getStoredTheme() {
  if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'dark'
  return 'dark'
}

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.remove('dark')
    root.classList.add('light')
  }
  localStorage.setItem('theme', theme)
}

function ProfileTab() {
  const { user, updateUser } = useAuthStore()
  const [newPassword, setNewPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const { register, handleSubmit } = useForm({
    defaultValues: { name: user?.name || '' },
  })

  const isOAuthUser = !!user?.googleId || !!user?.githubId

  const onUpdateProfile = async (data) => {
    try {
      const res = await authAPI.updateProfile(data)
      updateUser(res.data.user)
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setSettingPassword(true)
    try {
      await authAPI.setPassword(newPassword)
      toast.success('Password set! You can now sign in with email/password too.')
      setNewPassword('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set password')
    } finally {
      setSettingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onUpdateProfile)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-dark-300 text-gray-600 mb-2">Name</label>
          <input {...register('name', { required: true })} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-300 text-gray-600 mb-2">Email</label>
          <input value={user?.email || ''} disabled className="input w-full opacity-50" />
          <p className="text-dark-500 text-gray-400 text-xs mt-1">Email cannot be changed</p>
        </div>
        <Button type="submit">Save Changes</Button>
      </form>

      {isOAuthUser && (
        <div className="border-t border-dark-700 border-gray-200 pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={18} className="text-primary-400" />
            <h3 className="font-semibold">Set Password</h3>
          </div>
          <p className="text-dark-400 text-gray-500 text-sm mb-4">You signed in with a social provider. Set a password to also enable email/password login.</p>
          <div className="flex gap-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input flex-1"
              placeholder="New password (min 6 characters)"
              onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
            />
            <Button onClick={handleSetPassword} disabled={settingPassword}>
              {settingPassword ? 'Setting...' : 'Set Password'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionsTab() {
  const { user, updateUser } = useAuthStore()
  const [lcUsername, setLcUsername] = useState(user?.leetcodeUsername || '')
  const [lcConnected, setLcConnected] = useState(!!user?.leetcodeUsername)
  const [lcSyncing, setLcSyncing] = useState(false)
  const [lcConnecting, setLcConnecting] = useState(false)
  const [lcLastSynced, setLcLastSynced] = useState(null)
  const [lcHasSession, setLcHasSession] = useState(false)
  const [lcSession, setLcSession] = useState('')
  const [savingSession, setSavingSession] = useState(false)
  const [ghConnected, setGhConnected] = useState(false)

  useEffect(() => {
    leetcodeAPI.getStatus()
      .then((res) => {
        setLcConnected(res.data.connected)
        setLcUsername(res.data.username || '')
        setLcLastSynced(res.data.lastSyncedAt)
      })
      .catch(() => {})

    leetcodeAPI.getSessionStatus()
      .then((res) => setLcHasSession(res.data.hasSession))
      .catch(() => {})

    githubAPI.getStatus()
      .then((res) => setGhConnected(res.data.connected))
      .catch(() => {})
  }, [])

  const handleLcConnect = async () => {
    if (!lcUsername.trim()) {
      toast.error('Enter a LeetCode username')
      return
    }
    setLcConnecting(true)
    try {
      const res = await leetcodeAPI.connect(lcUsername.trim())
      setLcConnected(true)
      updateUser({ leetcodeUsername: lcUsername.trim() })
      toast.success(`Connected! Synced ${res.data.syncedCount} problems`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect')
    } finally {
      setLcConnecting(false)
    }
  }

  const handleLcSync = async () => {
    setLcSyncing(true)
    try {
      const res = await leetcodeAPI.sync()
      toast.success(`Synced ${res.data.syncedCount} problems`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed')
    } finally {
      setLcSyncing(false)
    }
  }

  const handleLcDisconnect = async () => {
    if (!window.confirm('Disconnect your LeetCode account?')) return
    try {
      await leetcodeAPI.disconnect()
      setLcConnected(false)
      setLcUsername('')
      updateUser({ leetcodeUsername: null })
      toast.success('LeetCode disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const handleGithubConnect = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/github`
  }

  const handleGithubDisconnect = async () => {
    if (!window.confirm('Disconnect your GitHub account?')) return
    try {
      await githubAPI.disconnect()
      setGhConnected(false)
      toast.success('GitHub disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  const handleSaveSession = async () => {
    if (!lcSession.trim()) {
      toast.error('Paste your LEETCODE_SESSION cookie value')
      return
    }
    setSavingSession(true)
    try {
      await leetcodeAPI.saveSession(lcSession.trim())
      setLcHasSession(true)
      setLcSession('')
      toast.success('Session saved! Deep sync enabled.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save session')
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
            <LinkIcon size={18} className="text-primary-400" />
          <h3 className="font-semibold">LeetCode</h3>
        </div>
        </div>
        {lcConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-green-400 text-sm font-medium">Connected as <strong>{lcUsername}</strong></span>
            </div>
            {lcLastSynced && (
              <p className="text-dark-500 text-gray-400 text-xs">Last synced: {new Date(lcLastSynced).toLocaleString()}</p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleLcSync} disabled={lcSyncing} variant="secondary">
                <RefreshCw size={16} className={lcSyncing ? 'animate-spin' : ''} />
                {lcSyncing ? 'Syncing...' : 'Sync Data'}
              </Button>
              <Button onClick={handleLcDisconnect} className="bg-red-600 hover:bg-red-700">
                <Unlink size={16} />
                Disconnect
              </Button>
            </div>

            <div className="mt-4 p-4 rounded-xl border border-dark-700 border-gray-200 bg-dark-800/30 bg-gray-50/50">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-primary-400" />
                <span className="text-sm font-medium">Deep Sync (Optional)</span>
                {lcHasSession && <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-lg">Active</span>}
              </div>
              <p className="text-dark-400 text-gray-500 text-xs mb-3">
                Paste your LEETCODE_SESSION cookie to enable deep sync with private submission data.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={lcSession}
                  onChange={(e) => setLcSession(e.target.value)}
                  className="input flex-1 text-xs"
                  placeholder="LEETCODE_SESSION cookie value"
                />
                <Button onClick={handleSaveSession} disabled={savingSession} variant="secondary" className="text-xs">
                  {savingSession ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-dark-400 text-gray-500 text-sm">Sync your solved problems and submissions.</p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lcUsername}
                onChange={(e) => setLcUsername(e.target.value)}
                className="input flex-1"
                placeholder="LeetCode username"
                onKeyDown={(e) => e.key === 'Enter' && handleLcConnect()}
              />
              <Button onClick={handleLcConnect} disabled={lcConnecting}>
                {lcConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-dark-700 border-gray-200 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch size={18} className="text-primary-400" />
          <h3 className="font-semibold">GitHub</h3>
        </div>
        {ghConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-green-400 text-sm font-medium">GitHub connected</span>
            </div>
            <p className="text-dark-400 text-gray-500 text-sm">Repos and contribution data available for AI analysis.</p>
            <Button onClick={handleGithubDisconnect} className="bg-red-600 hover:bg-red-700">
              <Unlink size={16} />
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-dark-400 text-gray-500 text-sm">Analyze your repositories and coding patterns.</p>
            <Button onClick={handleGithubConnect}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Connect GitHub
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ApiKeysTab() {
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    api.get('/api/auth/api-key').then(({ data }) => setHasKey(data.hasKey)).catch(() => {})
  }, [])

  const onSaveApiKey = async () => {
    if (!apiKey) return
    try {
      await api.put('/api/auth/api-key', { apiKey })
      setHasKey(true)
      setApiKey('')
      toast.success('API key saved securely')
    } catch {
      toast.error('Failed to save API key')
    }
  }

  const onDeleteApiKey = async () => {
    try {
      await api.delete('/api/auth/api-key')
      setHasKey(false)
      toast.success('API key deleted')
    } catch {
      toast.error('Failed to delete API key')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-300 text-gray-600 mb-2">OpenAI API Key</label>
        {hasKey ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-400">API key is saved</span>
            <Button variant="danger" onClick={onDeleteApiKey}>Remove</Button>
          </div>
        ) : (
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input w-full"
            placeholder="sk-..."
          />
        )}
        <p className="text-dark-500 text-gray-400 text-xs mt-1">Stored securely on the server (encrypted at rest). Used for AI coaching features.</p>
      </div>
      {!hasKey && <Button variant="secondary" onClick={onSaveApiKey}>Save API Key</Button>}
    </div>
  )
}

function AppearanceTab() {
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <div className="space-y-4">
      <p className="text-dark-400 text-gray-500 text-sm">Choose your preferred theme.</p>
      <div className="flex gap-3">
        {['dark', 'light'].map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`flex items-center gap-2 px-6 py-4 rounded-xl border transition-all ${theme === t ? 'border-primary-500 bg-primary-600/10' : 'border-dark-700 border-gray-200 hover:border-dark-600 hover:border-gray-300'}`}
          >
            {t === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="capitalize font-medium">{t}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function AccountTab() {
  const { logout } = useAuthStore()

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure? This will permanently delete your account and all data.')) return
    try {
      await authAPI.deleteAccount()
      toast.success('Account deleted')
      logout()
    } catch {
      toast.error('Failed to delete account')
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-red-400/30 bg-red-400/5">
        <h3 className="font-semibold text-red-400 mb-2">Delete Account</h3>
        <p className="text-dark-400 text-gray-500 text-sm mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <Button onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
          <Trash2 size={16} />
          Delete Account
        </Button>
      </div>
    </div>
  )
}

const TAB_COMPONENTS = {
  profile: ProfileTab,
  connections: ConnectionsTab,
  'api-keys': ApiKeysTab,
  appearance: AppearanceTab,
  account: AccountTab,
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile')
  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-dark-400 text-gray-500 mt-1">Manage your account preferences</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-dark-900/50 bg-gray-100 rounded-xl border border-dark-800 border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-primary-600/20 text-primary-400'
                : 'text-dark-400 text-gray-500 hover:text-dark-200 hover:text-gray-800 hover:bg-dark-800 hover:bg-gray-200'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="card p-6"
        >
          <ActiveComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
