import { useState } from 'react'
import { PaneProgram } from '../bridge'
import { TerminalPane } from './TerminalPane'

const paneColumns = 80
const paneRows = 24

interface OpenPane {
    id: string
    program: PaneProgram
}

function readProblem(error: unknown): string {
    return error instanceof Error ? error.message : 'Something went wrong'
}

export function CrewApp(): JSX.Element {
    const [folder, setFolder] = useState<string | null>(null)
    const [pane, setPane] = useState<OpenPane | null>(null)
    const [problem, setProblem] = useState<string | null>(null)
    const { crew } = window

    if (crew === undefined) {
        return <main>This page is not running inside crew, so no machine can be reached</main>
    }

    const pickFolderAndRunAgent = async (): Promise<void> => {
        setProblem(null)
        try {
            const picked = await crew.pickFolder()
            if (picked === null) {
                return
            }
            setPane(null)
            setFolder(picked)

            const program: PaneProgram = 'agent'
            setPane({ id: await crew.openPane(picked, paneColumns, paneRows, program), program })
        } catch (error) {
            setProblem(readProblem(error))
        }
    }

    return (
        <main>
            <div className="bar">
                <button type="button" onClick={pickFolderAndRunAgent}>
                    Pick a folder
                </button>
                <span className="folder">{folder ?? 'no folder yet'}</span>
            </div>
            {problem !== null && <p className="problem">{problem}</p>}
            {pane !== null && <TerminalPane crew={crew} paneId={pane.id} program={pane.program} />}
        </main>
    )
}
