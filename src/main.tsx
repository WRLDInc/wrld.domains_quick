import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

// Foundations first (WRLD design system, vendored), then the app layer.
import './styles/wrld/tokens.css'
import './styles/wrld/colors_and_type.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
