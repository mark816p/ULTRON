import { NextResponse } from 'next/server';

async function checkPlaywright() {
  try {
    const playwright = await import('playwright');
    return playwright;
  } catch (e) {
    return null;
  }
}

export async function GET(request: Request) {
  const playwright = await checkPlaywright();
  if (playwright) {
    return NextResponse.json({ 
      available: true, 
      browsers: ['chromium', 'firefox', 'webkit'],
      hint: 'Playwright is installed and ready to use.'
    });
  } else {
    return NextResponse.json({
      available: false,
      browsers: [],
      hint: 'Playwright not found. Install it to use full browser automation.',
      installCommand: 'npx playwright install chromium'
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, url, selector, text, goal, query } = body;

  const playwright = await checkPlaywright();

  if (!playwright) {
    // Fallbacks
    if (action === 'search-web' && query) {
      // Basic fetch fallback
      try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        const html = await res.text();
        return NextResponse.json({ success: true, fallback: true, htmlSnippet: html.substring(0, 1000) });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      installed: false, 
      installCommand: 'npm i playwright && npx playwright install chromium',
      error: 'Playwright is not installed.'
    }, { status: 501 });
  }

  try {
    switch (action) {
      case 'execute-goal': {
        const plan = `Plan to achieve: ${goal}\n1. Analyze requirements\n2. Navigate\n3. Interact`;
        return NextResponse.json({ success: true, plan, status: 'Simulated execution for safety in API.' });
      }
      
      case 'search-web': {
        const browser = await playwright.chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query || '')}`);
        await page.waitForLoadState('networkidle');
        const results = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[data-testid="result-title-a"]')).slice(0, 5).map(a => ({
            title: (a as HTMLElement).innerText,
            href: (a as HTMLAnchorElement).href
          }));
        });
        await browser.close();
        return NextResponse.json({ success: true, results });
      }

      default:
        return NextResponse.json({ success: false, message: 'Action not fully implemented in API yet' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
