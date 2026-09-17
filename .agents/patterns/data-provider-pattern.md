# Data Provider Pattern

Pattern for creating React Context-based data providers for data preloading.

## Template

```tsx
import React, { createContext, FC, useContext } from 'react'
import { useQuery, [API_FUNCTION], type [DATA_TYPE] } from '@picktrace/containers'

type State = {
    [dataProperty]: [DATA_TYPE][]
    loading: boolean
    error?: string
    setError: (error?: string) => void
    reload: () => Promise<void>
}

const Context = createContext<State>({
    [dataProperty]: [],
    loading: false,
    setError: () => {},
    reload: () => Promise.resolve(),
})

export const [ComponentName]DataProvider: FC = ({ children }) => {
    const { data: [dataProperty] = [], loading, error, setError, load } = useQuery([API_FUNCTION], [])

    const value: State = {
        [dataProperty],
        loading,
        error,
        setError,
        reload: load,
    }

    return <Context.Provider value={value}>{children}</Context.Provider>
}

export const use[ComponentName]Data = (): State => {
    return useContext(Context)
}
```

## Usage Example

### 1. Creating specific data provider:

```tsx
// CustomDocumentLogicDataProvider.tsx
import React, { createContext, FC, useContext } from 'react'
import { useQuery, getAllCustomDocuments, type CustomDocument } from '@picktrace/containers'

type State = {
    documents: CustomDocument[]
    loading: boolean
    error?: string
    setError: (error?: string) => void
    reload: () => Promise<void>
}

const initialState: State = {
    documents: [],
    loading: false,
    setError: () => {},
    reload: () => Promise.resolve(),
}

const Context = createContext<State>(initialState)

export const CustomDocumentLogicDataProvider: FC = ({ children }) => {
    const { data: documents = [], loading, error, setError, load } = useQuery(getAllCustomDocuments, [])

    const value: State = {
        documents,
        loading,
        error,
        setError,
        reload: load,
    }

    return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useCustomDocumentLogicData = (): State => {
    return useContext(Context)
}
```

### 2. Integration in component:

```tsx
// In parent component (e.g., Modal)
<ComponentDataProvider>
    <YourContent />
</ComponentDataProvider>

// In child component
const { data, loading, error, reload } = useComponentData()
```

## Template Variables:

- `[ComponentName]` - component name (e.g., `CustomDocumentLogic`)
- `[dataProperty]` - data property name (e.g., `documents`, `users`, `items`)
- `[DATA_TYPE]` - data type (e.g., `CustomDocument`, `User`, `Item`)
- `[API_FUNCTION]` - API function (e.g., `getAllCustomDocuments`, `getUsers`)

## Benefits:

1. **Data preloading** - loads once
2. **Fast access** - no delays in selectors/components
3. **Centralized state** - single management point
4. **Reusability** - can be used across components
5. **Error handling** - built-in error management
6. **Reload functionality** - ability to refresh data

## When to use:

- Data needed in multiple components
- Data used in selectors/dropdowns
- Need to avoid multiple API calls
- Centralized state management required
