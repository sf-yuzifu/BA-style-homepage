/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*.yaml' {
  import type { AppConfig } from '@/types/config'
  const content: AppConfig
  export default content
}

declare module '/_config.yaml' {
  import type { AppConfig } from '@/types/config'
  const config: AppConfig
  export default config
}

declare module '*.md' {
  const html: string
  export default html
}

declare module '@/assets/font/ResourceHanRoundedCN-Medium.ttf' {
  export const css: { family: string; weight: string | number }
}

declare module '@/assets/font/ResourceHanRoundedCN-Bold.ttf' {
  export const css: { family: string; weight: string | number }
}

declare module 'virtual:pwa-register' {
  export type RegisterSWOptions = {
    immediate?: boolean
    onNeedRefresh?: () => void | Promise<void>
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

declare module 'aplayer' {
  export interface APlayerAudio {
    name: string
    artist: string
    url: string
    cover?: string
    lrc?: string
  }

  export interface APlayerOptions {
    container: HTMLElement
    autoplay?: boolean
    mini?: boolean
    order?: 'list' | 'random'
    lrcType?: number
    listFolded?: boolean
    loop?: 'all' | 'one' | 'none'
    audio?: APlayerAudio[]
  }

  export default class APlayer {
    constructor(options: APlayerOptions)
    destroy(): void
    play(): void
    pause(): void
    /** nostorage 为 true 时不写 APlayer 自己的 localStorage（音量由本站设置面板接管） */
    volume(percentage?: number, nostorage?: boolean): void
    on(event: string, callback: (...args: unknown[]) => void): void
    setMode(mode: 'mini' | 'normal'): void
    lrc: { hide(): void; show(): void }
    list: {
      add(audios: APlayerAudio | APlayerAudio[]): void
      clear(): void
      switch(index: number): void
    }
    audio: HTMLAudioElement
  }
}

declare module 'ba-click-fx' {
  export class BAClickFX {
    constructor(options?: Record<string, unknown>)
    destroy(): void
  }
  export default BAClickFX
}

interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
  addEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void
  removeEventListener(type: 'levelchange' | 'chargingchange', listener: () => void): void
}

interface Navigator {
  userLanguage?: string
  getBattery?: () => Promise<BatteryManager>
}

interface Window {
  __l2dDebug?: {
    getState: () => unknown
    boneClientPos: (name: string) => { x: number; y: number } | null
    headClientPos: () => { x: number; y: number } | null
    switchCharacter: (index: number | '+' | '-') => Promise<void>
    listBones: (pattern: string) => string[]
  }
}
