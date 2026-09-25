export interface ClaudeProject {
    hasTrustDialogAccepted?: boolean
    [key: string]: unknown
}

// No index signature on purpose. With one, a value narrowed to `object` cannot
// be passed in, because `object` has no index signature. The spread below keeps
// every other key at build time and at run time either way.
export interface ClaudeConfig {
    projects?: { [key in string]?: ClaudeProject }
}

export interface TrustOutcome {
    config: ClaudeConfig
    changed: boolean
}

export function isTrustEnabled(environment: { [key in string]?: string }): boolean {
    return environment.CREW_TRUST !== '0'
}

export function trustFolder(config: ClaudeConfig, folder: string): TrustOutcome {
    const projects = config.projects ?? {}
    const project = projects[folder] ?? {}

    if (project.hasTrustDialogAccepted === true) {
        return { config, changed: false }
    }

    return {
        config: {
            ...config,
            projects: { ...projects, [folder]: { ...project, hasTrustDialogAccepted: true } },
        },
        changed: true,
    }
}
