/**
 * Serviço para detecção e leitura de credenciais de sessão do X (Twitter) sem API.
 */
export interface XSessionInfo {
  isLoggedIn: boolean;
  csrfToken: string;
  userId?: string;
  cookieHeader?: string;
}

export class XSessionService {
  // Bearer Token padrão público do cliente web oficial do X (Twitter)
  public static readonly WEB_BEARER_TOKEN =
    'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  /**
   * Obtém o token CSRF (ct0) e dados de autenticação a partir dos cookies do navegador.
   */
  static async getSession(): Promise<XSessionInfo> {
    try {
      const ct0Cookie = await this.getCookie('ct0');
      const authTokenCookie = await this.getCookie('auth_token');
      const twidCookie = await this.getCookie('twid');

      const csrfToken = ct0Cookie?.value || '';
      const isLoggedIn = Boolean(authTokenCookie?.value && csrfToken);

      let userId: string | undefined;
      if (twidCookie?.value) {
        // twid tem formato: u%3D123456789
        const decoded = decodeURIComponent(twidCookie.value);
        const match = decoded.match(/u=(\d+)/);
        if (match) {
          userId = match[1];
        }
      }

      return {
        isLoggedIn,
        csrfToken,
        userId
      };
    } catch (error) {
      console.warn('Erro ao obter cookies de sessão do X:', error);
      return {
        isLoggedIn: false,
        csrfToken: ''
      };
    }
  }

  /**
   * Busca um cookie específico tentando primeiro x.com e depois twitter.com.
   */
  private static async getCookie(name: string): Promise<chrome.cookies.Cookie | null> {
    const urls = ['https://x.com', 'https://twitter.com'];
    for (const url of urls) {
      try {
        const cookie = await chrome.cookies.get({ url, name });
        if (cookie) {
          return cookie;
        }
      } catch {
        // Ignora e tenta o próximo
      }
    }
    return null;
  }
}
