import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/shared/fixtures/registerSeeds'
import { seedIfNeeded } from '@/shared/fixtures/seedAll'
import App from './App.tsx'

seedIfNeeded()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
