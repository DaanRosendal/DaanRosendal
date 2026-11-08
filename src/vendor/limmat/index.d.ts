export interface Options {
    /** Return true if you handled the click. limmat then calls preventDefault. */
    onLinkClick?: (href: string, event: MouseEvent) => boolean | void;
    /** Site-relative paths ('/research/x/') are links only if this returns true. Default: all paths are links. */
    isInternalPath?: (path: string) => boolean;
    /** Default ['https:', 'http:', 'mailto:']. Everything else renders as plain text. */
    allowedProtocols?: string[];
    /** Called once when a code fence closes. Receives the <code> element. */
    highlight?: (el: HTMLElement, code: string, lang: string) => void | Promise<void>;
    /** Minimum ms between re-renders of the open block. Default 50. 0 renders on every write. */
    throttleMs?: number;
    /** Prefix for every generated class. Default 'limmat'. */
    classPrefix?: string;
    labels?: {
        copy?: string;
        copied?: string;
        table?: string;
    };
}
export interface Renderer {
    write(chunk: string): void;
    end(): void;
    reset(): void;
    destroy(): void;
}
export declare function createRenderer(container: HTMLElement, options?: Options): Renderer;
