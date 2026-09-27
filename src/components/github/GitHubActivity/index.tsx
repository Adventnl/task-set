import type { GitHubActivity as Activity } from '../../../shared/types/github'

export default function GitHubActivity({ activity, loading, completed, total }: { activity: Activity | null; loading: boolean; completed: number; total: number }) {
  const progress = `Loading activity · ${completed} of ${total} repositories checked…`
  if (!activity) return <p className="agenda-empty" role="status">{loading ? progress : 'Refresh to load activity.'}</p>
  return (
    <div className="github-activity" aria-busy={loading}>
      <dl className="github-overview" aria-label="GitHub overview">
        <div><dt>Repositories</dt><dd>{total}</dd></div>
        <div><dt>Open PRs{loading ? ' loaded' : ''}</dt><dd>{activity.pulls.length}</dd></div>
        <div><dt>Ahead branches{loading ? ' loaded' : ''}</dt><dd>{activity.branches.length}</dd></div>
      </dl>
      <p className="modal-note" role="status">{loading ? progress : `Updated ${new Date(activity.updatedAt).toLocaleTimeString()}. Refreshes every minute while this view is open.`}</p>
      {activity.warnings.length > 0 && (
        <details className="github-warnings">
          <summary>Some activity could not be loaded ({activity.warnings.length}). Results may be incomplete.</summary>
          <ul>{activity.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </details>
      )}
      <section aria-labelledby="github-pulls-title">
        <h2 id="github-pulls-title" className="github-section-title">Open pull requests · {activity.pulls.length}</h2>
        <p className="modal-note">Merge on GitHub opens the PR’s merge section. Review the current checks and rules there before confirming.</p>
        {activity.pulls.length === 0 && <p className="agenda-empty">{loading ? 'Checking pull requests…' : activity.warnings.length ? 'No pull requests loaded.' : 'No open pull requests in the selected repositories.'}</p>}
        {activity.pulls.map((pull) => (
          <article className="github-row" key={`${pull.repository}:${pull.number}`}>
            <div className="github-row-content">
              <p className="modal-note">{pull.repository} · #{pull.number}</p>
              <h3><a href={pull.url} target="_blank" rel="noopener noreferrer">{pull.title}</a></h3>
              <p className="modal-note">{pull.head} → {pull.base}</p>
              <p className="github-status">{pull.mergeStatus} · {pull.checks}</p>
            </div>
            <a className="button button-secondary" href={pull.mergeUrl} target="_blank" rel="noopener noreferrer" aria-label={`Review and merge ${pull.repository} PR #${pull.number} on GitHub`}>{pull.draft ? 'Review on GitHub ↗' : 'Merge on GitHub ↗'}</a>
          </article>
        ))}
      </section>
      <section aria-labelledby="github-branches-title">
        <h2 id="github-branches-title" className="github-section-title">Ahead branches · {activity.branches.length}</h2>
        {activity.branches.length === 0 && <p className="agenda-empty">{loading ? 'Comparing branches…' : activity.warnings.length ? 'No ahead branches loaded.' : 'No branches ahead of their default branch.'}</p>}
        {activity.branches.map((branch) => (
          <article className="github-row" key={`${branch.repository}:${branch.name}`}>
            <div className="github-row-content">
              <p className="modal-note">{branch.repository}</p>
              <h3>{branch.name}</h3>
              <p className="github-status">{branch.ahead} ahead · {branch.behind} behind {branch.base}{branch.behind === 0 ? ' · Fast-forward possible' : ' · Branches have diverged'}</p>
            </div>
            <div className="github-actions">
              <a className="button button-secondary" href={branch.compareUrl} target="_blank" rel="noopener noreferrer">Compare ↗</a>
              {branch.pullUrl && <a className="button button-quiet" href={branch.pullUrl} target="_blank" rel="noopener noreferrer">Open PR ↗</a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
