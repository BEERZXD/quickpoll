export class ResultBroadcastBatcher {
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly flush: () => void,
    private readonly delayMs = 1_000,
  ) {}

  schedule(): void {
    if (this.timeout !== null) {
      return;
    }

    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.flush();
    }, this.delayMs);
  }

  cancel(): void {
    if (this.timeout === null) {
      return;
    }

    clearTimeout(this.timeout);
    this.timeout = null;
  }
}
