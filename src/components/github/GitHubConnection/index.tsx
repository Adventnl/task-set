export default function GitHubConnection({ busy, login = '', onConnect }: { busy: boolean; login?: string; onConnect: (token: string) => Promise<void> }) {
  return (
    <section className="github-connect" aria-labelledby="github-connect-title">
      <h2 id="github-connect-title">{login ? `Renew access for ${login}` : 'Bind your GitHub account'}</h2>
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
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : login ? 'Save new token' : 'Bind GitHub'}</button>
          <a className="button button-quiet" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Create a token ↗</a>
        </div>
      </form>
      <p className="modal-note">Your account and token are saved in this browser and restored automatically after a reload. The token is sent only to GitHub. This device stays bound to this account; if the token expires or is revoked, renew it for the same account.</p>
    </section>
  )
}
