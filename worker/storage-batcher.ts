export class StorageWriteBatcher<T> {
  private pending: T | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly persist: (state: T) => Promise<void>,
    private readonly delayMs = 500,
  ) {}

  schedule(state: T): void {
    this.pending = state;

    if (this.timeout !== null) {
      return;
    }

    this.timeout = setTimeout(() => {
      void this.flush().catch(() => null);
    }, this.delayMs);
  }

  async flush(): Promise<void> {
    this.clearTimer();

    if (this.pending === null) {
      return;
    }

    const state = this.pending;
    this.pending = null;
    await this.persist(state);
  }

  cancel(): void {
    this.clearTimer();
    this.pending = null;
  }

  private clearTimer(): void {
    if (this.timeout === null) {
      return;
    }

    clearTimeout(this.timeout);
    this.timeout = null;
  }
}
