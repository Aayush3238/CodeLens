import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { dashboardAPI } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { StatCard, Skeleton, PageHeader } from '../components/ui'
import { Code2, CheckCircle, Clock, Flame, TrendingUp, Target, GitBranch, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area } from 'recharts'

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16']

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.getDashboard().then((r) => r.data),
  })

  const { data: diffProgress } = useQuery({
    queryKey: ['difficulty-progress'],
    queryFn: () => dashboardAPI.getDifficultyProgress(30).then((r) => r.data),
  })

  if (isLoading) return <DashboardSkeleton />

  const { stats, topicDistribution, dailyActivity, recentProblems } = data || {}
  const difficultyData = [
    { name: 'Easy', value: stats?.easy || 0, color: '#22c55e' },
    { name: 'Medium', value: stats?.medium || 0, color: '#eab308' },
    { name: 'Hard', value: stats?.hard || 0, color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${data?.user?.name || 'User'}`} description="Here's your coding progress overview" />

      {(!user?.leetcodeUsername || !user?.githubId) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <p className="text-sm font-medium mb-3">Finish setting up your workspace</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!user?.leetcodeUsername && (
              <Link to="/settings" className="flex items-center gap-3 p-3 rounded-xl border border-dark-700 border-gray-200 hover:border-primary-500 transition-all group">
                <div className="p-2 rounded-lg bg-primary-600/10 text-primary-400"><Code2 size={18} /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Connect LeetCode</p>
                  <p className="text-dark-400 text-xs">Track submissions & get AI analysis</p>
                </div>
                <ArrowRight size={16} className="text-dark-500 group-hover:text-primary-400" />
              </Link>
            )}
            {!user?.githubId && (
              <a href={`${import.meta.env.VITE_API_URL || ''}/api/auth/github`} className="flex items-center gap-3 p-3 rounded-xl border border-dark-700 border-gray-200 hover:border-primary-500 transition-all group">
                <div className="p-2 rounded-lg bg-primary-600/10 text-primary-400"><GitBranch size={18} /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Connect GitHub</p>
                  <p className="text-dark-400 text-xs">Analyze your repositories</p>
                </div>
                <ArrowRight size={16} className="text-dark-500 group-hover:text-primary-400" />
              </a>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Problems Solved" value={stats?.totalSolved || 0} icon={CheckCircle} color="text-green-400" trend="+12 this week" />
        <StatCard label="Easy / Medium / Hard" value={`${stats?.easy || 0} / ${stats?.medium || 0} / ${stats?.hard || 0}`} icon={Code2} color="text-primary-400" />
        <StatCard label="Acceptance Rate" value={`${stats?.acceptanceRate || 0}%`} icon={Target} color="text-yellow-400" />
        <StatCard label="Current Streak" value={`${stats?.streak || 0} days`} icon={Flame} color="text-orange-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Topic Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topicDistribution || []}>
              <XAxis dataKey="topic" tick={{ fill: '#94a3b8', fontSize: 12 }} angle={-35} textAnchor="end" height={80} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {(topicDistribution || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Difficulty Split</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={difficultyData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value">
                {difficultyData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {difficultyData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm text-dark-400">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {dailyActivity && dailyActivity.length > 0 && (() => {
        const last30 = dailyActivity.slice(-30)
        const hasData = last30.some((d) => d.count > 0)
        if (!hasData) return null
        return (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Submissions (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={last30}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} labelFormatter={(v) => `Date: ${v}`} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )
      })()}

      {diffProgress?.progress && diffProgress.progress.length > 0 && diffProgress.progress[diffProgress.progress.length - 1].total > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Difficulty Progress (Cumulative)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={diffProgress.progress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }} labelFormatter={(v) => `Date: ${v}`} />
              <Area type="monotone" dataKey="easy" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
              <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.3} />
              <Area type="monotone" dataKey="hard" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-green-500" /> Easy</span>
            <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Medium</span>
            <span className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-red-500" /> Hard</span>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Recently Solved</h3>
        <div className="space-y-3">
          {(recentProblems || []).map((p) => (
            <div key={p.leetcodeId} className="flex items-center justify-between p-3 rounded-xl bg-dark-800/50 dark:bg-dark-800/50 bg-gray-100 hover:bg-dark-800 dark:hover:bg-dark-800 hover:bg-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-dark-500 dark:text-dark-500 text-gray-400 text-sm">#{p.leetcodeId}</span>
                <span className="font-medium">{p.title}</span>
              </div>
              <span className={`difficulty-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
