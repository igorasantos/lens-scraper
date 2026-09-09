import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { ConfigService } from '@app/config';
import { assertSafeNavigationUrl } from './safe-navigation-url.js';
export interface GetContextOptions {
  headless?: boolean;
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class BrowserService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserService.name);
  private context: BrowserContext | undefined;
  private launching: Promise<BrowserContext> | undefined;
  constructor(private readonly config: ConfigService) {}
  async getContext(options: GetContextOptions = {}): Promise<BrowserContext> {
    if (this.context) {
      return this.context;
    }
    if (!this.launching) {
      this.launching = this.launchContext(options);
    }
    this.context = await this.launching;
    return this.context;
  }
  async newPage(options: GetContextOptions = {}): Promise<Page> {
    const context = await this.getContext(options);
    return context.newPage();
  }
  async goto(page: Page, url: string): Promise<void> {
    assertSafeNavigationUrl(url);
    await page.goto(url);
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
    const context = this.context;
    this.context = undefined;
    this.launching = undefined;
    await context?.close();
  }
  async onModuleDestroy(): Promise<void> {
    await this.closeContext();
  }
  private async launchContext(
    options: GetContextOptions,
  ): Promise<BrowserContext> {
    const headless = options.headless ?? this.config.browserHeadless;
    const profileDir = this.config.browserProfileDir;
    this.logger.log(
      `Launching persistent Chromium context (headless=${headless}, profileDir=${profileDir})`,
    );
    return chromium.launchPersistentContext(profileDir, { headless });
  }
}
