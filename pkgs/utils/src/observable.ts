/** Callback invoked when an {@link Observable} value changes, receiving the new and old values. */
export type Observer<T> = (update: T, old: T) => void

/** Cancels a subscription when called. */
export type Unsubscribe = () => void

/** Describes a single change to an {@link ObservableArray}. */
export type ArrayUpdate<T> = {
    type: "added" | "removed" | "changed"
    index: number
    added?: T
    removed?: T
}

/** Callback invoked when an {@link ObservableArray} changes. */
export type ArrayObserver<T> = (update: ArrayUpdate<T>) => void

/** Describes a single change to an {@link ObservableMap}. */
export type MapUpdate<K, V> = {
    type: "added" | "removed" | "changed"
    key: K
    added?: V
    removed?: V
}

/** Callback invoked when an {@link ObservableMap} changes. */
export type MapObserver<K, V> = (update: MapUpdate<K, V>) => void

/** A single value that notifies subscribers whenever it is changed via {@link set}. */
export class Observable<T> {
    #subscriptions: Map<Observer<T>, number> = new Map()

    constructor(private value: T) {}

    /** Registers an observer and returns an {@link Unsubscribe} function to remove it. */
    subscribe(observer: Observer<T>): Unsubscribe {
        this.#subscriptions.set(observer, 1)
        return () => {
            const count = this.#subscriptions.get(observer)
            if (count === undefined) return
            if (count === 0) this.#subscriptions.delete(observer)
            else this.#subscriptions.set(observer, count - 1)
        }
    }

    /** Returns the current value. */
    get(): T {
        return this.value
    }

    /** Sets a new value and notifies all subscribers. Returns the new value. */
    set(value: T): T {
        const old = this.value
        this.value = value
        for (const observer of this.#subscriptions.keys()) {
            observer(value, old)
        }
        return value
    }
}

/** An array that notifies subscribers whenever its contents change. */
export class ObservableArray<T> {
    #subscriptions: Map<ArrayObserver<T>, number> = new Map()

    constructor(private array: T[] = []) {}

    /** Registers an observer and returns an {@link Unsubscribe} function to remove it. */
    subscribe(observer: ArrayObserver<T>): Unsubscribe {
        this.#subscriptions.set(observer, 1)
        return () => {
            const count = this.#subscriptions.get(observer)
            if (count === undefined) return
            if (count === 0) this.#subscriptions.delete(observer)
            else this.#subscriptions.set(observer, count - 1)
        }
    }

    /** Returns a read-only view of the underlying array. */
    view(): readonly T[] {
        return this.array as readonly T[]
    }

    /** Returns the element at the given index. */
    get(index: number): T {
        return this.array[index]
    }

    length(): number {
        return this.array.length
    }

    [Symbol.iterator](): ArrayIterator<T> {
        return this.array[Symbol.iterator]()
    }

    /** Replaces the element at the given index, notifies subscribers, and returns the new value. */
    set(index: number, value: T): T {
        const removed = this.array[index]
        this.array[index] = value
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "changed", index, added: value, removed })
        }
        return value
    }

    /** Adds a new item to the end of the array. */
    push(value: T): void {
        const index = this.array.length
        this.array.push(value)
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "added", index, added: value })
        }
    }

    /** Removes the last value from the array and returns it. */
    pop(): T | undefined {
        if (this.array.length === 0) return undefined
        const index = this.array.length - 1
        const removed = this.array.pop()!
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "removed", index, removed })
        }
        return removed
    }

    /** Inserts a new item at the beginning of the array. */
    unshift(value: T): void {
        this.array.unshift(value)
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "added", index: 0, added: value })
        }
    }

    /** Removes the first value from the array and returns it. */
    shift(): T | undefined {
        if (this.array.length === 0) return undefined
        const removed = this.array.shift()!
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "removed", index: 0, removed })
        }
        return removed
    }

    /**
     * Removes and returns a given number of elements starting from a given index.
     * For example, `splice(1, 3)` removes three elements starting from index 1.
     */
    splice(start: number, deleteCount: number): T[] {
        const removed = this.array.splice(start, deleteCount)
        for (const item of removed) {
            for (const observer of this.#subscriptions.keys()) {
                observer({ type: "removed", index: start, removed: item })
            }
        }
        return removed
    }
}

/** A map that notifies subscribers whenever its contents change. */
export class ObservableMap<K, V> {
    #subscriptions: Map<MapObserver<K, V>, number> = new Map()

    constructor(private map: Map<K, V> = new Map()) {}

    /** Registers an observer and returns an {@link Unsubscribe} function to remove it. */
    subscribe(observer: MapObserver<K, V>): Unsubscribe {
        this.#subscriptions.set(observer, 1)
        return () => {
            const count = this.#subscriptions.get(observer)
            if (count === undefined) return
            if (count === 0) this.#subscriptions.delete(observer)
            else this.#subscriptions.set(observer, count - 1)
        }
    }

    /** Returns a read-only view of the underlying map. */
    view(): ReadonlyMap<K, V> {
        return this.map as ReadonlyMap<K, V>
    }

    /** Returns the value for the given key, or `undefined` if absent. */
    get(key: K): V | undefined {
        return this.map.get(key)
    }

    /**
     * Sets a key to the given value and notifies subscribers.
     * The update type is `"added"` when the key is new, `"changed"` otherwise.
     * Returns the new value without notifying if the value is unchanged.
     */
    set(key: K, value: V): V {
        const removed = this.map.get(key)
        if (value === removed) return value
        this.map.set(key, value)
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: removed === undefined ? "added" : "changed", key, added: value, removed })
        }
        return value
    }

    delete(key: K): V | undefined {
        const removed = this.map.get(key)
        this.map.delete(key)
        for (const observer of this.#subscriptions.keys()) {
            observer({ type: "removed", key, removed })
        }
        return removed
    }

    [Symbol.iterator](): MapIterator<[K, V]> {
        return this.map[Symbol.iterator]()
    }
}
