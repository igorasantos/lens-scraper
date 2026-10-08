import { Test, TestingModule } from '@nestjs/testing';
import { chromium, type Page } from 'playwright';
import { ConfigService } from '@app/config';
import { BrowserService } from './browser.service.js';
vi.mock('playwright', () => ({
  chromium: { launchPersistentContext: vi.fn(), launch: vi.fn() },
}));
describe('BrowserService', () => {
  let service: BrowserService;
  let launchPersistentContext: ReturnType<typeof vi.fn>;
  let launch: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    launchPersistentContext = chromium.launchPersistentContext as ReturnType<
      typeof vi.fn
    >;
    launchPersistentContext.mockReset();
    launch = chromium.launch as ReturnType<typeof vi.fn>;
    launch.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserService,
        {
          provide: ConfigService,
          useValue: {
            browserHeadless: true,
            browserProfileDir: './browser-profile',
            browserCloseWaitMinMs: 3000,
            browserCloseWaitMaxMs: 7000,
          },
        },
      ],
    }).compile();
    service = module.get<BrowserService>(BrowserService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('does nothing when closing a context that was never launched', async () => {
    await expect(service.closeContext()).resolves.toBeUndefined();
  });
  describe('getContext', () => {
    it('launches a persistent context with the configured profile dir and headless setting', async () => {
      const context = { newPage: vi.fn(), close: vi.fn() };
      launchPersistentContext.mockResolvedValue(context);
      const result = await service.getContext();
      expect(launchPersistentContext).toHaveBeenCalledWith(
        './browser-profile',
        { headless: true },
      );
      expect(result).toBe(context);
    });
    it('lets the headless option override the configured default', async () => {
      launchPersistentContext.mockResolvedValue({
        newPage: vi.fn(),
        close: vi.fn(),
      });
      await service.getContext({ headless: false });
      expect(launchPersistentContext).toHaveBeenCalledWith(
        './browser-profile',
        { headless: false },
      );
    });
    it('launches the context only once, reusing it across calls', async () => {
      launchPersistentContext.mockResolvedValue({
        newPage: vi.fn(),
        close: vi.fn(),
      });
      const first = await service.getContext();
      const second = await service.getContext();
      expect(first).toBe(second);
      expect(launchPersistentContext).toHaveBeenCalledTimes(1);
    });
    it('lets concurrent callers await the same in-flight launch', async () => {
      let resolveLaunch: (context: unknown) => void;
      launchPersistentContext.mockReturnValue(
        new Promise((resolve) => {
          resolveLaunch = resolve;
        }),
      );
      const first = service.getContext();
      const second = service.getContext();
      const context = { newPage: vi.fn(), close: vi.fn() };
      resolveLaunch!(context);
      expect(await first).toBe(context);
      expect(await second).toBe(context);
      expect(launchPersistentContext).toHaveBeenCalledTimes(1);
    });
    it('launches an ephemeral context on a fresh browser, with no profile dir, when kind is ephemeral', async () => {
      const context = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      const browser = {
        newContext: vi.fn().mockResolvedValue(context),
        close: vi.fn().mockResolvedValue(undefined),
      };
      launch.mockResolvedValue(browser);
      const result = await service.getContext({ kind: 'ephemeral' });
      expect(launch).toHaveBeenCalledWith({ headless: true });
      expect(browser.newContext).toHaveBeenCalledTimes(1);
      expect(launchPersistentContext).not.toHaveBeenCalled();
      expect(result).toBe(context);
    });
    it('closes the ephemeral browser once its context closes', async () => {
      const context = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      const browser = {
        newContext: vi.fn().mockResolvedValue(context),
        close: vi.fn().mockResolvedValue(undefined),
      };
      launch.mockResolvedValue(browser);
      await service.getContext({ kind: 'ephemeral' });
      const [event, onClose] = context.on.mock.calls[0] as [string, () => void];
      expect(event).toBe('close');
      onClose();
      expect(browser.close).toHaveBeenCalledTimes(1);
    });
    it('reuses the open context while the kind stays the same', async () => {
      const ephemeral = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      launch.mockResolvedValue({
        newContext: vi.fn().mockResolvedValue(ephemeral),
        close: vi.fn(),
      });
      expect(await service.getContext({ kind: 'ephemeral' })).toBe(ephemeral);
      expect(await service.getContext({ kind: 'ephemeral' })).toBe(ephemeral);
      expect(launch).toHaveBeenCalledTimes(1);
      expect(ephemeral.close).not.toHaveBeenCalled();
    });
    it('closes the open context of the other kind before launching a new one', async () => {
      const persistent = { newPage: vi.fn(), close: vi.fn() };
      const ephemeral = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      launchPersistentContext.mockResolvedValue(persistent);
      launch.mockImplementation(() => {
        expect(persistent.close).toHaveBeenCalledTimes(1);
        return Promise.resolve({
          newContext: vi.fn().mockResolvedValue(ephemeral),
          close: vi.fn(),
        });
      });
      expect(await service.getContext({ kind: 'persistent' })).toBe(persistent);
      expect(await service.getContext({ kind: 'ephemeral' })).toBe(ephemeral);
      expect(launch).toHaveBeenCalledTimes(1);
      expect(ephemeral.close).not.toHaveBeenCalled();
    });
    it('relaunches a kind after switching away from it and back', async () => {
      const firstPersistent = { newPage: vi.fn(), close: vi.fn() };
      const secondPersistent = { newPage: vi.fn(), close: vi.fn() };
      const ephemeral = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      launchPersistentContext
        .mockResolvedValueOnce(firstPersistent)
        .mockResolvedValueOnce(secondPersistent);
      launch.mockResolvedValue({
        newContext: vi.fn().mockResolvedValue(ephemeral),
        close: vi.fn(),
      });
      expect(await service.getContext()).toBe(firstPersistent);
      expect(await service.getContext({ kind: 'ephemeral' })).toBe(ephemeral);
      expect(await service.getContext()).toBe(secondPersistent);
      expect(firstPersistent.close).toHaveBeenCalledTimes(1);
      expect(ephemeral.close).toHaveBeenCalledTimes(1);
      expect(launchPersistentContext).toHaveBeenCalledTimes(2);
    });
    it('still launches the new kind when the other kind\'s launch had failed', async () => {
      const ephemeral = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      let rejectLaunch: (error: Error) => void;
      launchPersistentContext.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectLaunch = reject;
        }),
      );
      launch.mockResolvedValue({
        newContext: vi.fn().mockResolvedValue(ephemeral),
        close: vi.fn(),
      });
      const pending = service.getContext();
      const switching = service.getContext({ kind: 'ephemeral' });
      rejectLaunch!(new Error('launch failed'));
      await expect(pending).rejects.toThrow('launch failed');
      await expect(switching).resolves.toBe(ephemeral);
    });
    it('forgets a failed launch so the next call tries again', async () => {
      const context = { newPage: vi.fn(), close: vi.fn() };
      launchPersistentContext
        .mockRejectedValueOnce(new Error('launch failed'))
        .mockResolvedValueOnce(context);
      await expect(service.getContext()).rejects.toThrow('launch failed');
      await expect(service.getContext()).resolves.toBe(context);
      expect(launchPersistentContext).toHaveBeenCalledTimes(2);
    });
  });
  describe('newPage', () => {
    it('opens a new page on the launched context', async () => {
      const page = {};
      const context = {
        newPage: vi.fn().mockResolvedValue(page),
        close: vi.fn(),
      };
      launchPersistentContext.mockResolvedValue(context);
      const result = await service.newPage();
      expect(context.newPage).toHaveBeenCalledTimes(1);
      expect(result).toBe(page);
    });
  });
  describe('goto', () => {
    it('navigates the page when the URL is safe', async () => {
      const page = {
        goto: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page;
      await service.goto(page, 'https://www.site.com/search');
      expect(page.goto).toHaveBeenCalledWith('https://www.site.com/search', {});
    });
    it('forwards the referer to the page navigation', async () => {
      const page = {
        goto: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page;
      await service.goto(page, 'https://www.site.com/source/a', {
        referer: 'https://www.site.com/123',
      });
      expect(page.goto).toHaveBeenCalledWith('https://www.site.com/source/a', {
        referer: 'https://www.site.com/123',
      });
    });
    it('rejects an unsafe URL without navigating the page', async () => {
      const page = {
        goto: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page;
      await expect(
        service.goto(page, 'http://169.254.169.254/latest/meta-data'),
      ).rejects.toThrow('Refusing to navigate to a private/loopback IP');
      expect(page.goto).not.toHaveBeenCalled();
    });
  });
  describe('closeContext / onModuleDestroy', () => {
    it('closes the launched context and forgets it so a later call relaunches', async () => {
      const firstContext = { newPage: vi.fn(), close: vi.fn() };
      launchPersistentContext.mockResolvedValueOnce(firstContext);
      await service.getContext();
      await service.closeContext();
      expect(firstContext.close).toHaveBeenCalledTimes(1);
      const secondContext = { newPage: vi.fn(), close: vi.fn() };
      launchPersistentContext.mockResolvedValueOnce(secondContext);
      const result = await service.getContext();
      expect(result).toBe(secondContext);
      expect(launchPersistentContext).toHaveBeenCalledTimes(2);
    });
    it('closes the ephemeral context and its browser', async () => {
      const ephemeral = { newPage: vi.fn(), close: vi.fn(), on: vi.fn() };
      launch.mockResolvedValue({
        newContext: vi.fn().mockResolvedValue(ephemeral),
        close: vi.fn(),
      });
      await service.getContext({ kind: 'ephemeral' });
      await service.closeContext();
      expect(ephemeral.close).toHaveBeenCalledTimes(1);
    });
    it('skips a context whose launch failed when closing', async () => {
      let rejectLaunch: (error: Error) => void;
      launchPersistentContext.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectLaunch = reject;
        }),
      );
      const pending = service.getContext();
      const closing = service.closeContext();
      rejectLaunch!(new Error('launch failed'));
      await expect(pending).rejects.toThrow('launch failed');
      await expect(closing).resolves.toBeUndefined();
    });
    it('onModuleDestroy closes the context the same way closeContext does', async () => {
      const context = { newPage: vi.fn(), close: vi.fn() };
      launchPersistentContext.mockResolvedValue(context);
      await service.getContext();
      await service.onModuleDestroy();
      expect(context.close).toHaveBeenCalledTimes(1);
    });
  });
  describe('scrollRandomly', () => {
    it('clicks #app once, then scrolls by scrollHeight times the rolled percentage', async () => {
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.25)
        .mockReturnValueOnce(0);
      await service.scrollRandomly(page, '#app');
      expect(page.click).toHaveBeenCalledWith('#app');
      expect(page.click).toHaveBeenCalledTimes(1);
      expect(page.mouse.wheel).toHaveBeenCalledWith(0, 1000);
      vi.restoreAllMocks();
    });
    it('scrolls to the full scrollHeight when the rolled percentage is 1', async () => {
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(0);
      await service.scrollRandomly(page, '#app');
      expect(page.mouse.wheel).toHaveBeenCalledWith(0, 4000);
      vi.restoreAllMocks();
    });
    it('repeats scroll a random number of times within [1, 4], clicking #app only once', async () => {
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.3);
      await service.scrollRandomly(page, '#app');
      expect(page.click).toHaveBeenCalledTimes(1);
      expect(page.mouse.wheel).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });
    it('repeats scroll up to the maximum of 4 times, waiting 1-3s between each, clicking #app only once', async () => {
      vi.useFakeTimers();
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.99).mockReturnValue(0.3);
      const done = service.scrollRandomly(page, '#app');
      await vi.advanceTimersByTimeAsync(0);
      expect(page.click).toHaveBeenCalledTimes(1);
      expect(page.mouse.wheel).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1600);
      expect(page.mouse.wheel).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1600 * 2);
      await done;
      expect(page.click).toHaveBeenCalledTimes(1);
      expect(page.mouse.wheel).toHaveBeenCalledTimes(4);
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
    it('finishes with 0-2 upward scrolls, each preceded by a random 1-3s wait, clicking #app only once', async () => {
      vi.useFakeTimers();
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.25)
        .mockReturnValueOnce(0.99)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.4)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.6);
      const done = service.scrollRandomly(page, '#app');
      await vi.advanceTimersByTimeAsync(4000);
      await done;
      expect(page.click).toHaveBeenCalledTimes(1);
      expect((page.mouse.wheel as ReturnType<typeof vi.fn>).mock.calls).toEqual(
        [
          [0, 1000],
          [0, -1600],
          [0, -2400],
        ],
      );
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
    it('does no upward scrolls when the roll comes back 0', async () => {
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue({ scrollHeight: 4000 }),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.25)
        .mockReturnValueOnce(0);
      await service.scrollRandomly(page, '#app');
      expect(page.click).toHaveBeenCalledTimes(1);
      expect(page.mouse.wheel).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });
    it('runs the real page-context evaluate callback to read document.body.scrollHeight', async () => {
      const previousDocument = (globalThis as Record<string, unknown>).document;
      (globalThis as Record<string, unknown>).document = {
        body: { scrollHeight: 1234 },
      };
      const page = {
        click: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn((fn: () => unknown) => Promise.resolve(fn())),
        mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      } as unknown as Page;
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0);
      try {
        await service.scrollRandomly(page, '#app');
      } finally {
        (globalThis as Record<string, unknown>).document = previousDocument;
        vi.restoreAllMocks();
      }
      expect(page.mouse.wheel).toHaveBeenCalledWith(0, 617);
    });
  });
  describe('closePage', () => {
    it('waits within [browserCloseWaitMinMs, browserCloseWaitMaxMs] before closing', async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const page = {
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as Page;
      const done = service.closePage(page);
      await vi.advanceTimersByTimeAsync(4999);
      expect(page.close).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await done;
      expect(page.close).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
  });
});
