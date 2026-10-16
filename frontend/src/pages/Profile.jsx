import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { dashboardAPI, authAPI, leetcodeAPI, submissionsAPI, bookmarksAPI } from '../services/api'
import { PageHeader, StatCard, Skeleton, Button } from '../components/ui'
import { User, Code2, Award, TrendingUp, Link2, Calendar, CheckCircle, Camera, Download } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, updateUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: user?.name || '', leetcodeUsername: user?.leetcodeUsername || '' },
  })

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.getDashboard().then((r) => r.data),
  })

  const { data: weakTopics } = useQuery({
    queryKey: ['weak-topics'],
    queryFn: () => dashboardAPI.getWeakTopics().then((r) => r.data),
  })

  const { data: lcStatus } = useQuery({
    queryKey: ['leetcode-status'],
    queryFn: () => leetcodeAPI.getStatus().then((r) => r.data),
  })

  const onSubmit = async (data) => {
    try {
      const res = await authAPI.updateProfile(data)
      updateUser(res.data.user)
      setEditing(false)
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile')
    }
  }

  const handleExportData = async () => {
    try {
      const [dashRes, subsRes, bookmarksRes] = await Promise.all([
        dashboardAPI.getDashboard(),
        submissionsAPI.getSubmissions(),
        bookmarksAPI.getBookmarks(),
      ])

      const exportData = {
        profile: { name: user?.name, email: user?.email, createdAt: user?.createdAt },
        stats: dashRes.data.stats,
        topicDistribution: dashRes.data.topicDistribution,
        recentProblems: dashRes.data.recentProblems,
        submissions: subsRes.data.submissions?.map((s) => ({
          problem: s.problem?.title,
          language: s.language,
          runtime: s.runtime,
          memory: s.memory,
          status: s.status,
          submissionTime: s.submissionTime,
        })),
        bookmarks: bookmarksRes.data.bookmarks?.map((b) => ({
          title: b.problem?.title,
          leetcodeId: b.problem?.leetcodeId,
          addedAt: b.createdAt,
        })),
        exportedAt: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leetcoach-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported!')
    } catch {
      toast.error('Failed to export data')
    }
  }

  const stats = dashboard?.stats || {}

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB')
      return
    }
    setUploading(true)
    try {
      const res = await authAPI.uploadAvatar(file)
      updateUser(res.data.user)
      toast.success('Avatar updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your LeetCoach profile" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1">
          <div className="card p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center text-3xl font-bold overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  user?.name?.charAt(0) || 'U'
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-dark-700 bg-gray-200 rounded-full flex items-center justify-center cursor-pointer hover:bg-dark-600 hover:bg-gray-300 transition-colors">
                <Camera size={14} />
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              </label>
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-dark-400 text-gray-500 mt-1">{user?.email}</p>

            <div className="mt-4 space-y-2">
              {user?.googleId && (
                <div className="flex items-center justify-center gap-2 text-sm text-dark-400 text-gray-500">
                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  <span>Google Connected</span>
                </div>
              )}
              {user?.githubId && (
                <div className="flex items-center justify-center gap-2 text-sm text-dark-400 text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  <span>GitHub Connected</span>
                </div>
              )}
              {lcStatus?.connected && (
                <div className="flex items-center justify-center gap-2 text-sm text-dark-400 text-gray-500">
                  <CheckCircle size={14} className="text-green-400" />
                  <span>LeetCode: {lcStatus.username}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-dark-500 text-gray-400">
                <Calendar size={14} />
                <span>Joined {new Date(user?.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <button onClick={() => setEditing(!editing)} className="btn-secondary mt-6 w-full">
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button onClick={handleExportData} className="btn-ghost mt-2 w-full inline-flex items-center justify-center gap-2 text-sm">
              <Download size={16} /> Export My Data
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 space-y-6">
          {editing && (
            <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 text-gray-600 mb-2">Name</label>
                <input {...register('name', { required: true })} className="input w-full" />
                {errors.name && <p className="text-red-400 text-sm">Name is required</p>}{' '}
              </div>
              <Button type="submit">Save Changes</Button>
            </form>
          )}

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Solved" value={stats.totalSolved || 0} icon={Code2} color="text-green-400" />
            <StatCard label="Easy" value={stats.easy || 0} icon={Code2} color="text-green-300" />
            <StatCard label="Medium" value={stats.medium || 0} icon={Code2} color="text-yellow-400" />
            <StatCard label="Hard" value={stats.hard || 0} icon={Code2} color="text-red-400" />
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-3">Strength Overview</h3>
            <p className="text-dark-400 text-gray-500 text-sm mb-4">Overall strength: <span className="text-primary-400 font-bold">{weakTopics?.overallStrength || 0}%</span></p>
            <div className="space-y-3">
              {(weakTopics?.topics || []).slice(0, 8).map((t) => (
                <div key={t.topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-dark-300 text-gray-600">{t.topic}</span>
                    <span className="text-dark-500 text-gray-400">{t.problemCount} problems ({t.strengthScore}%)</span>
                  </div>
                  <div className="h-2 bg-dark-800 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${t.strengthScore}%` }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="h-full bg-primary-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
              {(!weakTopics?.topics || weakTopics.topics.length === 0) && (
                <p className="text-dark-500 text-gray-400 text-sm">
                  {lcStatus?.connected
                    ? 'Not enough synced data yet. Go to Settings → Connections → Sync Data to pull your submissions.'
                    : 'Connect your LeetCode account to see topic strengths.'}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
