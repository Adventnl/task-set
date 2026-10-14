import { GITHUB_OWNER } from '../../../shared/config/owner'

export default function GitHubConnection({ busy, onConnect }: { busy: boolean; login?: string; onConnect: () => Promise<void> }) {
  return (
    <section className="github-connect" aria-labelledby="github-connect-title">
      <h2 id="github-connect-title">Adventnl’s GitHub</h2>
      <p className="modal-text">See open pull requests and branches ahead of their default branch in one place.</p>
      <p className="modal-note">This private workspace connects to {GITHUB_OWNER} automatically. Access is managed by the workspace owner.</p>
      <button className="button button-primary" type="button" disabled={busy} onClick={() => void onConnect()}>{busy ? 'Connecting…' : 'Retry connection'}</button>
    </section>
  )
}
