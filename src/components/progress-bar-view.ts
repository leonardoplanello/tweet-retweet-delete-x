/**
 * Componente visual de barra de progresso e controles de pausa/cancelamento.
 */
export interface ProgressBarViewOptions {
  containerElement: HTMLElement;
  fillElement: HTMLElement;
  textElement: HTMLElement;
  pauseBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  onTogglePause: () => void;
  onCancel: () => void;
}

export class ProgressBarView {
  private options: ProgressBarViewOptions;

  constructor(options: ProgressBarViewOptions) {
    this.options = options;
    this.init();
  }

  private init(): void {
    this.options.pauseBtn.addEventListener('click', () => {
      this.options.onTogglePause();
    });

    this.options.cancelBtn.addEventListener('click', () => {
      this.options.onCancel();
    });
  }

  public show(): void {
    this.options.containerElement.classList.add('visible');
  }

  public hide(): void {
    this.options.containerElement.classList.remove('visible');
  }

  public update(current: number, total: number, customMessage?: string): void {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    this.options.fillElement.style.width = `${percent}%`;
    this.options.textElement.textContent = customMessage || `Progress: ${current} of ${total} (${percent}%)`;
  }

  public setPaused(isPaused: boolean): void {
    this.options.pauseBtn.textContent = isPaused ? '▶️ Resume' : '⏸️ Pause';
  }
}
