import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './level.css'
import LevelApp from './LevelApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LevelApp />
  </StrictMode>,
)
