import { Router, Request, Response } from 'express';

const router = Router();

interface OGData {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    favicon?: string;
}

// Simple OG tag parser — no external deps needed
function parseOGTags(html: string, baseUrl: string): OGData {
    const result: OGData = { url: baseUrl };

    const getMeta = (property: string): string | undefined => {
        const patterns = [
            new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i'),
            new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
        ];
        for (const p of patterns) {
            const m = html.match(p);
            if (m?.[1]) return m[1].trim();
        }
        return undefined;
    };

    const getTitle = (): string | undefined => {
        const og = getMeta('title');
        if (og) return og;
        const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return m?.[1]?.trim();
    };

    result.title = getTitle();
    result.description = getMeta('description');
    result.image = getMeta('image');
    result.siteName = getMeta('site_name');

    // Extract favicon
    const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);

    if (iconMatch?.[1]) {
        const iconHref = iconMatch[1];
        if (iconHref.startsWith('http')) {
            result.favicon = iconHref;
        } else {
            const origin = new URL(baseUrl).origin;
            result.favicon = iconHref.startsWith('/') ? `${origin}${iconHref}` : `${origin}/${iconHref}`;
        }
    } else {
        result.favicon = `${new URL(baseUrl).origin}/favicon.ico`;
    }

    // Resolve relative og:image
    if (result.image && !result.image.startsWith('http')) {
        try {
            result.image = new URL(result.image, baseUrl).href;
        } catch {
            result.image = undefined;
        }
    }

    return result;
}

router.get('/', async (req: Request, res: Response) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'URL required' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ success: false, error: 'Invalid protocol' });
        }
    } catch {
        return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(parsedUrl.href, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NyxBot/1.0; +https://nyx-messenger.app)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'ru,en;q=0.9',
            },
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            // Not an HTML page — return minimal data
            return res.json({
                success: true,
                data: {
                    url: parsedUrl.href,
                    title: parsedUrl.hostname,
                    siteName: parsedUrl.hostname,
                    favicon: `${parsedUrl.origin}/favicon.ico`,
                }
            });
        }

        // Limit read to first 50KB to avoid huge pages
        const buffer = await response.arrayBuffer();
        const html = new TextDecoder().decode(buffer.slice(0, 50000));

        const ogData = parseOGTags(html, parsedUrl.href);

        // Fallback title
        if (!ogData.title) ogData.title = parsedUrl.hostname;

        res.json({ success: true, data: ogData });
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return res.status(408).json({ success: false, error: 'Request timeout' });
        }
        console.error('[LinkPreview] Error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch preview' });
    }
});

export default router;
