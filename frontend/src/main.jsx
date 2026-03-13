import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1f2937' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1f2937' },
          },
        }}
      />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
