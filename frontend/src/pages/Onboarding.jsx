import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../stores/authStore'
import { authAPI, leetcodeAPI } from '../services/api'
import { Button } from '../components/ui'
import toast from 'react-hot-toast'
import { Code2, GitBranch, Target, CheckCircle, Loader2, Rocket } from 'lucide-react'

const FOCUS_OPTIONS = [
  {
    id: 'leetcode',
    icon: Code2,
    title: 'LeetCode Prep',
    description: 'Track solved problems, analyze submissions, and get AI coaching on DSA.',
  },
  {
    id: 'github',
    icon: GitBranch,
    title: 'GitHub Analysis',
    description: 'Analyze repositories for architecture, code quality, and bug risks.',
  },
  {
    id: 'both',
    icon: Target,
    title: 'Both',
    description: 'Full power: LeetCode coaching plus GitHub repository intelligence.',
  },
]

function StepDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${i === step ? 'w-8 bg-primary-500' : i < step ? 'w-4 bg-primary-500/40' : 'w-4 bg-dark-700 bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const [focus, setFocus] = useState('both')
  const [lcUsername, setLcUsername] = useState('')
  const [lcStatus, setLcStatus] = useState('idle') // idle | checking | valid | invalid
  const [lcProfile, setLcProfile] = useState(null)
  const [lcConnecting, setLcConnecting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const guessedUsername = user?.email?.split('@')[0] || ''

  useEffect(() => {
    if (guessedUsername) {
      setLcUsername(guessedUsername)
    }
  }, [guessedUsername])

  const checkUsername = async (username) => {
    const name = (username || '').trim()
    if (!name) {
      setLcStatus('idle')
      setLcProfile(null)
      return
    }
    setLcStatus('checking')
    try {
      const res = await leetcodeAPI.getProfile(name)
      setLcProfile(res.data.profile)
      setLcStatus('valid')
    } catch {
      setLcProfile(null)
      setLcStatus('invalid')
    }
  }

  const handleUsernameBlur = () => {
    if (lcUsername.trim() && lcUsername.trim() !== guessedUsername) {
      checkUsername(lcUsername)
    } else if (lcUsername.trim()) {
      checkUsername(lcUsername)
    }
  }

  const handleConnectLeetcode = async () => {
    const name = lcUsername.trim()
    if (!name) {
      toast.error('Enter a LeetCode username')
      return
    }
    setLcConnecting(true)
    try {
      const res = await leetcodeAPI.connect(name)
      updateUser({ leetcodeUsername: res.data.profile?.username || name })
      toast.success('LeetCode connected!')
      setLcStatus('valid')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not find that LeetCode user')
      setLcStatus('invalid')
    } finally {
      setLcConnecting(false)
    }
  }

  const finish = async (skipOnboardingApi = false) => {
    setFinishing(true)
    try {
      if (!skipOnboardingApi) {
        const res = await authAPI.completeOnboarding(focus)
        updateUser(res.data.user)
      }
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    } finally {
      setFinishing(false)
    }
  }

  const skipStep = () => {
    if (step < 2) setStep(step + 1)
    else finish()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 bg-gray-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <Rocket size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name?.split(' ')[0] || 'there'}!</h1>
          <p className="text-dark-400 mt-2">Let's set up your coaching workspace</p>
        </div>

        <div className="card p-8">
          <StepDots step={step} />

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-center">What do you want to focus on?</h2>
              <p className="text-dark-400 text-sm text-center">You can change this later in Settings.</p>
              {FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFocus(opt.id)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                    focus === opt.id
                      ? 'border-primary-500 bg-primary-600/10'
                      : 'border-dark-700 border-gray-200 hover:border-dark-500 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${focus === opt.id ? 'bg-primary-600/20 text-primary-400' : 'bg-dark-800 bg-gray-100 text-dark-400'}`}>
                    <opt.icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{opt.title}</p>
                    <p className="text-dark-400 text-sm mt-0.5">{opt.description}</p>
                  </div>
                  {focus === opt.id && <CheckCircle size={20} className="text-primary-400 shrink-0" />}
                </button>
              ))}
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setStep(1)} className="flex-1 py-3">Continue</Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-center">Connect your LeetCode</h2>
              <p className="text-dark-400 text-sm text-center">
                We'll track your submissions and analyze your solutions.
              </p>
              <div>
                <label className="block text-sm font-medium text-dark-300 text-gray-600 mb-2">LeetCode username</label>
                <div className="flex gap-2">
                  <input
                    value={lcUsername}
                    onChange={(e) => { setLcUsername(e.target.value); setLcStatus('idle') }}
                    onBlur={handleUsernameBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handleUsernameBlur()}
                    className="input flex-1"
                    placeholder="your-leetcode-username"
                  />
                  <Button variant="secondary" onClick={handleUsernameBlur} disabled={lcStatus === 'checking'}>
                    {lcStatus === 'checking' ? <Loader2 size={16} className="animate-spin" /> : 'Check'}
                  </Button>
                </div>
                {lcStatus === 'valid' && lcProfile && (
                  <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    {lcProfile.avatar && <img src={lcProfile.avatar} alt="" className="w-10 h-10 rounded-full" />}
                    <div>
                      <p className="text-green-400 text-sm font-medium flex items-center gap-1">
                        <CheckCircle size={14} /> {lcProfile.name || lcUsername}
                      </p>
                      <p className="text-dark-400 text-xs">
                        {lcProfile.totalSolved ?? 0} solved · {lcProfile.easy ?? 0} E · {lcProfile.medium ?? 0} M · {lcProfile.hard ?? 0} H
                      </p>
                    </div>
                  </div>
                )}
                {lcStatus === 'invalid' && (
                  <p className="text-red-400 text-sm mt-2">No LeetCode user found with that username.</p>
                )}
                {guessedUsername && lcUsername === guessedUsername && lcStatus === 'idle' && (
                  <p className="text-dark-500 text-xs mt-2">
                    Guessed from your email — click Check to verify.
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={skipStep}>Skip</Button>
                <Button
                  onClick={handleConnectLeetcode}
                  disabled={lcConnecting || !lcUsername.trim()}
                  className="flex-1 py-3"
                >
                  {lcConnecting ? 'Connecting...' : lcStatus === 'valid' ? 'Continue' : 'Connect'}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-center">Connect GitHub</h2>
              <p className="text-dark-400 text-sm text-center">
                Analyze your repositories for architecture, quality, and bug risks.
              </p>
              <div className="p-4 rounded-xl border border-dark-700 border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <GitBranch size={18} className="text-primary-400" />
                  <p className="font-medium">GitHub account</p>
                </div>
                {user?.githubId ? (
                  <p className="text-green-400 text-sm flex items-center gap-1">
                    <CheckCircle size={14} /> Already connected
                  </p>
                ) : (
                  <p className="text-dark-400 text-sm">
                    Redirects to GitHub for one-click authorization. You can also connect later in Settings.
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => finish()}>Finish</Button>
                {!user?.githubId && (
                  <Button
                    variant="secondary"
                    onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/auth/github` }}
                    className="flex-1"
                  >
                    Connect GitHub
                  </Button>
                )}
                <Button onClick={() => finish()} disabled={finishing} className="flex-1 py-3">
                  {finishing ? 'Saving...' : 'Go to Dashboard'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-dark-500 text-xs mt-4">
          Step {step + 1} of 3 · You can skip anything and finish later
        </p>
      </motion.div>
    </div>
  )
}
