import { ProjectMemory } from '../memory/projectMemory';

export interface TestSuite {
  id: string;
  name: string;
  files: Record<string, string>;
}

export class TestGenerator {
  static generatePlaywrightConfig(): string {
    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
`;
  }

  static generateBasicTest(): string {
    return `import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  // Basic check to ensure the page rendered something
  await expect(page.locator('body')).toBeVisible();
  
  // Check for any obvious console errors
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  
  // Wait a bit to ensure no immediate hydration errors
  await page.waitForTimeout(1000);
  expect(errors.length).toBe(0);
});
`;
  }

  static generateNavigationTest(routes: string[]): string {
    const routeTests = routes.map(route => `
test('route ${route} loads without 404', async ({ page }) => {
  const response = await page.goto('${route === '/app/page.tsx' ? '/' : route.replace('.tsx', '').replace('.jsx', '')}');
  expect(response?.status()).toBeLessThan(400);
});`).join('\n');

    return `import { test, expect } from '@playwright/test';
${routeTests}
`;
  }

  static generateApiTest(apiRoutes: string[]): string {
    const apiTests = apiRoutes.map(route => `
test('API ${route} returns valid response', async ({ request }) => {
  const response = await request.get('${route.replace('/app', '').replace('/route.ts', '').replace('/route.js', '')}');
  expect(response.ok()).toBeTruthy();
});`).join('\n');

    return `import { test, expect } from '@playwright/test';
${apiTests}
`;
  }

  static generateTestSuite(currentFiles: Record<string, string>): TestSuite {
    const memory = ProjectMemory.getMemory();
    
    const routes = memory.items.filter(i => i.type === 'route').map(i => i.source_file || '');
    const apis = memory.items.filter(i => i.type === 'api').map(i => i.source_file || '');

    const generatedFiles: Record<string, string> = {
      '/playwright.config.ts': this.generatePlaywrightConfig(),
      '/tests/e2e/basic.spec.ts': this.generateBasicTest(),
    };

    if (routes.length > 0) {
      generatedFiles['/tests/e2e/navigation.spec.ts'] = this.generateNavigationTest(routes);
    }

    if (apis.length > 0) {
      generatedFiles['/tests/e2e/api.spec.ts'] = this.generateApiTest(apis);
    }

    return {
      id: ProjectMemory.generateUUID(),
      name: 'E2E Regression Suite',
      files: generatedFiles
    };
  }
}
