declare module 'howler' {
  export interface HowlOptions {
    src: string | string[]
    volume?: number
    loop?: boolean
    autoplay?: boolean
    mute?: boolean
    rate?: number
    html5?: boolean
    onload?: () => void
    onloaderror?: (id: number, error: unknown) => void
    onplay?: () => void
    onplayerror?: (id: number, error: unknown) => void
    onend?: () => void
    onpause?: () => void
    onstop?: () => void
  }

  export class Howl {
    constructor(options: HowlOptions)
    play(spriteOrId?: string | number): number
    stop(id?: number): this
    pause(id?: number): this
    unload(): this
    volume(vol?: number, id?: number): number | this
  }
}
