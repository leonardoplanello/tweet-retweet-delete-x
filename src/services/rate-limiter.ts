/**
 * Gerenciador de cadência segura e controle de pausas/rate-limiting com suporte a keepalive.
 */
export class RateLimiter {
  private isPaused: boolean = false;
  private isAborted: boolean = false;

  /**
   * Aguarda um tempo aleatório entre minMs e maxMs, respeitando pausas, cancelamento e keepalive.
   */
  async wait(
    minMs: number,
    maxMs: number,
    onTick?: (remainingMs: number) => void,
    onHeartbeat?: () => void
  ): Promise<void> {
    if (this.isAborted) {
      throw new Error('Operação cancelada pelo usuário.');
    }

    if (this.isPaused) {
      await this.waitForResume(onHeartbeat);
    }

    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    const interval = 100;
    let elapsed = 0;
    let lastHeartbeat = Date.now();

    while (elapsed < delay) {
      if (this.isAborted) {
        throw new Error('Operação cancelada pelo usuário.');
      }
      if (this.isPaused) {
        await this.waitForResume(onHeartbeat);
      }

      const step = Math.min(interval, delay - elapsed);
      await new Promise((resolve) => setTimeout(resolve, step));
      elapsed += step;

      if (onTick) {
        onTick(delay - elapsed);
      }

      if (onHeartbeat && Date.now() - lastHeartbeat >= 10000) {
        lastHeartbeat = Date.now();
        onHeartbeat();
      }
    }
  }

  /**
   * Executa cooldown obrigatório após detectar HTTP 429 (Rate Limit) com keepalive.
   */
  async cooldown(
    seconds: number,
    onCountdown?: (secondsLeft: number) => void,
    onHeartbeat?: () => void
  ): Promise<void> {
    for (let s = seconds; s > 0; s--) {
      if (this.isAborted) {
        throw new Error('Operação cancelada pelo usuário.');
      }
      if (onCountdown) {
        onCountdown(s);
      }
      if (onHeartbeat && s % 10 === 0) {
        onHeartbeat();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Pausa a execução.
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Retoma a execução.
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Cancela permanentemente a execução em andamento.
   */
  abort(): void {
    this.isAborted = true;
    this.isPaused = false;
  }

  /**
   * Reinicia o estado para uma nova execução.
   */
  reset(): void {
    this.isPaused = false;
    this.isAborted = false;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get aborted(): boolean {
    return this.isAborted;
  }

  private async waitForResume(onHeartbeat?: () => void): Promise<void> {
    let lastHeartbeat = Date.now();
    while (this.isPaused && !this.isAborted) {
      if (onHeartbeat && Date.now() - lastHeartbeat >= 5000) {
        lastHeartbeat = Date.now();
        onHeartbeat();
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
