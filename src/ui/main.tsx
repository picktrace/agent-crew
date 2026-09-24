import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CrewApp } from './CrewApp'
import './index.css'

const container = document.getElementById('root')

if (container === null) {
    document.body.textContent = 'The page is missing its root element'
} else {
    createRoot(container).render(
        <StrictMode>
            <CrewApp />
        </StrictMode>
    )
}
