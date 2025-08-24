import { auth } from "@/lib/auth"

// src/app/page.tsx
async function getHealth() {
  try {
    const res = await fetch('http://localhost:3000/api/health', { cache: 'no-store' })
    if (!res.ok) return { ok: false }
    return res.json()
  } catch {
    return { ok: false }
  }
}


export default async function Home() {
  const session = await auth();
  const health = await getHealth();
  const ok = (v: string) => v === 'up';

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold text-gray-900'>Welcome</h1>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='border rounded-lg p-4'>
          <div className='font-medium'>Postgres</div>
          <div className={ok(health.db) ? 'text-green-600' : 'text-red-600'}>
            {health.db}
          </div>
        </div>
        <div className='border rounded-lg p-4'>
          <div className='font-medium'>Redis</div>
          <div className={ok(health.redis) ? 'text-green-600' : 'text-red-600'}>
            {health.redis}
          </div>
        </div>
      </div>
      <pre className='text-xs opacity-70 border rounded p-2 overflow-x-auto'>
        {JSON.stringify(health, null, 2)}
      </pre>
      {session && (
        <div className='border rounded-lg p-4'>
          <div className='font-medium'>Session</div>
          <div className='text-sm text-gray-600'>
            Logged in as: {session.user?.name || session.user?.email}
          </div>
        </div>
      )}
    </div>
  );
}
