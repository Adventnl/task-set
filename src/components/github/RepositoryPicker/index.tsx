import type { GitHubRepository } from '../../../shared/types/github'

export default function RepositoryPicker({ repositories, selected, onChoose }: {
  repositories: GitHubRepository[]
  selected: number[]
  onChoose: (ids: number[]) => void
}) {
  return (
    <details className="github-picker" open={selected.length === 0}>
      <summary>Repositories · {selected.length} of {repositories.length} selected</summary>
      <div className="github-actions">
        <button className="button button-quiet" type="button" onClick={() => onChoose(repositories.map((repo) => repo.id))}>Select all</button>
        <button className="button button-quiet" type="button" onClick={() => onChoose([])}>Clear selection</button>
      </div>
      <fieldset className="github-repositories">
        <legend className="sr-only">Repositories to monitor</legend>
        {repositories.map((repo) => (
          <label key={repo.id} className="github-repository check-field">
            <input type="checkbox" checked={selected.includes(repo.id)} onChange={(event) => onChoose(event.target.checked ? [...selected, repo.id] : selected.filter((id) => id !== repo.id))} />
            <span>{repo.name}</span>
          </label>
        ))}
      </fieldset>
      {repositories.length === 0 && <p className="modal-note">No repositories available. Check the token’s repository access.</p>}
    </details>
  )
}
