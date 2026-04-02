const BASE = '/api'

export async function fetchRules() {
  const res = await fetch(`${BASE}/rules`)
  if (!res.ok) throw new Error('Failed to load rules')
  return res.json()
}

export async function computeAutomata(config) {
  const res = await fetch(`${BASE}/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Computation failed' }))
    throw new Error(err.detail || 'Computation failed')
  }
  return res.json()
}
