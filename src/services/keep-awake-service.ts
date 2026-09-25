/**
 * Serviço para evitar que o navegador entre em repouso, suspenda abas ou reduza timers
 * enquanto houver processos em andamento (mesmo minimizado ou sem foco).
 */
export class KeepAwakeService {
  private static audioCtx: AudioContext | null = null;
  private static oscillator: OscillatorNode | null = null;
  private static wakeLock: any = null;
  private static active: boolean = false;

  /**
   * Ativa a reprodução de áudio silencioso e Wake Lock para manter o Chrome ativo em segundo plano/minimizado.
   */
  static async enable(): Promise<void> {
    if (this.active) return;
    this.active = true;

    try {
      // 1. Web Audio silencioso: O Chrome garante prioridade de processo e desativa suspensão de abas com áudio
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioCtxClass();
        }

        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = 0.00001; // Praticamente 0 (inaudível)
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        osc.start();
        this.oscillator = osc;
      }
    } catch (err) {
      console.warn('[KeepAwake] Erro ao iniciar AudioContext:', err);
    }

    try {
      // 2. Screen Wake Lock API (se suportado pelo navegador)
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch {
      // Ignora se não houver permissão ou foco
    }
  }

  /**
   * Desativa o keep-awake e libera recursos do navegador.
   */
  static disable(): void {
    this.active = false;

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
      }
    } catch (err) {
      console.warn('[KeepAwake] Erro ao desativar KeepAwake:', err);
    }
  }

  static get isRunning(): boolean {
    return this.active;
  }
}
