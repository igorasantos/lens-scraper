import { Logger } from '@nestjs/common';
import { parseHTML } from 'linkedom';
import type { Page } from 'playwright';
import { SiteService } from './site.service.js';
import type { DetailConfig, SiteConfigService } from './site-config.service.js';
import type { SessionMode } from './session-mode.js';
function withFakeDocument<T>(html: string, run: () => T): T {
  const { document } = parseHTML(html);
  const previous = (globalThis as Record<string, unknown>).document;
  (globalThis as Record<string, unknown>).document = document;
  try {
    return run();
  } finally {
    (globalThis as Record<string, unknown>).document = previous;
  }
}
function evaluatingPage(html: string): Page {
  return fakePage({
    evaluate: vi.fn((fn: (arg: unknown) => unknown, arg: unknown) =>
      Promise.resolve(withFakeDocument(html, () => fn(arg))),
    ),
  });
}
const baseDetail: DetailConfig = {
  scrollFocusSelector: 'body',
  urlTemplate: 'https://example.com/{id}',
  sectionSelector: 'section',
  headerSelector: 'div[data-testid="header"]',
  titleSelector: 'h1, p',
  featureSelector: 'div[data-testid="feature-{id}"]',
  bodySelectorTemplate: 'div[data-testid="body-{id}"]',
  sourceSelectorTemplate: 'div[data-testid="source-{id}"]',
  sourceDetailTimeoutMs: 5000,
  expiredMarker: 'not available',
};
function fakeSiteConfig({
  detail = {},
  loggedInDetail = {},
  overrides = {},
}: {
  detail?: Partial<DetailConfig>;
  loggedInDetail?: Partial<DetailConfig>;
  overrides?: Partial<Record<keyof SiteConfigService, unknown>>;
} = {}): SiteConfigService {
  const details: Record<SessionMode, DetailConfig> = {
    'logged-in': {
      ...baseDetail,
      scrollFocusSelector: '#app',
      urlTemplate: 'https://example.com/item/{id}',
      titleSelector: 'p',
      ...loggedInDetail,
    },
    'logged-out': { ...baseDetail, ...detail },
  };
  const loggedInListing = {
    scrollFocusSelector: '#app',
    pageSize: 25,
    containerSelector: '[data-testid="results-container"]',
    containerTimeoutMs: 10000,
    cardSelector: 'div[data-testid^="record-card-"]',
    cardIdAttribute: 'data-testid',
    cardIdPrefix: 'record-card-',
  };
  const loggedOutListing = {
    containerSelector: 'ol.entries',
    containerTimeoutMs: 4000,
    cardSelector: 'ol.entries [data-entity-key]',
    cardIdAttribute: 'data-entity-key',
    cardIdPrefix: 'entity:',
  };
  const fill = (template: string, recordId: string): string =>
    template.replace('{id}', recordId);
  return {
    loggedInListing,
    listingSelectors: (mode: SessionMode) =>
      mode === 'logged-in' ? loggedInListing : loggedOutListing,
    detail: (mode: SessionMode) => details[mode],
    sourceUrlPrefix: 'https://example.com/source/',
    loginUrl: 'https://example.com/login',
    sanitizeStripAttributes: ['class'],
    sanitizeStripElements: ['script'],
    buildRecordDetailUrl: (recordId: string, mode: SessionMode) =>
      fill(details[mode].urlTemplate, recordId),
    buildRecordDetailSelectors: (recordId: string, mode: SessionMode) => ({
      recordFeature: fill(details[mode].featureSelector, recordId),
      bodyContent: fill(details[mode].bodySelectorTemplate, recordId),
      sourceContent: fill(details[mode].sourceSelectorTemplate, recordId),
    }),
    ...overrides,
  } as unknown as SiteConfigService;
}
function fakePage(overrides: Partial<Page> = {}): Page {
  return {
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    $$eval: vi.fn(),
    setContent: vi.fn().mockResolvedValue(undefined),
    $eval: vi.fn(),
    ...overrides,
  } as unknown as Page;
}
describe('SiteService', () => {
  let service: SiteService;
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    service = new SiteService(fakeSiteConfig());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('exposes the logged-in listing paging and scroll focus selector, and the detail scroll focus selector of each mode', () => {
    expect(service.listingPageSize).toBe(25);
    expect(service.listingScrollFocusSelector).toBe('#app');
    expect(service.recordDetailScrollFocusSelector('logged-in')).toBe('#app');
    expect(service.recordDetailScrollFocusSelector('logged-out')).toBe('body');
  });
  it('reports a source detail page only for the mode whose detail block configures a source detail selector', () => {
    expect(service.hasSourceDetailPage('logged-out')).toBe(false);
    const withDetailPage = new SiteService(
      fakeSiteConfig({ detail: { sourceDetailSelector: 'section.detail' } }),
    );
    expect(withDetailPage.hasSourceDetailPage('logged-out')).toBe(true);
    expect(withDetailPage.hasSourceDetailPage('logged-in')).toBe(false);
  });
  describe('isRecordDetailUrl', () => {
    it('returns true when the url path starts with the expected record detail path', () => {
      expect(
        service.isRecordDetailUrl(
          'https://example.com/123?x=1',
          '123',
          'logged-out',
        ),
      ).toBe(true);
    });
    it('matches against the record detail path of the given mode', () => {
      expect(
        service.isRecordDetailUrl(
          'https://example.com/item/123',
          '123',
          'logged-in',
        ),
      ).toBe(true);
      expect(
        service.isRecordDetailUrl(
          'https://example.com/123',
          '123',
          'logged-in',
        ),
      ).toBe(false);
    });
    it('returns false when the url path does not match', () => {
      expect(
        service.isRecordDetailUrl(
          'https://example.com/999',
          '123',
          'logged-out',
        ),
      ).toBe(false);
    });
    it('returns false when the url is invalid', () => {
      expect(service.isRecordDetailUrl('not a url', '123', 'logged-out')).toBe(
        false,
      );
    });
  });
  describe('buildListingPageUrl', () => {
    it('sets the start query param', () => {
      const url = service.buildListingPageUrl(
        'https://example.com/search?keywords=widgets',
        50,
      );
      expect(new URL(url).searchParams.get('start')).toBe('50');
    });
    it('overwrites an existing start param', () => {
      const url = service.buildListingPageUrl(
        'https://example.com/search?start=25',
        75,
      );
      expect(new URL(url).searchParams.get('start')).toBe('75');
    });
  });
  describe('extractRecordIds', () => {
    it('strips the id prefix from each card', async () => {
      const page = fakePage({
        $$eval: vi.fn().mockResolvedValue(['record-card-1', 'record-card-2']),
      });
      await expect(
        service.extractRecordIds(page, 'logged-in'),
      ).resolves.toEqual(['1', '2']);
    });
    it('returns an empty list when the listing container never appears', async () => {
      const page = fakePage({
        waitForSelector: vi.fn().mockRejectedValue(new Error('timeout')),
      });
      await expect(
        service.extractRecordIds(page, 'logged-in'),
      ).resolves.toEqual([]);
      expect(page.$$eval).not.toHaveBeenCalled();
    });
    it('ignores cards whose id does not match the expected prefix', async () => {
      const page = fakePage({
        $$eval: vi
          .fn()
          .mockResolvedValue(['', 'something-else', 'record-card-9']),
      });
      await expect(
        service.extractRecordIds(page, 'logged-in'),
      ).resolves.toEqual(['9']);
    });
    it('runs the real page-context $$eval callback against fake card elements, falling back to an empty string when the attribute is absent', async () => {
      const cards = [
        { getAttribute: () => 'record-card-1' },
        { getAttribute: () => null },
      ];
      const page = fakePage({
        $$eval: vi.fn(
          (
            _selector: string,
            fn: (elements: typeof cards, attribute: string) => string[],
            attribute: string,
          ) => Promise.resolve(fn(cards, attribute)),
        ),
      });
      await expect(
        service.extractRecordIds(page, 'logged-in'),
      ).resolves.toEqual(['1']);
    });
    it('uses the logged-out listing selectors in logged-out mode', async () => {
      const page = fakePage({
        $$eval: vi
          .fn()
          .mockResolvedValue(['entity:7', 'record-card-8', 'entity:9']),
      });
      await expect(
        service.extractRecordIds(page, 'logged-out'),
      ).resolves.toEqual(['7', '9']);
      expect(page.waitForSelector).toHaveBeenCalledWith('ol.entries', {
        timeout: 4000,
      });
      expect(page.$$eval).toHaveBeenCalledWith(
        'ol.entries [data-entity-key]',
        expect.any(Function),
        'data-entity-key',
      );
    });
  });
  describe('buildRecordDetailUrl', () => {
    it('builds the record view URL of the given mode from a record id', () => {
      expect(service.buildRecordDetailUrl('123', 'logged-out')).toBe(
        'https://example.com/123',
      );
      expect(service.buildRecordDetailUrl('123', 'logged-in')).toBe(
        'https://example.com/item/123',
      );
    });
  });
  describe('buildRecordDetailSelectors', () => {
    it('scopes each selector to the given record id', () => {
      expect(service.buildRecordDetailSelectors('123', 'logged-out')).toEqual({
        recordFeature: 'div[data-testid="feature-123"]',
        bodyContent: 'div[data-testid="body-123"]',
        sourceContent: 'div[data-testid="source-123"]',
      });
    });
  });
  describe('extractRecordDetail', () => {
    it('evaluates in the page context and parses the source name out of the raw sourceUrl', async () => {
      const page = fakePage({
        evaluate: vi.fn().mockResolvedValue({
          sectionFound: true,
          hasBodyContent: true,
          html: '<div>header</div><div>body content</div>',
          bodyContentText: 'body content',
          sourceUrl: 'https://example.com/source/source-beta/',
          sourceHtml: '<div>source content</div>',
          isExpired: false,
        }),
      });
      await expect(
        service.extractRecordDetail(page, '123', 'logged-out'),
      ).resolves.toEqual({
        sectionFound: true,
        hasBodyContent: true,
        html: '<!DOCTYPE html>\n<html>\n<body>\n<div>header</div><div>body content</div>\n</body>\n</html>\n',
        bodyContentText: 'body content',
        sourceName: 'source-beta',
        sourceUrl: 'https://example.com/source/source-beta/',
        sourceHtml:
          '<!DOCTYPE html>\n<html>\n<body>\n<div>source content</div>\n</body>\n</html>\n',
        isExpired: false,
      });
      expect(page.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          selectors: service.buildRecordDetailSelectors('123', 'logged-out'),
          headerSelector: 'div[data-testid="header"]',
          sectionSelector: 'section',
          sourceLinkSelector: null,
          expiredMarker: 'not available',
          partAttribute: 'data-lens-part',
          modeAttribute: 'data-lens-mode',
          mode: 'logged-out',
          captureInlineSource: true,
        }),
      );
    });
    it('drops the source url when it does not point at a source page', async () => {
      const page = fakePage({
        evaluate: vi.fn().mockResolvedValue({
          sectionFound: true,
          hasBodyContent: true,
          html: '<div>body</div>',
          bodyContentText: 'body',
          sourceUrl: 'https://example.com/elsewhere',
          sourceHtml: null,
          isExpired: false,
        }),
      });
      await expect(
        service.extractRecordDetail(page, '123', 'logged-out'),
      ).resolves.toMatchObject({ sourceName: null, sourceUrl: null });
    });
    it('reports a null sourceHtml when the source content section is absent', async () => {
      const page = fakePage({
        evaluate: vi.fn().mockResolvedValue({
          sectionFound: true,
          hasBodyContent: true,
          html: '<div>header</div><div>body content</div>',
          bodyContentText: 'body content',
          sourceUrl: 'https://example.com/source/source-alpha/',
          sourceHtml: null,
          isExpired: false,
        }),
      });
      await expect(
        service.extractRecordDetail(page, '123', 'logged-out'),
      ).resolves.toEqual({
        sectionFound: true,
        hasBodyContent: true,
        html: '<!DOCTYPE html>\n<html>\n<body>\n<div>header</div><div>body content</div>\n</body>\n</html>\n',
        bodyContentText: 'body content',
        sourceName: 'source-alpha',
        sourceUrl: 'https://example.com/source/source-alpha/',
        sourceHtml: null,
        isExpired: false,
      });
    });
    it('reports a null source name when the section is missing', async () => {
      const page = fakePage({
        evaluate: vi.fn().mockResolvedValue({
          sectionFound: false,
          hasBodyContent: false,
          html: null,
          bodyContentText: null,
          sourceUrl: null,
          sourceHtml: null,
          isExpired: false,
        }),
      });
      await expect(
        service.extractRecordDetail(page, '123', 'logged-out'),
      ).resolves.toEqual({
        sectionFound: false,
        hasBodyContent: false,
        html: null,
        bodyContentText: null,
        sourceName: null,
        sourceUrl: null,
        sourceHtml: null,
        isExpired: false,
      });
    });
    it('passes through isExpired from the raw evaluate result', async () => {
      const page = fakePage({
        evaluate: vi.fn().mockResolvedValue({
          sectionFound: true,
          hasBodyContent: true,
          html: '<div>header</div><div>body content</div>',
          bodyContentText: 'body content',
          sourceUrl: 'https://example.com/source/source-alpha/',
          sourceHtml: '<div>source content</div>',
          isExpired: true,
        }),
      });
      await expect(
        service.extractRecordDetail(page, '123', 'logged-out'),
      ).resolves.toMatchObject({ isExpired: true });
    });
    describe('the real page-context evaluate callback (run against a fake DOM)', () => {
      it('extracts header, feature and body html, sanitizing stripped attributes and elements, marking each part, and detects the expired marker', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><h1>Widget Alpha</h1> Header info not available</div>
            <div data-testid="feature-123">Feature content</div>
            <div data-testid="body-123" class="foo"><script>bad()</script><span class="nested">Body content text</span></div>
            <div data-testid="source-123" class="bar"><a href="https://example.com/source/source-beta/?ref=1">Source Beta</a> Source content text</div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sectionFound).toBe(true);
        expect(result.hasBodyContent).toBe(true);
        expect(result.bodyContentText).toContain('Body content text');
        expect(result.isExpired).toBe(true);
        expect(result.sourceName).toBe('source-beta');
        expect(result.sourceUrl).toBe(
          'https://example.com/source/source-beta/?ref=1',
        );
        expect(result.html).toMatch(
          /<div [^>]*data-lens-part="header"[^>]*><h1>Widget Alpha<\/h1>/,
        );
        expect(result.html).toContain('data-lens-part="feature"');
        expect(result.html).toContain('data-lens-part="body"');
        expect(result.html).toContain('Feature content');
        expect(result.html).not.toContain('<script>');
        expect(result.html).not.toContain('class=');
        expect(result.sourceHtml).toContain('Source content text');
        expect(result.sourceHtml).not.toContain('class=');
        expect(result.sourceHtml).not.toContain('data-lens-part');
      });
      it('stamps every part with the session mode it was scraped in', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><h1>Widget Alpha</h1></div>
            <div data-testid="body-123">Body text</div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        const { document } = parseHTML(result.html!);
        const modes = Array.from(
          document.querySelectorAll('[data-lens-part]'),
        ).map((el) => [
          el.getAttribute('data-lens-part'),
          el.getAttribute('data-lens-mode'),
        ]);
        expect(modes).toEqual([
          ['header', 'logged-out'],
          ['body', 'logged-out'],
        ]);
      });
      it('reads the source url from the configured source link selector while still capturing the source element inline', async () => {
        const linkService = new SiteService(
          fakeSiteConfig({
            loggedInDetail: {
              sourceLinkSelector: 'div[data-testid="header"] a',
            },
          }),
        );
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><a href="https://example.com/source/source-delta/">Delta</a><p>Widget Alpha</p></div>
            <div data-testid="body-123">Body text</div>
            <div data-testid="source-123"><a href="https://example.com/elsewhere">Other</a> About the source</div>
          </section>
        `);
        const result = await linkService.extractRecordDetail(
          page,
          '123',
          'logged-in',
        );
        expect(result.sourceName).toBe('source-delta');
        expect(result.sourceUrl).toBe(
          'https://example.com/source/source-delta/',
        );
        expect(result.sourceHtml).toContain('About the source');
        expect(result.html).toContain('data-lens-mode="logged-in"');
      });
      it('falls back to a null source url when the source link selector matches nothing', async () => {
        const linkService = new SiteService(
          fakeSiteConfig({
            loggedInDetail: { sourceLinkSelector: 'a.missing' },
          }),
        );
        const page = evaluatingPage(`
          <section>
            <div data-testid="body-123">Body text</div>
            <div data-testid="source-123"><a href="https://example.com/source/source-beta/">Beta</a></div>
          </section>
        `);
        const result = await linkService.extractRecordDetail(
          page,
          '123',
          'logged-in',
        );
        expect(result.sourceUrl).toBeNull();
        expect(result.sourceName).toBeNull();
      });
      it('reads the source url straight from the source element when it is itself an anchor', async () => {
        const anchorService = new SiteService(
          fakeSiteConfig({
            detail: {
              featureSelector: 'div.feature',
              bodySelectorTemplate: 'div.body',
              sourceSelectorTemplate: 'a.source',
            },
          }),
        );
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><h1>Widget Alpha</h1><a class="source" href="https://example.com/source/source-gamma?ref=x">Gamma</a></div>
            <div class="body">Body text</div>
          </section>
        `);
        const result = await anchorService.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sourceName).toBe('source-gamma');
        expect(result.sourceUrl).toBe(
          'https://example.com/source/source-gamma?ref=x',
        );
        expect(result.sourceHtml).toContain('Gamma');
      });
      it('does not capture the source element inline when the source content lives on its own detail page', async () => {
        const followingService = new SiteService(
          fakeSiteConfig({
            detail: { sourceDetailSelector: 'section.detail' },
          }),
        );
        const page = evaluatingPage(`
          <section>
            <div data-testid="body-123">Body text</div>
            <div data-testid="source-123"><a href="https://example.com/source/source-beta">Source Beta</a></div>
          </section>
        `);
        const result = await followingService.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sourceName).toBe('source-beta');
        expect(result.sourceUrl).toBe('https://example.com/source/source-beta');
        expect(result.sourceHtml).toBeNull();
      });
      it('reports sectionFound=false when the section selector matches nothing', async () => {
        const page = evaluatingPage('<div>no section here</div>');
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result).toMatchObject({
          sectionFound: false,
          hasBodyContent: false,
          html: null,
        });
      });
      it('reports sectionFound=false when the section is present but empty', async () => {
        const page = evaluatingPage('<section></section>');
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sectionFound).toBe(false);
      });
      it('falls back to null header, sourceUrl and isExpired=false when the header is absent', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="feature-123">Feature</div>
            <div data-testid="body-123">Body text</div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sectionFound).toBe(true);
        expect(result.isExpired).toBe(false);
        expect(result.sourceName).toBeNull();
        expect(result.html).not.toContain('undefined');
      });
      it('falls back to a null sourceUrl when the source element has no anchor', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><a href="https://example.com/source/source-beta/">Not the source element</a></div>
            <div data-testid="body-123">Body text</div>
            <div data-testid="source-123">Source text without a link</div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sourceName).toBeNull();
        expect(result.sourceUrl).toBeNull();
      });
      it('reports hasBodyContent=false and a null bodyContentText when the body selector matches nothing', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="header"><h1>Widget Alpha</h1></div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.hasBodyContent).toBe(false);
        expect(result.bodyContentText).toBeNull();
      });
      it('reports a null sourceHtml when the source content is present but blank', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="body-123">Body text</div>
            <div data-testid="source-123">   </div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sourceHtml).toBeNull();
      });
      it('reports a null sourceHtml when there is no source content element at all', async () => {
        const page = evaluatingPage(`
          <section>
            <div data-testid="body-123">Body text</div>
          </section>
        `);
        const result = await service.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.sourceHtml).toBeNull();
      });
      it('leaves html untouched when there are no elements to strip (stripElements empty)', async () => {
        const bareService = new SiteService(
          fakeSiteConfig({ overrides: { sanitizeStripElements: [] } }),
        );
        const page = evaluatingPage(`
          <section>
            <div data-testid="body-123"><script>keep()</script>Body text</div>
          </section>
        `);
        const result = await bareService.extractRecordDetail(
          page,
          '123',
          'logged-out',
        );
        expect(result.html).toContain('<script>');
      });
    });
  });
  describe('extractSourceDetail', () => {
    function sourceDetailService(
      overrides: Partial<Record<keyof SiteConfigService, unknown>> = {},
    ): SiteService {
      return new SiteService(
        fakeSiteConfig({
          detail: { sourceDetailSelector: 'section[data-testid="detail"]' },
          overrides: { sanitizeStripElements: ['script', 'img'], ...overrides },
        }),
      );
    }
    it('returns null without touching the page when no source detail selector is configured', async () => {
      const page = fakePage();
      await expect(
        service.extractSourceDetail(page, 'logged-out'),
      ).resolves.toBeNull();
      expect(page.waitForSelector).not.toHaveBeenCalled();
    });
    it('waits for the source detail element with the configured timeout and returns it sanitized as a document', async () => {
      const page = fakePage({
        $eval: vi
          .fn()
          .mockResolvedValue(
            '<section data-testid="detail" class="x"><h2 class="y">Detail</h2><img src="a.png"><script>bad()</script><p>Source text</p></section>',
          ),
      });
      const html = await sourceDetailService().extractSourceDetail(
        page,
        'logged-out',
      );
      expect(page.waitForSelector).toHaveBeenCalledWith(
        'section[data-testid="detail"]',
        { timeout: 5000 },
      );
      expect(html).toBe(
        '<!DOCTYPE html>\n<html>\n<body>\n<section data-testid="detail"><h2>Detail</h2><p>Source text</p></section>\n</body>\n</html>\n',
      );
    });
    it('runs the real page-context $eval callback to read the element outer html', async () => {
      const page = fakePage({
        $eval: vi.fn(
          (_selector: string, fn: (el: { outerHTML: string }) => string) =>
            Promise.resolve(
              fn({ outerHTML: '<section>Source text</section>' }),
            ),
        ),
      });
      await expect(
        sourceDetailService().extractSourceDetail(page, 'logged-out'),
      ).resolves.toContain('<section>Source text</section>');
    });
    it('returns null when the source detail element never appears', async () => {
      const page = fakePage({
        waitForSelector: vi.fn().mockRejectedValue(new Error('timeout')),
      });
      await expect(
        sourceDetailService().extractSourceDetail(page, 'logged-out'),
      ).resolves.toBeNull();
      expect(page.$eval).not.toHaveBeenCalled();
    });
    it('returns null when the source detail element has no text', async () => {
      const page = fakePage({
        $eval: vi.fn().mockResolvedValue('<section>   </section>'),
      });
      await expect(
        sourceDetailService().extractSourceDetail(page, 'logged-out'),
      ).resolves.toBeNull();
    });
    it('keeps every element when there is nothing to strip', async () => {
      const page = fakePage({
        $eval: vi
          .fn()
          .mockResolvedValue('<section><script>keep()</script>Text</section>'),
      });
      await expect(
        sourceDetailService({ sanitizeStripElements: [] }).extractSourceDetail(
          page,
          'logged-out',
        ),
      ).resolves.toContain('<script>keep()</script>');
    });
  });
  describe('extractBodyContentTextFromHtml', () => {
    it('parses the html and returns the body content text, scoped to the given record id', () => {
      expect(
        service.extractBodyContentTextFromHtml(
          '<div data-testid="body-123">Recently updated</div>',
          '123',
        ),
      ).toBe('Recently updated');
    });
    it('prefers the element marked as the body part over the configured selector', () => {
      expect(
        service.extractBodyContentTextFromHtml(
          '<section data-lens-part="body">Marked body</section><div data-testid="body-123">Other</div>',
          '123',
        ),
      ).toBe('Marked body');
    });
    it('returns null when the selector matches nothing', () => {
      expect(
        service.extractBodyContentTextFromHtml('<div></div>', '123'),
      ).toBeNull();
    });
    it('inserts a newline before a nested block element that follows other text, skips it before the first child, and ignores non-element/text nodes (e.g. comments)', () => {
      const html =
        '<div data-testid="body-123"><p>First</p>Middle text<p>Second</p><span>Inline</span><!--c--></div>';
      expect(service.extractBodyContentTextFromHtml(html, '123')).toBe(
        'FirstMiddle text\nSecondInline',
      );
    });
  });
  describe('extractRecordTitleFromHtml', () => {
    function asDocument(bodyContent: string): string {
      return `<!DOCTYPE html>\n<html>\n<body>\n${bodyContent}\n</body>\n</html>\n`;
    }
    it('strips anchors and returns the first non-empty paragraph text', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument('<div><a>x</a><p>Widget Alpha</p></div>'),
        ),
      ).toBe('widget alpha');
    });
    it('skips leading empty paragraphs to find the first non-empty one', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument('<div><p>   </p><p>Widget Alpha</p></div>'),
        ),
      ).toBe('widget alpha');
    });
    it('preserves non-collapsible Unicode whitespace (e.g. narrow no-break space)', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument('<div><p>Widget – Alpha</p></div>'),
        ),
      ).toBe('widget – alpha');
    });
    it('lowercases the extracted title without touching the source html', () => {
      const html = asDocument('<div><p>WIDGET Alpha</p></div>');
      expect(service.extractRecordTitleFromHtml(html)).toBe('widget alpha');
      expect(html).toContain('WIDGET Alpha');
    });
    it('returns null when there is no top-level header div', () => {
      expect(
        service.extractRecordTitleFromHtml(asDocument('no wrapper')),
      ).toBeNull();
    });
    it('returns null when the header has no non-empty paragraph', () => {
      expect(
        service.extractRecordTitleFromHtml(asDocument('<div><p>   </p></div>')),
      ).toBeNull();
    });
    it('reads the title from the element marked as the header part with no mode, combining the title selectors of both modes', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument(
            '<section data-lens-part="header"><a><p>Source Beta</p></a><h1>Widget Gamma</h1><p>Elsewhere</p></section><section data-lens-part="body"><p>Body</p></section>',
          ),
        ),
      ).toBe('widget gamma');
    });
    it('uses the title selector of the session mode stamped on the header part', () => {
      const header = (mode: string): string =>
        asDocument(
          `<section data-lens-part="header" data-lens-mode="${mode}"><h1>Heading</h1><p>Paragraph</p></section>`,
        );
      expect(service.extractRecordTitleFromHtml(header('logged-in'))).toBe(
        'paragraph',
      );
      expect(service.extractRecordTitleFromHtml(header('logged-out'))).toBe(
        'heading',
      );
    });
    it('uses the logged-in title selector for files saved before parts were marked', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument('<div><h1>Heading</h1><p>Paragraph</p></div>'),
        ),
      ).toBe('paragraph');
    });
    it('returns null when parts are marked but none of them is the header', () => {
      expect(
        service.extractRecordTitleFromHtml(
          asDocument('<div data-lens-part="body"><p>Body text</p></div>'),
        ),
      ).toBeNull();
    });
  });
  describe('parseSourceNameFromHref', () => {
    it('extracts the name segment right after /source/', () => {
      expect(
        service.parseSourceNameFromHref(
          'https://example.com/source/source-beta/list',
        ),
      ).toBe('source-beta');
    });
    it('extracts the name when the href has no trailing path', () => {
      expect(
        service.parseSourceNameFromHref(
          'https://example.com/source/source-alpha',
        ),
      ).toBe('source-alpha');
    });
    it('returns null for hrefs that are not source page links', () => {
      expect(
        service.parseSourceNameFromHref('https://example.com/123'),
      ).toBeNull();
    });
    it('ignores the query string and fragment of the href', () => {
      expect(
        service.parseSourceNameFromHref(
          'https://example.com/source/source-beta?ref=abc#top',
        ),
      ).toBe('source-beta');
    });
    it('returns null for an href that is not a valid absolute url', () => {
      expect(service.parseSourceNameFromHref('/source/source-beta')).toBeNull();
    });
    it('returns null for null or undefined input', () => {
      expect(service.parseSourceNameFromHref(null)).toBeNull();
      expect(service.parseSourceNameFromHref(undefined)).toBeNull();
    });
    it('returns null when the href is exactly the source prefix with no name segment', () => {
      expect(
        service.parseSourceNameFromHref('https://example.com/source/'),
      ).toBeNull();
    });
  });
});
