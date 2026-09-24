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

    const pickFolder = async (): Promise<void> => {
        setProblem(null)
        try {
            const picked = await crew.pickFolder()
            if (picked === null) {
                return
            }
            setPane(null)
            setFolder(picked)
        } catch (error) {
            setProblem(readProblem(error))
        }
    }

    const runProgram = async (program: PaneProgram): Promise<void> => {
        if (folder === null) {
            return
        }
        setProblem(null)
        try {
            setPane({ id: await crew.openPane(folder, paneColumns, paneRows, program), program })
        } catch (error) {
            setProblem(readProblem(error))
        }
    }

    return (
        <main>
            <div className="bar">
                <button type="button" onClick={pickFolder}>
                    Pick a folder
                </button>
                {folder !== null && (
                    <>
                        <button type="button" onClick={() => runProgram('shell')}>
                            Run a shell
                        </button>
                        <button type="button" onClick={() => runProgram('agent')}>
                            Run Claude Code
                        </button>
                    </>
                )}
                <span className="folder">{folder ?? 'no folder yet'}</span>
            </div>
            {problem !== null && <p className="problem">{problem}</p>}
            {pane !== null && <TerminalPane crew={crew} paneId={pane.id} program={pane.program} />}
        </main>
    )
}
