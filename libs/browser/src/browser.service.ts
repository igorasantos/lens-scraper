import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { ConfigService } from '@app/config';
import { assertSafeNavigationUrl } from './safe-navigation-url.js';
export type BrowserContextKind = 'persistent' | 'ephemeral';
export interface GetContextOptions {
  kind?: BrowserContextKind;
  headless?: boolean;
}
export interface GotoOptions {
  referer?: string;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private readonly contexts = new Map<
    BrowserContextKind,
    Promise<BrowserContext>
  >();
  constructor(private readonly config: ConfigService) {}
  async getContext(options: GetContextOptions = {}): Promise<BrowserContext> {
    const kind = options.kind ?? 'persistent';
    let launching = this.contexts.get(kind);
    if (!launching) {
      launching = this.launchContext(kind, options);
      this.contexts.set(kind, launching);
      launching.catch(() => {
        if (this.contexts.get(kind) === launching) {
          this.contexts.delete(kind);
        }
      });
    }
    return launching;
  }
  async newPage(options: GetContextOptions = {}): Promise<Page> {
    const context = await this.getContext(options);
    return context.newPage();
  }
  async goto(
    page: Page,
    url: string,
    options: GotoOptions = {},
  ): Promise<void> {
    assertSafeNavigationUrl(url);
    await page.goto(url, options);
  }
  async scrollRandomly(page: Page, focusSelector: string): Promise<void> {
    await page.click(focusSelector);
    const repetitions = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < repetitions; i++) {
      if (i > 0) {
        await this.randomScrollDelay();
      }
      await this.scrollOnce(page, 1);
    }
    const upRepetitions = Math.floor(Math.random() * 3);
    for (let i = 0; i < upRepetitions; i++) {
      await this.randomScrollDelay();
      await this.scrollOnce(page, -1);
    }
  }
  private async scrollOnce(page: Page, direction: 1 | -1): Promise<void> {
    const { scrollHeight } = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
    }));
    const deltaY = scrollHeight * Math.random() * direction;
    await page.mouse.wheel(0, deltaY);
  }
  private async randomScrollDelay(): Promise<void> {
    const delayMs = 1000 + Math.random() * 2000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  async closePage(page: Page): Promise<void> {
    const min = this.config.browserCloseWaitMinMs;
    const max = this.config.browserCloseWaitMaxMs;
    const delayMs = min + Math.random() * (max - min);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await page.close();
  }
  async closeContext(): Promise<void> {
    const launching = [...this.contexts.values()];
    this.contexts.clear();
    await Promise.all(
      launching.map(async (pending) => {
        const context = await pending.catch(() => undefined);
        await context?.close();
      }),
    );
  }
  async onModuleDestroy(): Promise<void> {
    await this.closeContext();
  }
  private async launchContext(
    kind: BrowserContextKind,
    options: GetContextOptions,
  ): Promise<BrowserContext> {
    const headless = options.headless ?? this.config.browserHeadless;
    if (kind === 'ephemeral') {
      this.logger.log(
        `Launching ephemeral Chromium context (headless=${headless}, no profile)`,
      );
      const browser = await chromium.launch({ headless });
      const context = await browser.newContext();
      context.on('close', () => void browser.close());
      return context;
    }
    const profileDir = this.config.browserProfileDir;
    this.logger.log(
      `Launching persistent Chromium context (headless=${headless}, profileDir=${profileDir})`,
    );
    return chromium.launchPersistentContext(profileDir, { headless });
  }
}
