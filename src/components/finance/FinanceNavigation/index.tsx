import {
  ArrowLeftRight,
  Building2,
  ChartNoAxesCombined,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  Settings2,
  Tags,
} from 'lucide-react'
import type { FinanceTab } from '../../../shared/types/finance'
const SECTIONS = [
  { tab: 'Overview', icon: LayoutDashboard },
  { tab: 'Transactions', icon: ArrowLeftRight },
  { tab: 'Review Inbox', icon: Inbox },
  { tab: 'Accounts', icon: Building2 },
  { tab: 'Categories', icon: Tags },
  { tab: 'Analytics', icon: ChartNoAxesCombined },
  { tab: 'Reports', icon: FileSpreadsheet },
  { tab: 'Finance Settings', icon: Settings2 },
] as const
export default function FinanceNavigation({
  tab,
  reviewCount,
  transactionCount,
  onChoose,
}: {
  tab: FinanceTab
  reviewCount: number
  transactionCount: number
  onChoose: (tab: FinanceTab) => void
}) {
  return (
    <aside className="finance-sidebar">
      <nav className="finance-nav" aria-label="Finance sections">
        {SECTIONS.map(({ tab: section, icon: Icon }) => (
          <button
            key={section}
            aria-current={tab === section ? 'page' : undefined}
            onClick={() => onChoose(section)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{section === 'Finance Settings' ? 'Settings' : section}</span>
            {section === 'Review Inbox' && reviewCount > 0 && (
              <span className="finance-count">{reviewCount}</span>
            )}
          </button>
        ))}
      </nav>
      <label className="finance-mobile-nav">
        <span className="sr-only">Finance section</span>
        <select
          value={tab}
          onChange={(e) => onChoose(e.target.value as FinanceTab)}
        >
          {SECTIONS.map(({ tab: section }) => (
            <option key={section} value={section}>
              {section === 'Finance Settings' ? 'Settings' : section}
              {section === 'Review Inbox' && reviewCount
                ? ` (${reviewCount})`
                : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="finance-sidebar-footer">
        <LockKeyhole size={14} aria-hidden="true" />
        <span>
          Private workspace
          <small>{transactionCount.toLocaleString()} transactions</small>
        </span>
      </div>
    </aside>
  )
}
