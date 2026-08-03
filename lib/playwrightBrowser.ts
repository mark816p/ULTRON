import * as fs from "fs";
import * as path from "path";

// Try to import playwright dynamically
let playwright: any = null;
try {
  playwright = require("playwright");
} catch (e) {
  // Playwright not installed
}

export class PlaywrightBrowser {
  private browser: any = null;
  private page: any = null;

  public isInstalled(): boolean {
    return !!playwright;
  }

  public async install(): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require("child_process");
      exec("npx playwright install chromium --with-deps", (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          playwright = require("playwright");
          resolve(stdout);
        } catch (e) {
          reject(new Error("Installed but failed to require playwright."));
        }
      });
    });
  }

  public async launch(): Promise<void> {
    if (!this.isInstalled()) {
      throw new Error("Playwright is not installed. Call install() first or provide install instructions.");
    }
    if (!this.browser) {
      this.browser = await playwright.chromium.launch({ headless: true });
    }
    if (!this.page) {
      this.page = await this.browser.newPage();
    }
  }

  public async navigate(url: string): Promise<void> {
    if (!this.page) await this.launch();
    await this.page.goto(url, { waitUntil: "networkidle" });
  }

  public async screenshot(): Promise<string> {
    if (!this.page) throw new Error("Browser not launched");
    const buffer = await this.page.screenshot({ type: "jpeg", quality: 50 });
    return buffer.toString("base64");
  }

  public async click(selector: string): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.click(selector);
  }

  public async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Browser not launched");
    await this.page.fill(selector, text);
  }

  public async extract(selector: string): Promise<string> {
    if (!this.page) throw new Error("Browser not launched");
    return await this.page.textContent(selector);
  }

  public async getPageContent(): Promise<string> {
    if (!this.page && !this.isInstalled()) {
      // Fallback
      return "Playwright not available. Fallback disabled for getPageContent without URL.";
    }
    if (!this.page) throw new Error("Browser not launched");
    
    // Evaluate script to get clean text
    const text = await this.page.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      // Remove scripts and styles
      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript, svg").forEach(el => el.remove());
      return clone.innerText;
    });
    return text.substring(0, 10000); // Limit size
  }

  public async searchGoogle(query: string): Promise<string[]> {
    if (this.isInstalled()) {
      await this.navigate(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
      // Simple extraction of result titles
      const titles = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll("h3")).map(h => h.textContent).filter(Boolean) as string[];
      });
      return titles.slice(0, 5);
    } else {
      // Fallback
      return ["Playwright is not installed. Please run 'npx playwright install chromium --with-deps'."];
    }
  }

  public async searchDuckDuckGo(query: string): Promise<string[]> {
    if (this.isInstalled()) {
      await this.navigate(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      const titles = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll(".result__title")).map(a => a.textContent?.trim()).filter(Boolean) as string[];
      });
      return titles.slice(0, 5);
    } else {
      // Fallback
      try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
        const html = await res.text();
        const matches = html.match(/<a class="result__url" href="[^"]+">([^<]+)<\/a>/g);
        if (matches) {
          return matches.map(m => m.replace(/<[^>]+>/g, "").trim()).slice(0, 5);
        }
        return ["No results found via fetch fallback."];
      } catch (e: any) {
        return [`Fetch fallback failed: ${e.message}`];
      }
    }
  }

  public async executeGoal(goal: string, currentUrl?: string): Promise<string> {
    if (!this.isInstalled()) {
      return "Cannot execute goal. Playwright not installed.";
    }
    if (currentUrl) {
      await this.navigate(currentUrl);
    }
    // Very simplified AI-assisted execution mock logic
    return `Goal "${goal}" simulated on ${this.page?.url() || "unknown URL"}. In a full implementation, this would use an LLM to decide on selectors and actions.`;
  }

  public async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const playwrightBrowser = new PlaywrightBrowser();
