/**
 * Controlador de visualização de listas de Tweets ou Retweets com filtros e seleção em massa.
 */
import { TweetItem, TweetFilter } from '../types/tweet';
import { TweetCard } from './tweet-card';

export interface TweetListViewOptions {
  containerElement: HTMLElement;
  filterInput?: HTMLInputElement;
  startDateInput?: HTMLInputElement;
  endDateInput?: HTMLInputElement;
  selectAllBtn?: HTMLButtonElement;
  deselectAllBtn?: HTMLButtonElement;
  counterElement?: HTMLElement;
  isRetweetList: boolean;
  onSelectionChange: () => void;
  onDeleteSingle: (tweet: TweetItem) => void;
}

export class TweetListView {
  private options: TweetListViewOptions;
  private tweets: TweetItem[] = [];
  private filter: TweetFilter = { keyword: '' };

  constructor(options: TweetListViewOptions) {
    this.options = options;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (this.options.filterInput) {
      this.options.filterInput.addEventListener('input', (e) => {
        this.filter.keyword = (e.target as HTMLInputElement).value.toLowerCase();
        this.render();
      });
    }

    if (this.options.startDateInput) {
      this.options.startDateInput.addEventListener('change', (e) => {
        this.filter.startDate = (e.target as HTMLInputElement).value;
        this.render();
      });
    }

    if (this.options.endDateInput) {
      this.options.endDateInput.addEventListener('change', (e) => {
        this.filter.endDate = (e.target as HTMLInputElement).value;
        this.render();
      });
    }

    if (this.options.selectAllBtn) {
      this.options.selectAllBtn.addEventListener('click', () => {
        this.setSelectAllVisible(true);
      });
    }

    if (this.options.deselectAllBtn) {
      this.options.deselectAllBtn.addEventListener('click', () => {
        this.setSelectAllVisible(false);
      });
    }
  }

  public setTweets(allTweets: TweetItem[]): void {
    // Filtra pelo tipo da lista (Tweet vs Retweet)
    this.tweets = allTweets.filter((t) => t.isRetweet === this.options.isRetweetList);
    this.render();
  }

  public getVisibleTweets(): TweetItem[] {
    return this.tweets.filter((t) => {
      // Filtro de palavra-chave
      if (this.filter.keyword) {
        const textMatch = t.text.toLowerCase().includes(this.filter.keyword);
        const authorMatch = t.retweetedFrom?.toLowerCase().includes(this.filter.keyword);
        if (!textMatch && !authorMatch) return false;
      }
      // Filtro de data inicial
      if (this.filter.startDate) {
        const itemDate = new Date(t.createdAt).getTime();
        const startDate = new Date(this.filter.startDate).getTime();
        if (itemDate < startDate) return false;
      }
      // Filtro de data final
      if (this.filter.endDate) {
        const itemDate = new Date(t.createdAt).getTime();
        const endDate = new Date(this.filter.endDate).setHours(23, 59, 59, 999);
        if (itemDate > endDate) return false;
      }
      return true;
    });
  }

  public setSelectAllVisible(select: boolean): void {
    const visible = this.getVisibleTweets();
    visible.forEach((t) => {
      if (t.status !== 'success') {
        t.selected = select;
      }
    });
    this.render();
    this.options.onSelectionChange();
  }

  public render(): void {
    const container = this.options.containerElement;
    container.innerHTML = '';

    const visibleTweets = this.getVisibleTweets();

    this.updateCounter(visibleTweets);

    if (visibleTweets.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = `
        <p>No ${this.options.isRetweetList ? 'retweets' : 'tweets'} found.</p>
        <span class="empty-hint">Use the profile scan button or import your Twitter archive.</span>
      `;
      container.appendChild(emptyDiv);
      return;
    }

    const fragment = document.createDocumentFragment();
    visibleTweets.forEach((tweet) => {
      const card = TweetCard.render(
        tweet,
        (id, selected) => {
          const item = this.tweets.find((t) => t.id === id);
          if (item) {
            item.selected = selected;
            this.updateCounter(visibleTweets);
            this.options.onSelectionChange();
          }
        },
        (t) => this.options.onDeleteSingle(t)
      );
      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  }

  private updateCounter(visible: TweetItem[]): void {
    if (!this.options.counterElement) return;
    const selectedCount = visible.filter((t) => t.selected && t.status !== 'success').length;
    const totalCount = visible.length;
    this.options.counterElement.textContent = `${selectedCount} selected of ${totalCount}`;
  }
}
