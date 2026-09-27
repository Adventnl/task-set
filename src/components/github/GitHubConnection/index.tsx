export default function GitHubConnection({ busy, onConnect }: { busy: boolean; onConnect: (token: string) => Promise<void> }) {
  return (
    <section className="github-connect" aria-labelledby="github-connect-title">
      <h2 id="github-connect-title">Connect your repositories</h2>
      <p className="modal-text">See open pull requests and branches ahead of their default branch in one place.</p>
      <p className="modal-note">Use a GitHub personal access token with read access to Contents, Pull requests, Checks, and Commit statuses for the repositories you want to monitor. Only repositories this token can access will appear.</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const token = String(new FormData(form).get('token') ?? '')
        form.reset()
        void onConnect(token)
      }}>
        <label className="field-label" htmlFor="github-token">Personal access token</label>
        <input className="text-field" id="github-token" name="token" type="password" required autoComplete="off" spellCheck={false} placeholder="Paste your GitHub token" disabled={busy} />
        <div className="github-actions">
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Connecting…' : 'Connect GitHub'}</button>
          <a className="button button-quiet" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Create a token ↗</a>
        </div>
      </form>
      <p className="modal-note">The token stays in memory in this tab and is sent only to GitHub. Reconnect after a reload. Repository choices are remembered on this device.</p>
    </section>
  )
}
