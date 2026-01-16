import Anthropic from '@anthropic-ai/sdk'
import { BrandResearchInput, BrandResearchResult } from '@/types/ai'

// Get Anthropic client
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }
  return new Anthropic({ apiKey })
}

export async function researchBrand(input: BrandResearchInput): Promise<BrandResearchResult> {
  const client = getClient()

  // Step 1: Crawl website (multiple pages)
  console.log(`[Brand Research] Starting crawl for ${input.url}`)
  const websiteContent = await crawlWebsite(input.url)
  console.log(`[Brand Research] Crawled ${websiteContent.pages.length} pages`)

  // Step 2: Use Claude to synthesize all information into structured brand knowledge
  const brandKnowledge = await synthesizeBrandKnowledge(client, input, websiteContent)

  return brandKnowledge
}

// ============================================
// Multi-Page Website Crawler
// ============================================

interface PageContent {
  url: string
  title: string
  content: string
  type: 'homepage' | 'about' | 'services' | 'pricing' | 'team' | 'contact' | 'other'
}

interface WebsiteContent {
  companyName: string
  baseUrl: string
  metaDescription: string
  pages: PageContent[]
  aggregatedContent: string
}

// Key page patterns to look for
const KEY_PAGE_PATTERNS = [
  { pattern: /\/(about|about-us|who-we-are|our-story)/i, type: 'about' as const },
  { pattern: /\/(services|what-we-do|solutions|offerings)/i, type: 'services' as const },
  { pattern: /\/(pricing|prices|plans|packages|cost)/i, type: 'pricing' as const },
  { pattern: /\/(team|people|staff|our-team|leadership)/i, type: 'team' as const },
  { pattern: /\/(contact|contact-us|get-in-touch)/i, type: 'contact' as const },
]

async function crawlWebsite(url: string): Promise<WebsiteContent> {
  const baseUrl = new URL(url).origin
  const visitedUrls = new Set<string>()
  const pages: PageContent[] = []

  // Step 1: Fetch homepage
  const homepage = await fetchPage(url, 'homepage')
  if (homepage) {
    pages.push(homepage)
    visitedUrls.add(url)
  }

  // Step 2: Extract internal links from homepage
  const homepageHtml = await fetchRawHtml(url)
  const internalLinks = extractInternalLinks(homepageHtml, baseUrl)
  console.log(`[Brand Research] Found ${internalLinks.length} internal links`)

  // Step 3: Identify and prioritize key pages
  const keyPages = identifyKeyPages(internalLinks, baseUrl)
  console.log(`[Brand Research] Identified key pages:`, keyPages.map(p => p.type))

  // Step 4: Fetch key pages (limit to 5 additional pages)
  const pagesToFetch = keyPages.slice(0, 5)

  for (const pageInfo of pagesToFetch) {
    if (visitedUrls.has(pageInfo.url)) continue

    const page = await fetchPage(pageInfo.url, pageInfo.type)
    if (page) {
      pages.push(page)
      visitedUrls.add(pageInfo.url)
    }

    // Small delay to be polite to servers
    await sleep(200)
  }

  // Step 5: Aggregate all content
  const aggregatedContent = pages
    .map(p => `=== ${p.type.toUpperCase()} PAGE (${p.url}) ===\n${p.content}`)
    .join('\n\n')

  // Extract company name and meta description from homepage
  const companyName = extractCompanyName(homepage?.title || '', url)
  const metaDescription = await extractMetaDescription(url)

  return {
    companyName,
    baseUrl,
    metaDescription,
    pages,
    aggregatedContent: aggregatedContent.slice(0, 50000) // Limit total content
  }
}

async function fetchRawHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookerBot/1.0; +https://bookerbot.ai)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) return ''
    return await response.text()
  } catch (error) {
    console.error(`[Brand Research] Error fetching ${url}:`, error)
    return ''
  }
}

