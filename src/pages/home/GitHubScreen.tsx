import GitHubActivity from '../../components/github/GitHubActivity'
import GitHubConnection from '../../components/github/GitHubConnection'
import RepositoryPicker from '../../components/github/RepositoryPicker'
import type { useGitHub } from '../../shared/hooks/useGitHub'

export default function GitHubScreen({ github }: { github: ReturnType<typeof useGitHub> }) {
  return (
    <div className="github-screen">
      {github.error && <p className="form-error" role="alert">{github.error}</p>}
      {!github.login || github.needsToken ? <GitHubConnection busy={github.busy} login={github.login} onConnect={github.connect} /> : (
        <>
          <div className="github-toolbar">
            <p className="modal-text">Connected as <strong>{github.login}</strong></p>
            <div className="github-actions">
              <button className="button button-secondary" type="button" onClick={github.refresh} disabled={github.loading}>Refresh</button>
              <a className="button button-quiet" href={`https://github.com/${encodeURIComponent(github.login)}`} target="_blank" rel="noopener noreferrer">Open GitHub ↗</a>
            </div>
          </div>
          <RepositoryPicker repositories={github.repositories} selected={github.selected} discovering={github.discovering} onReload={() => void github.reloadRepositories()} onChoose={github.choose} />
          {github.storageError && <p className="form-error" role="alert">{github.storageError}</p>}
          {github.selected.length ? <GitHubActivity activity={github.activity} loading={github.loading} completed={github.completed} total={github.selected.length} /> : <p className="agenda-empty">Select repositories to monitor their pull requests and branches.</p>}
        </>
      )}
    </div>
  )
}
