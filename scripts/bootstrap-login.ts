import * as readline from 'node:readline/promises';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ConfigModule, ConfigService } from '@app/config';
import { BrowserService } from '@app/browser';
import { SiteConfigService } from '@app/site';
@Module({ imports: [ConfigModule] })
class BootstrapLoginModule {}
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BootstrapLoginModule);
  try {
    const configService = new ConfigService(app.get(NestConfigService));
    if (!configService.siteRequiresLogin) {
      console.log(
        'SITE_REQUIRES_LOGIN=false — this site does not require login, skipping bootstrap.',
      );
      return;
    }
    const siteConfigService = new SiteConfigService(configService);
    const loginUrl = siteConfigService.loginUrl;
    if (!loginUrl) {
      throw new Error(
        'SITE_REQUIRES_LOGIN=true but the site config has no auth.loginUrl configured.',
      );
    }
    const browserService = new BrowserService(configService);
    const page = await browserService.newPage({ headless: false });
    await page.goto(loginUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    await rl.question(
      '\nLog in manually in the Chromium window that just opened.\n' +
        'Once the page has loaded, come back here and press Enter... ',
    );
    rl.close();
    await browserService.closeContext();
    console.log(
      'Session saved to the persistent profile. Login bootstrap complete.',
    );
  } finally {
    await app.close();
  }
}
await main();
