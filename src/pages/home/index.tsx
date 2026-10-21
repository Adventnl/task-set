import { lazy, Suspense } from 'react'
import SignInScreen from '../../components/auth/SignInScreen'
import { useSession } from '../../shared/hooks/useSession'

const TaskSetScreen = lazy(() => import('./TaskSetScreen'))

export default function HomePage() {
  const session = useSession()
  if (session.status === 'signed-out') return <SignInScreen onSignIn={session.signIn} />
  if (session.status === 'error') return (
    <main className="sign-in"><div className="sign-in-form">
      <h1>Task Set</h1><p role="alert">{session.error}</p>
      <button className="button button-primary" type="button" onClick={session.retry}>Retry sign-in check</button>
    </div></main>
  )
  if (session.status === 'checking') return <main className="sign-in" role="status">Checking access…</main>
  return <Suspense fallback={<main className="sign-in" role="status">Opening workspace…</main>}><TaskSetScreen /></Suspense>
}
