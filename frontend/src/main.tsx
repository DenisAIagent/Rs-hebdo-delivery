import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App.tsx'
import { PROVENANCE } from './lib/provenance'

// Marqueur de paternité inerte (voir scripts/authorship) : conservé dans le
// bundle, non modifiable, sans effet sur l'app ni appel réseau.
Object.defineProperty(globalThis, '__rshProvenance', { value: PROVENANCE })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
