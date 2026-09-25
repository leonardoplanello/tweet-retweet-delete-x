/**
 * Varredura da timeline na aba ativa do X para extração de tweets e retweets visíveis.
 */
import { TweetItem } from '../types/tweet';

export class DomScanner {
  private static isScanning = false;

  /**
   * Identifica o handle do usuário logado ou do perfil ativo no X.
   */
  static getCurrentUserHandle(preferredHandle?: string): string | null {
    if (preferredHandle) {
      const clean = preferredHandle.trim().replace(/^@/, '').toLowerCase();
      if (/^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
        return clean;
      }
    }

    // 1. Link oficial do perfil na barra de navegação lateral (AppTabBar_Profile_Link)
    const profileLink = document.querySelector<HTMLAnchorElement>('a[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href') || '';
      const clean = href.replace(/^\//, '').split('/')[0].split('?')[0].trim();
      if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
        return clean.toLowerCase();
      }
    }

    // 2. Botão de troca de conta na barra lateral (SideNav_AccountSwitcher_Button)
    const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountSwitcher && accountSwitcher.textContent) {
      const match = accountSwitcher.textContent.match(/@([a-zA-Z0-9_]{1,15})/);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    // 3. Link na navegação com aria-label de Perfil
    const navProfile = document.querySelector<HTMLAnchorElement>(
      'nav a[aria-label*="Profile" i], nav a[aria-label*="Perfil" i]'
    );
    if (navProfile) {
      const href = navProfile.getAttribute('href') || '';
      const clean = href.replace(/^\//, '').split('/')[0].split('?')[0].trim();
      if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
        return clean.toLowerCase();
      }
    }

    // 4. URL da página se estiver em página de perfil (/nome_usuario ou /nome_usuario/with_replies)
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const candidate = pathParts[0].toLowerCase();
      const reserved = new Set([
        'home', 'explore', 'notifications', 'messages', 'i', 'compose',
        'search', 'settings', 'tos', 'privacy', 'logout', 'login', 'intent'
      ]);
      if (!reserved.has(candidate) && /^[a-zA-Z0-9_]{1,15}$/.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * Extrai o handle do autor do tweet (@usuario) a partir dos seletores do article.
   */
  static extractTweetAuthor(article: Element): string | null {
    // 1. A partir do container User-Name procurando o texto com @handle
    const userEl = article.querySelector('[data-testid="User-Name"]');
    if (userEl && userEl.textContent) {
      const match = userEl.textContent.match(/@([a-zA-Z0-9_]{1,15})/);
      if (match) {
        return match[1].toLowerCase();
      }
    }

    // 2. A partir do link do avatar do autor
    const avatarLink = article.querySelector<HTMLAnchorElement>(
      'div[data-testid="Tweet-User-Avatar"] a[href^="/"]'
    );
    if (avatarLink) {
      const href = avatarLink.getAttribute('href') || '';
      const clean = href.replace(/^\//, '').split('/')[0].split('?')[0].trim();
      if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
        return clean.toLowerCase();
      }
    }

    // 3. A partir de links de perfil dentro de User-Name (que não sejam link de status)
    if (userEl) {
      const links = userEl.querySelectorAll<HTMLAnchorElement>('a[href^="/"]');
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (!href.includes('/status/')) {
          const clean = href.replace(/^\//, '').split('/')[0].split('?')[0].trim();
          if (clean && /^[a-zA-Z0-9_]{1,15}$/.test(clean)) {
            return clean.toLowerCase();
          }
        }
      }
    }

    // 4. A partir da URL de status do tweet (/username/status/123)
    const timeEl = article.querySelector('time');
    const statusLink =
      timeEl?.closest<HTMLAnchorElement>('a[href*="/status/"]') ||
      article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
    if (statusLink) {
      const href = statusLink.getAttribute('href') || '';
      const match = href.match(/(?:x\.com|twitter\.com)?\/([a-zA-Z0-9_]{1,15})\/status\/\d+/i);
      if (match && match[1] && match[1].toLowerCase() !== 'i') {
        return match[1].toLowerCase();
      }
    }

    return null;
  }

  /**
   * Extrai os tweets presentes atualmente no DOM da página, filtrando para incluir
   * somente publicações do próprio usuário ou retweets realizados por ele.
   */
  static extractVisibleTweets(targetUsername?: string): TweetItem[] {
    const currentUser = this.getCurrentUserHandle(targetUsername);
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    const tweets: TweetItem[] = [];

    articles.forEach((article) => {
      try {
        // Encontra o link de status vinculado ao timestamp (<time>)
        const timeEl = article.querySelector('time');
        const statusLink =
          timeEl?.closest<HTMLAnchorElement>('a[href*="/status/"]') ||
          article.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
        if (!statusLink) return;

        const href = statusLink.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        if (!match) return;

        const id = match[1];

        // Texto do tweet
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const text = textEl?.textContent || '';

        // Data / hora
        const createdAt = timeEl?.getAttribute('datetime') || new Date().toISOString();

        // Identifica se é Retweet (presença do banner socialContext ou botão verde de republicação)
        const socialContext = article.querySelector('[data-testid="socialContext"]');
        const socialText = socialContext?.textContent?.toLowerCase() || '';
        const hasUnretweetBtn = Boolean(article.querySelector('[data-testid="unretweet"]'));

        const isRetweet =
          hasUnretweetBtn ||
          socialText.includes('republicou') ||
          socialText.includes('retweeted') ||
          socialText.includes('reposted') ||
          socialText.includes('você repostou') ||
          socialText.includes('you reposted');

        // Extrai o autor deste tweet específico
        const authorHandle = this.extractTweetAuthor(article);

        // FILTRAGEM CRÍTICA:
        // Se NÃO for Retweet, o tweet DEVE ter sido escrito pelo usuário logado/alvo.
        // Se foi escrito por outra pessoa (ex: alguém que respondeu ao usuário), IGNORA!
        if (!isRetweet) {
          if (currentUser && authorHandle) {
            if (authorHandle.toLowerCase() !== currentUser.toLowerCase()) {
              // Tweet escrito por outra pessoa (resposta recebida na thread) -> ignorar!
              return;
            }
          }
        } else {
          // Se FOR Retweet, confirma se foi retweetado pelo usuário atual
          const isUserRetweet =
            hasUnretweetBtn ||
            socialText.includes('você') ||
            socialText.includes('you') ||
            (Boolean(currentUser) &&
              (socialText.includes(currentUser!) ||
               window.location.pathname.toLowerCase().startsWith(`/${currentUser}`)));

          if (!isUserRetweet) {
            // Retweet feito por terceiro visível no feed -> ignorar!
            return;
          }
        }

        // Mídias
        const mediaUrls: string[] = [];
        article.querySelectorAll<HTMLImageElement>('img[src*="media"], img[src*="ext_tw_video_thumb"]').forEach((img) => {
          if (img.src && !img.src.includes('profile_images')) {
            mediaUrls.push(img.src);
          }
        });

        tweets.push({
          id,
          text,
          createdAt,
          isRetweet,
          retweetedFrom: isRetweet ? (authorHandle ? `@${authorHandle}` : undefined) : undefined,
          authorHandle: isRetweet ? undefined : (authorHandle || currentUser || undefined),
          url: `https://x.com${href.startsWith('/') ? href : `/${href}`}`,
          mediaUrls,
          selected: false,
          status: 'idle'
        });
      } catch (err) {
        console.warn('Erro ao processar tweet no DOM:', err);
      }
    });

    return tweets;
  }

  /**
   * Executa rolagem contínua para carregar tweets da timeline.
   */
  static async scanWithScroll(
    maxScrolls: number = 10,
    onProgress?: (tweets: TweetItem[]) => void,
    targetUsername?: string
  ): Promise<TweetItem[]> {
    this.isScanning = true;
    const allFound = new Map<string, TweetItem>();

    for (let i = 0; i < maxScrolls; i++) {
      if (!this.isScanning) break;

      const batch = this.extractVisibleTweets(targetUsername);
      for (const t of batch) {
        allFound.set(t.id, t);
      }

      if (onProgress) {
        onProgress(Array.from(allFound.values()));
      }

      // Rola para baixo
      window.scrollBy({ top: 800, behavior: 'smooth' });
      await new Promise((r) => setTimeout(r, 1200));
    }

    this.isScanning = false;
    return Array.from(allFound.values());
  }

  static stopScan(): void {
    this.isScanning = false;
  }
}
