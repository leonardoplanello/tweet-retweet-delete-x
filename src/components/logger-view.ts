/**
 * Componente de console e registro visual de eventos da extensão.
 */
export interface LoggerViewOptions {
  containerElement: HTMLElement;
  logsOutputElement: HTMLElement;
  clearBtn?: HTMLButtonElement;
  toggleBtn?: HTMLButtonElement;
}

export class LoggerView {
  private options: LoggerViewOptions;
  private maxLogs: number = 200;

  constructor(options: LoggerViewOptions) {
    this.options = options;
    this.init();
  }

  private init(): void {
    if (this.options.clearBtn) {
      this.options.clearBtn.addEventListener('click', () => {
        this.clear();
      });
    }

    if (this.options.toggleBtn) {
      this.options.toggleBtn.addEventListener('click', () => {
        this.options.containerElement.classList.toggle('collapsed');
      });
    }
  }

  public log(message: string): void {
    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const logLine = document.createElement('div');
    logLine.className = 'log-line';
    logLine.textContent = `[${timeStr}] ${message}`;

    this.options.logsOutputElement.appendChild(logLine);

    // Limita o número de linhas para manter performance
    while (this.options.logsOutputElement.children.length > this.maxLogs) {
      this.options.logsOutputElement.removeChild(this.options.logsOutputElement.firstChild!);
    }

    // Rola para a linha mais recente
    this.options.logsOutputElement.scrollTop = this.options.logsOutputElement.scrollHeight;
  }

  public clear(): void {
    this.options.logsOutputElement.innerHTML = '';
  }
}
