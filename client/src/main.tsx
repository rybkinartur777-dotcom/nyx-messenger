import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import './styles/index.css'
import './styles/auth.css'
import './styles/premium_features.css'

console.log('Nyx v2.1.0 — encrypted, anonymous, secure');

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
)
