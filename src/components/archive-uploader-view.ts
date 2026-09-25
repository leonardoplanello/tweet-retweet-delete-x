/**
 * Componente para upload e processamento do arquivo oficial Twitter Archive (.js / .json).
 */
import { ArchiveParserService } from '../services/archive-parser-service';
import { StorageService } from '../services/storage-service';
import { TweetItem } from '../types/tweet';

export interface ArchiveUploaderViewOptions {
  fileInput: HTMLInputElement;
  dropZone: HTMLElement;
  statusElement: HTMLElement;
  onArchiveLoaded: (items: TweetItem[]) => void;
  onLog: (msg: string) => void;
}

export class ArchiveUploaderView {
  private options: ArchiveUploaderViewOptions;

  constructor(options: ArchiveUploaderViewOptions) {
    this.options = options;
    this.init();
  }

  private init(): void {
    this.options.fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.processFile(file);
      }
    });

    // Drag & Drop
    const dropZone = this.options.dropZone;
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        this.processFile(file);
      }
    });

    dropZone.addEventListener('click', () => {
      this.options.fileInput.click();
    });
  }

  private async processFile(file: File): Promise<void> {
    this.showStatus(`Reading file "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`, 'info');
    this.options.onLog(`[ARCHIVE] Processing data file: ${file.name}`);

    try {
      const content = await file.text();
      const items = ArchiveParserService.parse(content);

      if (items.length === 0) {
        this.showStatus('No tweets were found in this file.', 'error');
        return;
      }

      const tweetsCount = items.filter((t) => !t.isRetweet).length;
      const rtsCount = items.filter((t) => t.isRetweet).length;

      // Salva no storage local mesclando com os existentes
      const merged = await StorageService.mergeTweets(items);

      this.showStatus(
        `✅ Import complete! Loaded ${tweetsCount} Tweets and ${rtsCount} Retweets (${items.length} total).`,
        'success'
      );
      this.options.onLog(`[ARCHIVE SUCCESS] ${tweetsCount} tweets and ${rtsCount} retweets cached locally.`);
      this.options.onArchiveLoaded(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.showStatus(`Error processing file: ${msg}`, 'error');
      this.options.onLog(`[ARCHIVE ERROR] ${msg}`);
    }
  }

  private showStatus(msg: string, type: 'info' | 'success' | 'error'): void {
    this.options.statusElement.textContent = msg;
    this.options.statusElement.className = `archive-status ${type}`;
  }
}
