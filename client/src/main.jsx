import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { SettingsProvider } from './contexts/SettingsContext.jsx'
import { TechniciansProvider } from './contexts/TechniciansContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <SettingsProvider>
        <TechniciansProvider>
          <App />
        </TechniciansProvider>
      </SettingsProvider>
    </ToastProvider>
  </StrictMode>,
)
