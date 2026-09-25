/**
 * Configurações de execução e preferências do usuário.
 */
export type DeletionMethod = 'dom' | 'hybrid' | 'graphql';

export interface ExtensionConfig {
  method: DeletionMethod;
  minDelayMs: number;
  maxDelayMs: number;
  autoPauseOnRateLimit: boolean;
  rateLimitCooldownSeconds: number;
  maxRetries: number;
  customDeleteQueryId?: string;
  customUnretweetQueryId?: string;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  method: 'dom', // Padrão recomendado: navegação direta na UI do X
  minDelayMs: 1500,
  maxDelayMs: 3000,
  autoPauseOnRateLimit: true,
  rateLimitCooldownSeconds: 60,
  maxRetries: 2,
  customDeleteQueryId: '',
  customUnretweetQueryId: ''
};
