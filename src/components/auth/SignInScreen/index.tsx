import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'

/** Shown when the server asks this device to sign in. Local data stays on the device meanwhile. */
export default function SignInScreen({ onSignIn }: { onSignIn: (passcode: string) => Promise<void> }) {
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!passcode || busy) return
    setBusy(true)
    setError('')
    try {
      await onSignIn(passcode)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="sign-in">
      <form className="sign-in-form" onSubmit={submit}>
        <span className="brand-mark brand-mark-large" aria-hidden="true">
          <Check size={20} strokeWidth={3} />
        </span>
        <h1>Task Set</h1>
        <p>Enter your passcode to sync this device.</p>
        <label className="field-label" htmlFor="passcode">
          Passcode
        </label>
        <input
          id="passcode"
          className="text-field"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          autoFocus
          required
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary button-block" type="submit" disabled={busy || !passcode}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
