import { assertSafeNavigationUrl } from './safe-navigation-url.js';
describe('assertSafeNavigationUrl', () => {
  it('allows an ordinary https URL', () => {
    expect(() =>
      assertSafeNavigationUrl('https://www.site.com/search?q=1'),
    ).not.toThrow();
  });
  it('allows an ordinary http URL', () => {
    expect(() => assertSafeNavigationUrl('http://www.site.com')).not.toThrow();
  });
  it('rejects an invalid URL', () => {
    expect(() => assertSafeNavigationUrl('not a url')).toThrow(
      'Refusing to navigate to an invalid URL',
    );
  });
  it.each([
    'file:///etc/passwd',
    'ftp://example.com/file',
    'javascript:alert(1)',
  ])('rejects the non-http(s) scheme %s', (url) => {
    expect(() => assertSafeNavigationUrl(url)).toThrow(
      'Refusing to navigate to a non-http(s) URL',
    );
  });
  it.each([
    'http://localhost',
    'http://LOCALHOST:8080',
    'http://sub.localhost',
  ])('rejects the loopback hostname %s', (url) => {
    expect(() => assertSafeNavigationUrl(url)).toThrow(
      'Refusing to navigate to a loopback host',
    );
  });
  it.each([
    'http://127.0.0.1',
    'http://127.0.0.1:9092',
    'http://10.0.0.5',
    'http://172.16.0.1',
    'http://172.31.255.255',
    'http://192.168.1.1',
    'http://169.254.169.254',
    'http://0.0.0.0',
  ])('rejects the private/loopback IPv4 address %s', (url) => {
    expect(() => assertSafeNavigationUrl(url)).toThrow(
      'Refusing to navigate to a private/loopback IP',
    );
  });
  it('allows a public IPv4 address', () => {
    expect(() => assertSafeNavigationUrl('http://8.8.8.8')).not.toThrow();
  });
  it.each(['http://[::1]', 'http://[fe80::1]', 'http://[fc00::1]'])(
    'rejects the private/loopback IPv6 address %s',
    (url) => {
      expect(() => assertSafeNavigationUrl(url)).toThrow(
        'Refusing to navigate to a private/loopback IP',
      );
    },
  );
  it('allows a public IPv6 address', () => {
    expect(() =>
      assertSafeNavigationUrl('http://[2001:4860:4860::8888]'),
    ).not.toThrow();
  });
  it('allows a non-loopback IPv6 address with an empty leading group (e.g. ::2)', () => {
    expect(() => assertSafeNavigationUrl('http://[::2]')).not.toThrow();
  });
  it('does not treat 172.32.x.x (outside the private range) as private', () => {
    expect(() => assertSafeNavigationUrl('http://172.32.0.1')).not.toThrow();
  });
});
