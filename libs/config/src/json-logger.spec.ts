import { JsonLogger } from './json-logger.js';
describe('JsonLogger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });
  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });
  function lastEntry(
    spy: ReturnType<typeof vi.spyOn>,
  ): Record<string, unknown> {
    const written = spy.mock.calls.at(-1)?.[0] as string;
    return JSON.parse(written) as Record<string, unknown>;
  }
  it('writes log() as a JSON line on stdout with level, message and context', () => {
    new JsonLogger({ pretty: false }).log('hello', 'MyContext');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const entry = lastEntry(stdoutSpy);
    expect(entry).toMatchObject({
      level: 'log',
      message: 'hello',
      context: 'MyContext',
    });
    expect(typeof entry.timestamp).toBe('string');
  });
  it('writes error() to stderr, capturing both trace and context', () => {
    new JsonLogger({ pretty: false }).error(
      'boom',
      'stack trace here',
      'MyContext',
    );
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(lastEntry(stderrSpy)).toMatchObject({
      level: 'error',
      message: 'boom',
      trace: 'stack trace here',
      context: 'MyContext',
    });
  });
  it('omits trace when error() receives an undefined stack before the context (as Nest Logger pads it)', () => {
    new JsonLogger({ pretty: false }).error('boom', undefined, 'MyContext');
    const entry = lastEntry(stderrSpy);
    expect(entry).toMatchObject({ message: 'boom', context: 'MyContext' });
    expect(entry.trace).toBeUndefined();
  });
  it('omits context when no trailing string param is given', () => {
    new JsonLogger({ pretty: false }).warn('careful');
    expect(lastEntry(stdoutSpy).context).toBeUndefined();
  });
  it('serializes a non-string message to JSON', () => {
    new JsonLogger({ pretty: false }).debug(
      { recordId: '123' },
      'DetailScraper',
    );
    expect(lastEntry(stdoutSpy).message).toBe('{"recordId":"123"}');
  });
  it('writes verbose() as a JSON line on stdout', () => {
    new JsonLogger({ pretty: false }).verbose('chatty');
    expect(lastEntry(stdoutSpy)).toMatchObject({
      level: 'verbose',
      message: 'chatty',
    });
  });
  it('stringifies an Error message using its stack when present', () => {
    const error = new Error('boom');
    new JsonLogger({ pretty: false }).log(error);
    expect(lastEntry(stdoutSpy).message).toBe(error.stack);
  });
  it('falls back to the Error message when it has no stack', () => {
    const error = new Error('boom');
    error.stack = undefined;
    new JsonLogger({ pretty: false }).log(error);
    expect(lastEntry(stdoutSpy).message).toBe('boom');
  });
  it('falls back to String(message) when the message cannot be JSON-stringified', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    new JsonLogger({ pretty: false }).log(circular);
    expect(lastEntry(stdoutSpy).message).toBe(String(circular));
  });
  it('defaults to plain JSON when stdout is not a TTY', () => {
    new JsonLogger().log('hello');
    expect(() => lastEntry(stdoutSpy)).not.toThrow();
  });
  describe('pretty mode', () => {
    it('renders a colored one-liner instead of JSON', () => {
      new JsonLogger({ pretty: true }).log('hello', 'MyContext');
      const written = stdoutSpy.mock.calls.at(-1)?.[0] as string;
      expect(() => JSON.parse(written)).toThrow();
      expect(written).toContain('\x1b[');
      expect(written).toContain('LOG');
      expect(written).toContain('[MyContext]');
      expect(written).toContain('hello');
    });
    it('omits the [context] segment when no context is given', () => {
      new JsonLogger({ pretty: true }).warn('careful');
      const written = stdoutSpy.mock.calls.at(-1)?.[0] as string;
      expect(written).not.toMatch(/\[[A-Za-z]+\]/);
      expect(written).toContain('careful');
    });
    it('appends the trace on its own line for error()', () => {
      new JsonLogger({ pretty: true }).error(
        'boom',
        'stack trace here',
        'MyContext',
      );
      const written = stderrSpy.mock.calls.at(-1)?.[0] as string;
      expect(written).toContain('boom');
      expect(written).toContain('stack trace here');
    });
  });
});
