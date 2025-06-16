/**
 * Creates a debounced function which will not be called until the
 * specified {@link delay} milliseconds have passed since the last call.
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay = 300): T {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
            timeoutId = undefined
            fn(...args)
        }, delay)
    }) as T
}
