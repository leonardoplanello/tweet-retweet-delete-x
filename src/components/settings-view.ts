/**
 * Componente de configurações e preferências de exclusão da extensão.
 */
import { StorageService } from '../services/storage-service';
import { ExtensionConfig, DeletionMethod } from '../types/config';

export interface SettingsViewOptions {
  methodSelect: HTMLSelectElement;
  minDelayInput: HTMLInputElement;
  maxDelayInput: HTMLInputElement;
  autoPauseCheckbox: HTMLInputElement;
  cooldownInput: HTMLInputElement;
  customDeleteQueryIdInput: HTMLInputElement;
  clearCacheBtn: HTMLButtonElement;
  saveFeedbackEl: HTMLElement;
  onConfigChange: (config: ExtensionConfig) => void;
  onClearCache: () => void;
}

export class SettingsView {
  private options: SettingsViewOptions;
  private currentConfig!: ExtensionConfig;

  constructor(options: SettingsViewOptions) {
    this.options = options;
    this.init();
  }

  private async init(): Promise<void> {
    this.currentConfig = await StorageService.getConfig();
    this.populateForm();
    this.bindEvents();
  }

  private populateForm(): void {
    this.options.methodSelect.value = this.currentConfig.method;
    this.options.minDelayInput.value = String(this.currentConfig.minDelayMs);
    this.options.maxDelayInput.value = String(this.currentConfig.maxDelayMs);
    this.options.autoPauseCheckbox.checked = this.currentConfig.autoPauseOnRateLimit;
    this.options.cooldownInput.value = String(this.currentConfig.rateLimitCooldownSeconds);
    this.options.customDeleteQueryIdInput.value = this.currentConfig.customDeleteQueryId || '';
  }

  private bindEvents(): void {
    const save = async () => {
      const updated: ExtensionConfig = {
        method: this.options.methodSelect.value as DeletionMethod,
        minDelayMs: Math.max(200, parseInt(this.options.minDelayInput.value, 10) || 1500),
        maxDelayMs: Math.max(500, parseInt(this.options.maxDelayInput.value, 10) || 3000),
        autoPauseOnRateLimit: this.options.autoPauseCheckbox.checked,
        rateLimitCooldownSeconds: Math.max(10, parseInt(this.options.cooldownInput.value, 10) || 60),
        maxRetries: 2,
        customDeleteQueryId: this.options.customDeleteQueryIdInput.value.trim()
      };

      this.currentConfig = await StorageService.saveConfig(updated);
      this.options.onConfigChange(this.currentConfig);
      this.showSaveFeedback();
    };

    this.options.methodSelect.addEventListener('change', save);
    this.options.minDelayInput.addEventListener('change', save);
    this.options.maxDelayInput.addEventListener('change', save);
    this.options.autoPauseCheckbox.addEventListener('change', save);
    this.options.cooldownInput.addEventListener('change', save);
    this.options.customDeleteQueryIdInput.addEventListener('change', save);

    this.options.clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all loaded tweets from local cache?')) {
        await StorageService.clearTweets();
        this.options.onClearCache();
      }
    });
  }

  private showSaveFeedback(): void {
    this.options.saveFeedbackEl.textContent = 'Settings saved!';
    this.options.saveFeedbackEl.classList.add('visible');
    setTimeout(() => {
      this.options.saveFeedbackEl.classList.remove('visible');
    }, 2000);
  }

  public getConfig(): ExtensionConfig {
    return this.currentConfig;
  }
}
