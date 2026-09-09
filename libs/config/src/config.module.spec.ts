describe('ConfigModule', () => {
  it('throws a descriptive error when environment variables fail validation', async () => {
    const original = process.env.BROWSER_HEADLESS;
    process.env.BROWSER_HEADLESS = 'not-a-boolean';
    let handler: ((reason: unknown) => void) | undefined;
    const caught = new Promise<unknown>((resolve) => {
      handler = resolve;
      process.once('unhandledRejection', handler);
    });
    try {
      await import('./config.module.js');
      const reason = await caught;
      expect(reason).toBeInstanceOf(Error);
      expect((reason as Error).message).toMatch(
        /Invalid environment variables/,
      );
    } finally {
      if (handler) {
        process.off('unhandledRejection', handler);
      }
      if (original === undefined) {
        delete process.env.BROWSER_HEADLESS;
      } else {
        process.env.BROWSER_HEADLESS = original;
      }
    }
  });
});
