import { Injectable, Logger } from '@nestjs/common';
import { Node as LinkedomNode, parseHTML } from 'linkedom';
import type { Page } from 'playwright';
import type { BrowserContextKind } from '@app/browser';
import {
  SiteConfigService,
  type RecordDetailSelectors,
} from './site-config.service.js';
export type { RecordDetailSelectors } from './site-config.service.js';
export interface RecordDetailExtractionResult {
  sectionFound: boolean;
  hasBodyContent: boolean;
  html: string | null;
  bodyContentText: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceHtml: string | null;
  isExpired: boolean;
}
export const RECORD_PART_ATTRIBUTE = 'data-lens-part';
function wrapAsHtmlDocument(bodyContent: string): string {
  return `<!DOCTYPE html>\n<html>\n<body>\n${bodyContent}\n</body>\n</html>\n`;
}
function sanitizeElement(
  root: Element,
  stripElements: string[],
  stripAttributes: string[],
): void {
  if (stripElements.length > 0) {
    root
      .querySelectorAll(stripElements.join(', '))
      .forEach((el) => el.remove());
  }
  for (const attribute of stripAttributes) {
    root.removeAttribute(attribute);
    root
      .querySelectorAll(`[${attribute}]`)
      .forEach((el) => el.removeAttribute(attribute));
  }
}
const BLOCK_ELEMENT_TAGS = new Set([
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BODY',
  'BR',
  'BUTTON',
  'CANVAS',
  'CAPTION',
  'COL',
  'COLGROUP',
  'DD',
  'DIV',
  'DL',
  'DT',
  'EMBED',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'UL',
  'OL',
  'P',
]);

