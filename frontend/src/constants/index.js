export const DIFFICULTY_COLORS = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
}

export const DIFFICULTY_BG = {
  Easy: 'bg-green-400/10',
  Medium: 'bg-yellow-400/10',
  Hard: 'bg-red-400/10',
}

export const TOPICS = [
  'Array', 'Hash Table', 'Dynamic Programming', 'Tree', 'Graph',
  'Binary Search', 'Stack', 'Sliding Window', 'Backtracking',
  'Linked List', 'Heap', 'Two Pointers', 'Trie', 'Union Find',
]

export const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go']

export const SIDEBAR_GROUPS = [
  {
    label: 'Overview',
    links: [
      { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
      { path: '/profile', label: 'Profile', icon: 'User' },
    ],
  },
  {
    label: 'DSA Practice',
    links: [
      { path: '/problems', label: 'Problems', icon: 'Code2' },
      { path: '/submissions', label: 'Submissions', icon: 'FileCode' },
      { path: '/ai-coach', label: 'AI Coach', icon: 'Bot' },
      { path: '/weak-topics', label: 'Weak Topics', icon: 'Target' },
      { path: '/revision-plan', label: 'Revision Plan', icon: 'Calendar' },
    ],
  },
  {
    label: 'GitHub Insights',
    links: [
      { path: '/github', label: 'Repositories', icon: 'GitBranch' },
      { path: '/code-graph', label: 'Code Graph', icon: 'Network' },
    ],
  },
  {
    label: 'Account',
    links: [
      { path: '/settings', label: 'Settings', icon: 'Settings' },
    ],
  },
]

export const SIDEBAR_LINKS = SIDEBAR_GROUPS.flatMap((g) => g.links)
