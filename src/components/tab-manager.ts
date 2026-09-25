/**
 * Gerenciador de navegação por abas da interface do popup.
 */
export class TabManager {
  private navButtons: NodeListOf<HTMLButtonElement>;
  private tabPanes: NodeListOf<HTMLElement>;
  private onTabChangeCallback?: (tabId: string) => void;

  constructor(
    navButtonsSelector: string = '.tab-nav-btn',
    tabPanesSelector: string = '.tab-pane',
    onTabChange?: (tabId: string) => void
  ) {
    this.navButtons = document.querySelectorAll(navButtonsSelector);
    this.tabPanes = document.querySelectorAll(tabPanesSelector);
    this.onTabChangeCallback = onTabChange;
    this.init();
  }

  private init(): void {
    this.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });
  }

  public switchTab(targetTabId: string): void {
    this.navButtons.forEach((btn) => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.tabPanes.forEach((pane) => {
      if (pane.id === targetTabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (this.onTabChangeCallback) {
      this.onTabChangeCallback(targetTabId);
    }
  }
}
