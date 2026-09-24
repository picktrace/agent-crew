import { useState } from 'react'
import { TerminalPane } from './TerminalPane'

const paneColumns = 80
const paneRows = 24

export function CrewApp(): JSX.Element {
    const [folder, setFolder] = useState<string | null>(null)
    const [paneId, setPane] = useState<string | null>(null)
    const [problem, setProblem] = useState<string | null>(null)
    const { crew } = window

    if (crew === undefined) {
        return <main>This page is not running inside crew, so no machine can be reached</main>
    }

    const pickFolder = async (): Promise<void> => {
        setProblem(null)
        try {
            const picked = await crew.pickFolder()
            if (picked === null) {
                return
            }
            setFolder(picked)
            setPane(await crew.openPane(picked, paneColumns, paneRows))
        } catch (error) {
            setProblem(error instanceof Error ? error.message : 'Something went wrong')
        }
    }

    return (
        <main>
            <button type="button" onClick={pickFolder}>
                Pick a folder
            </button>
            <p>{folder ?? 'no folder yet'}</p>
            {problem !== null && <p>{problem}</p>}
            {paneId !== null && <TerminalPane crew={crew} paneId={paneId} />}
        </main>
    )
}
