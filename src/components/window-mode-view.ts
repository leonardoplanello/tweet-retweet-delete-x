/**
 * Componente responsável pelo controle de modos de exibição (Popup, Aba Cheia e Janela Flutuante).
 * Permite ao usuário abrir a extensão em aba permanente ou janela própria para que não feche ao clicar fora.
 */
export interface WindowModeViewOptions {
  openTabBtn?: HTMLButtonElement | null;
  openWindowBtn?: HTMLButtonElement | null;
  modeBadge?: HTMLElement | null;
  onLog?: (msg: string) => void;
}

export class WindowModeView {
  private options: WindowModeViewOptions;

  constructor(options: WindowModeViewOptions) {
    this.options = options;
    this.init();
  }

  private init(): void {
    const isFullTab = window.innerWidth > 650 || window.location.search.includes('mode=tab');
    if (isFullTab && this.options.modeBadge) {
      this.options.modeBadge.textContent = '🖥️ Full Tab Mode';
      this.options.modeBadge.classList.add('visible');
    }

    if (this.options.openTabBtn) {
      this.options.openTabBtn.addEventListener('click', () => {
        this.openInNewTab();
      });
    }

    if (this.options.openWindowBtn) {
      this.options.openWindowBtn.addEventListener('click', () => {
        this.openInStandaloneWindow();
      });
    }
  }

  public openInNewTab(): void {
    const url = chrome.runtime.getURL('popup.html?mode=tab');
    chrome.tabs.create({ url })
      .then(() => {
        this.options.onLog?.('Extension opened in a permanent full tab (will not close when clicking away).');
      })
      .catch((err) => {
        console.error('Error opening tab:', err);
      });
  }

  public openInStandaloneWindow(): void {
    const url = chrome.runtime.getURL('popup.html?mode=window');
    chrome.windows.create({
      url,
      type: 'popup',
      width: 860,
      height: 720
    })
      .then(() => {
        this.options.onLog?.('Extension opened in a standalone window.');
      })
      .catch((err) => {
        console.error('Error opening window:', err);
      });
  }
}
