import { createContext } from 'preact'
import { useContext, useState } from 'preact/hooks'
import { AlertTriangle } from 'lucide-preact'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider')
  return context.confirm
}

export function ConfirmProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, setState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    open: false,
    options: { message: '' },
    resolve: null,
  })

  const confirm = (options: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => {
      setState({ open: true, options, resolve })
    })

  const handleClose = (result: boolean) => {
    state.resolve?.(result)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-2xl ${state.options.danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle
                  size={24}
                  className={state.options.danger ? 'text-red-500' : 'text-amber-500'}
                />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">
                  {state.options.title || 'Confirm'}
                </h3>
                <p className="text-gray-500 mt-1">{state.options.message}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleClose(false)}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {state.options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 py-3 px-4 rounded-2xl font-bold transition-colors ${
                  state.options.danger
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-accent-500 text-white hover:bg-accent-600'
                }`}
              >
                {state.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
