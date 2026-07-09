import type { ConfirmOptions } from '../ConfirmModal'

export function confirmThenMutate(
  confirm: (options: ConfirmOptions) => Promise<boolean>,
  options: ConfirmOptions,
  run: () => void
) {
  void (async () => {
    if (await confirm(options)) run()
  })()
}