function innerTextOf(el: Element): string {
  const parts: string[] = [];
  const collect = (node: Element): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === LinkedomNode.TEXT_NODE) {
        parts.push(child.textContent!.replace(/[ \t\n\r\f]+/g, ' '));
      } else if (child.nodeType === LinkedomNode.ELEMENT_NODE) {
        const childEl = child as Element;
        if (parts.length && BLOCK_ELEMENT_TAGS.has(childEl.tagName)) {
          parts.push('\n');
        }
        collect(childEl);
      }
    }
  };
  collect(el);
  return parts.join('');
}
/* v8 ignore start */
@Injectable()
/* v8 ignore stop */
export class SiteService {
  private readonly logger = new Logger(SiteService.name);
  constructor(private readonly siteConfig: SiteConfigService) {}
  get listingPageSize(): number {
    return this.siteConfig.listingPageSize;
  }
  get listingBrowserContext(): BrowserContextKind {
    return this.siteConfig.listingBrowserContext;
  }
  get listingScrollFocusSelector(): string {
    return this.siteConfig.listingScrollFocusSelector;
  }
  get recordDetailBrowserContext(): BrowserContextKind {
    return this.siteConfig.recordDetailBrowserContext;
  }
  get recordDetailScrollFocusSelector(): string {
    return this.siteConfig.recordDetailScrollFocusSelector;
  }
  get hasSourceDetailPage(): boolean {
    return Boolean(this.siteConfig.sourceDetailSelector);
  }
  parseSourceNameFromHref(href: string | null | undefined): string | null {
    if (!href) {
      return null;
    }
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    const prefix = this.siteConfig.sourceUrlPrefix;
    const withoutQuery = `${url.origin}${url.pathname}`;
    if (!withoutQuery.startsWith(prefix)) {
      return null;
    }
    const name = withoutQuery.slice(prefix.length).split('/')[0];
    return name || null;
  }
  buildListingPageUrl(baseUrl: string, start: number): string {
    const url = new URL(baseUrl);
    url.searchParams.set('start', String(start));
    return url.toString();
  }
  async extractRecordIds(page: Page): Promise<string[]> {
    try {
      await page.waitForSelector(this.siteConfig.listingContainerSelector, {
        timeout: this.siteConfig.listingContainerTimeoutMs,
      });
    } catch {
      this.logger.debug(
        'Listing container did not appear in time; treating page as empty.',
      );
      return [];
    }
    const cardSelector = this.siteConfig.recordCardSelector;
    const cardIdAttribute = this.siteConfig.recordCardIdAttribute;
    const rawCardIds = await page.$$eval(
      cardSelector,
      (cards, attribute) =>
        cards.map((card) => card.getAttribute(attribute) ?? ''),
      cardIdAttribute,
    );
    const prefix = this.siteConfig.recordCardIdPrefix;
    return rawCardIds
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .filter(Boolean);
  }
  buildRecordDetailUrl(recordId: string): string {
    return this.siteConfig.buildRecordDetailUrl(recordId);
  }
  isRecordDetailUrl(url: string, recordId: string): boolean {
    try {
      const expectedPath = new URL(this.buildRecordDetailUrl(recordId))
        .pathname;
      return new URL(url).pathname.startsWith(expectedPath);
    } catch {
      return false;
    }
  }
  buildRecordDetailSelectors(recordId: string): RecordDetailSelectors {
    return this.siteConfig.buildRecordDetailSelectors(recordId);
  }
  async extractRecordDetail(
    page: Page,
    recordId: string,
  ): Promise<RecordDetailExtractionResult> {
    const selectors = this.buildRecordDetailSelectors(recordId);
    const raw = await page.evaluate(
      ({
        selectors,
        headerSelector,
        sectionSelector,
        expiredMarker,
        stripAttributes,
        stripElements,
        partAttribute,
        captureInlineSource,
      }) => {
        const section = document.querySelector(sectionSelector);
        if (!section || !section.innerHTML.trim()) {
          return {
            sectionFound: false,
            hasBodyContent: false,
            html: null,
            bodyContentText: null,
            sourceUrl: null,
            sourceHtml: null,
            isExpired: false,
          };
        }
        const sanitize = (root: Element): void => {
          if (stripElements.length > 0) {
            root
              .querySelectorAll(stripElements.join(', '))
              .forEach((el) => el.remove());
          }
          for (const attribute of stripAttributes) {
            root.removeAttribute(attribute);
            root
              .querySelectorAll(`[${attribute}]`)
              .forEach((el) => el.removeAttribute(attribute));
          }
        };
        const cloneSanitized = (el: Element, part?: string): string => {
          const clone = el.cloneNode(true) as Element;
          sanitize(clone);
          if (part) {
            clone.setAttribute(partAttribute, part);
          }
          return clone.outerHTML;
        };
        const header = section.querySelector(headerSelector);
        const recordFeature = section.querySelector(selectors.recordFeature);
        const bodyContent = section.querySelector(selectors.bodyContent);
        const sourceContent = section.querySelector(selectors.sourceContent);
        const hasBodyContent = Boolean(bodyContent?.textContent?.trim());
        const bodyContentText =
          (bodyContent as HTMLElement | null)?.innerText ?? null;
        const sourceAnchor = sourceContent?.matches('a')
          ? sourceContent
          : (sourceContent?.querySelector('a') ?? null);
        const sourceUrl =
          (sourceAnchor as HTMLAnchorElement | null)?.href ?? null;
        const parts: [Element | null, string][] = [
          [header, 'header'],
          [recordFeature, 'feature'],
          [bodyContent, 'body'],
        ];
        const html = parts
          .filter((entry): entry is [Element, string] => entry[0] !== null)
          .map(([el, part]) => cloneSanitized(el, part))
          .join('');
        const sourceContentText = (
          sourceContent as HTMLElement | null
        )?.innerText?.trim();
        const sourceHtml =
          captureInlineSource && sourceContent && sourceContentText
            ? cloneSanitized(sourceContent)
            : null;
        const headerText = (header as HTMLElement | null)?.innerText ?? '';
        const isExpired = headerText.includes(expiredMarker);
        return {
          sectionFound: true,
          hasBodyContent,
          html,
          bodyContentText,
          sourceUrl,
          sourceHtml,
          isExpired,
        };
      },
      {
        selectors,
        headerSelector: this.siteConfig.recordDetailHeaderSelector,
        sectionSelector: this.siteConfig.recordDetailSectionSelector,
        expiredMarker: this.siteConfig.expiredRecordMarker,
        stripAttributes: this.siteConfig.sanitizeStripAttributes,
        stripElements: this.siteConfig.sanitizeStripElements,
        partAttribute: RECORD_PART_ATTRIBUTE,
        captureInlineSource: !this.hasSourceDetailPage,
      },
    );
    const sourceName = this.parseSourceNameFromHref(raw.sourceUrl);
    return {
      sectionFound: raw.sectionFound,
      hasBodyContent: raw.hasBodyContent,
      html: raw.html !== null ? wrapAsHtmlDocument(raw.html) : null,
      bodyContentText: raw.bodyContentText,
      sourceName,
      sourceUrl: sourceName ? raw.sourceUrl : null,
      isExpired: raw.isExpired,
      sourceHtml:
        raw.sourceHtml !== null ? wrapAsHtmlDocument(raw.sourceHtml) : null,
    };
  }
  async extractSourceDetail(page: Page): Promise<string | null> {
    const selector = this.siteConfig.sourceDetailSelector;
    if (!selector) {
      return null;
    }
    try {
      await page.waitForSelector(selector, {
        timeout: this.siteConfig.sourceDetailTimeoutMs,
      });
    } catch {
      this.logger.debug(
        'Source detail element did not appear in time; treating it as missing.',
      );
      return null;
    }
    const rawHtml = await page.$eval(selector, (el) => el.outerHTML);
    const { document } = parseHTML(wrapAsHtmlDocument(rawHtml));
    const element = document.body.firstElementChild;
    if (!element || !innerTextOf(element).trim()) {
      return null;
    }
    sanitizeElement(
      element,
      this.siteConfig.sanitizeStripElements,
      this.siteConfig.sanitizeStripAttributes,
    );
    return wrapAsHtmlDocument(element.outerHTML);
  }
  extractBodyContentTextFromHtml(
    html: string,
    recordId: string,
  ): string | null {
    const { document } = parseHTML(html);
    const selector = this.buildRecordDetailSelectors(recordId).bodyContent;
    const element =
      document.querySelector(`[${RECORD_PART_ATTRIBUTE}="body"]`) ??
      document.querySelector(selector);
    return element ? innerTextOf(element) : null;
  }
  extractRecordTitleFromHtml(html: string): string | null {
    const { document } = parseHTML(html);
    const header = document.querySelector(`[${RECORD_PART_ATTRIBUTE}]`)
      ? document.querySelector(`[${RECORD_PART_ATTRIBUTE}="header"]`)
      : document.body.querySelector(':scope > div');
    if (!header) {
      return null;
    }
    header.querySelectorAll('a').forEach((anchor) => anchor.remove());
    const titleElement = Array.from(
      header.querySelectorAll(this.siteConfig.recordTitleSelector),
    ).find((el) => innerTextOf(el).trim().length > 0);
    const title = (titleElement ? innerTextOf(titleElement) : '')
      .trim()
      .toLowerCase();
    return title || null;
  }
}
