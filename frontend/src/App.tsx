import { useEffect, useState } from 'react'
import './App.css'

interface HealthResponse {
  status: string
  app: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/health`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        setHealth(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setHealth(null)
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [])

  return (
    <div className="App">
      <h1>AuraSphere</h1>
      {loading && <p>Checking backend health...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {health && (
        <div>
          <p>✓ Backend is running</p>
          <pre>{JSON.stringify(health, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default App