async function fetchPage(url: string, type: PageContent['type']): Promise<PageContent | null> {
  try {
    const html = await fetchRawHtml(url)
    if (!html) return null

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || ''

    // Strip HTML and extract text content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footer
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove header (often duplicated)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000) // Limit per page

    return {
      url,
      title,
      content: textContent,
      type
    }
  } catch (error) {
    console.error(`[Brand Research] Error fetching page ${url}:`, error)
    return null
  }
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1]

    // Skip anchors, javascript, mailto, tel
    if (href.startsWith('#') || href.startsWith('javascript:') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue
    }

    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(href, baseUrl).href

      // Only include internal links
      if (absoluteUrl.startsWith(baseUrl)) {
        // Remove hash and query params for deduplication
        const cleanUrl = absoluteUrl.split('#')[0].split('?')[0]
        if (!links.includes(cleanUrl)) {
          links.push(cleanUrl)
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return links
}

function identifyKeyPages(links: string[], baseUrl: string): Array<{ url: string; type: PageContent['type'] }> {
  const keyPages: Array<{ url: string; type: PageContent['type']; priority: number }> = []

  for (const link of links) {
    const path = link.replace(baseUrl, '')

    for (const { pattern, type } of KEY_PAGE_PATTERNS) {
      if (pattern.test(path)) {
        keyPages.push({ url: link, type, priority: KEY_PAGE_PATTERNS.findIndex(p => p.type === type) })
        break
      }
    }
  }

  // Sort by priority (about first, then services, etc.)
  keyPages.sort((a, b) => a.priority - b.priority)

  // Also look for common direct paths if not found in links
  const foundTypes = new Set(keyPages.map(p => p.type))
  const commonPaths = [
    { path: '/about', type: 'about' as const },
    { path: '/about-us', type: 'about' as const },
    { path: '/services', type: 'services' as const },
    { path: '/pricing', type: 'pricing' as const },
    { path: '/contact', type: 'contact' as const },
  ]

  for (const { path, type } of commonPaths) {
    if (!foundTypes.has(type)) {
      keyPages.push({ url: `${baseUrl}${path}`, type, priority: 99 })
      foundTypes.add(type)
    }
  }

  return keyPages
}

async function extractMetaDescription(url: string): Promise<string> {
  try {
    const html = await fetchRawHtml(url)
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    return metaDescMatch?.[1]?.trim() || ''
  } catch {
    return ''
  }
}

function extractCompanyName(title: string, url: string): string {
  // Try to get company name from title first
  if (title) {
    // Common patterns: "Company Name | Tagline" or "Company Name - Tagline"
    const parts = title.split(/[|\-–—]/)[0].trim()
    if (parts && parts.length < 50) {
      return parts
    }
  }

  // Fall back to domain name
  try {
    const hostname = new URL(url).hostname
    const domain = hostname.replace(/^www\./, '').split('.')[0]
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    return 'Unknown Company'
  }
}

// ============================================
// Brand Knowledge Synthesis
// ============================================

async function synthesizeBrandKnowledge(
  client: Anthropic,
  input: BrandResearchInput,
  websiteContent: WebsiteContent
): Promise<BrandResearchResult> {
  const systemPrompt = `You are an expert brand research analyst. Your job is to deeply analyze a business website and create a comprehensive understanding that will help an AI assistant book appointments for them.

You have been given content from MULTIPLE PAGES of their website. Use ALL of this information to build a complete picture.

Your task is to analyze this and return a structured JSON response with your findings and recommendations.

CRITICAL INSTRUCTIONS:
- Extract SPECIFIC information from the website content - don't make generic guesses
- List their ACTUAL services as mentioned on the site
- Use their REAL company name and descriptions
- Identify their SPECIFIC target audience based on the content
- Create FAQs based on REAL information from the site
- The AI assistant will use this to have natural, knowledgeable conversations
- For SMS, responses must be SHORT (2-3 sentences max)

Return ONLY valid JSON matching this structure:
{
  "brandSummary": "2-3 sentence description of what this company ACTUALLY does based on the website",
  "companyName": "Official company name from the website",
  "industry": "Their specific industry/sector",
  "services": ["Actual Service 1", "Actual Service 2", "..."],
  "uniqueSellingPoints": ["Specific USP from the site", "..."],
  "pricingInfo": "Specific pricing details if found, or null",
  "targetAudience": "Their specific target audience as described/implied on the site",
  "idealCustomerProfile": "Specific description of their ideal customer",
  "suggestedTone": "How the AI should communicate based on the brand's voice",
  "brandVoiceExamples": ["Example phrases that match their brand voice"],
  "commonObjections": ["Likely objection 1", "Likely objection 2"],
  "faqs": [
    {"question": "Real question a prospect might ask", "answer": "Answer based on website info"},
    {"question": "...", "answer": "..."}
  ],
  "recentNews": ["Any news/updates mentioned on the site"],
  "socialPresence": ["Social platforms if mentioned"],
  "suggestedQualificationCriteria": [
    "Specific criterion based on their target audience",
    "Specific criterion based on their services",
    "..."
  ],
  "suggestedDosAndDonts": {
    "dos": ["Specific do based on their brand", "..."],
    "donts": ["Specific don't based on their brand", "..."]
  }
}`

  // Build a rich prompt with all the crawled content
  const pagesSummary = websiteContent.pages
    .map(p => `- ${p.type}: ${p.title || 'No title'}`)
    .join('\n')

  const userPrompt = `Please analyze this business thoroughly and create a detailed brand understanding:

**URL:** ${input.url}
**Goal:** ${input.goal}
**Communication Channel:** ${input.channel}

**Company Name (from title):** ${websiteContent.companyName}
**Meta Description:** ${websiteContent.metaDescription}

**Pages Crawled:**
${pagesSummary}

**FULL WEBSITE CONTENT:**
${websiteContent.aggregatedContent}

Based on ALL the content above, please provide a comprehensive, SPECIFIC brand analysis. Do NOT give generic responses - extract real information from the content provided.`

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const textContent = response.content.find(block => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : '{}'

    // Parse JSON response (handle potential markdown code blocks)
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(jsonText) as BrandResearchResult

    // Ensure all required fields exist
    return {
      brandSummary: result.brandSummary || `${websiteContent.companyName} is a business.`,
      companyName: result.companyName || websiteContent.companyName,
      industry: result.industry || 'General Business',
      services: result.services || [],
      uniqueSellingPoints: result.uniqueSellingPoints || [],
      pricingInfo: result.pricingInfo || null,
      targetAudience: result.targetAudience || 'Business professionals',
      idealCustomerProfile: result.idealCustomerProfile || '',
      suggestedTone: result.suggestedTone || 'Professional and friendly',
      brandVoiceExamples: result.brandVoiceExamples || [],
      commonObjections: result.commonObjections || [],
      faqs: result.faqs || [],
      recentNews: result.recentNews || [],
      socialPresence: result.socialPresence || [],
      suggestedQualificationCriteria: result.suggestedQualificationCriteria || [
        'Is a decision maker',
        'Has a genuine need',
        'Available within reasonable timeframe'
      ],
      suggestedDosAndDonts: result.suggestedDosAndDonts || {
        dos: ['Be helpful and friendly', 'Answer questions clearly'],
        donts: ['Be pushy', 'Make promises you cannot keep']
      }
    }
  } catch (error) {
    console.error('[Brand Research] Error synthesizing brand knowledge:', error)

    // Return basic fallback
    return {
      brandSummary: `${websiteContent.companyName} is a business offering professional services.`,
      companyName: websiteContent.companyName,
      industry: 'General Business',
      services: [],
      uniqueSellingPoints: [],
      pricingInfo: null,
      targetAudience: 'Business professionals',
      idealCustomerProfile: '',
      suggestedTone: 'Professional and friendly',
      brandVoiceExamples: [],
      commonObjections: [
        'I need to think about it',
        'What does it cost?',
        'How is this different from competitors?'
      ],
      faqs: [],
      recentNews: [],
      socialPresence: [],
      suggestedQualificationCriteria: [
        'Is a decision maker or can influence decisions',
        'Has a genuine need for the service',
        'Available to meet within the next 2 weeks'
      ],
      suggestedDosAndDonts: {
        dos: [
          'Be helpful and answer questions',
          'Be respectful of their time',
          'Clearly explain the value proposition'
        ],
        donts: [
          'Be pushy or aggressive',
          'Make promises outside your authority',
          'Ignore requests to stop contact'
        ]
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Export for testing
export { crawlWebsite, fetchPage, extractCompanyName }
