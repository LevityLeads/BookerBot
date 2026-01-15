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

  // Step 1: Fetch and analyze the website
  const websiteContent = await fetchWebsiteContent(input.url)

  // Step 2: Search for additional context (news, reviews, etc.)
  const searchResults = await searchForBrandContext(input.url, websiteContent.companyName)

  // Step 3: Use Claude to synthesize all information into structured brand knowledge
  const brandKnowledge = await synthesizeBrandKnowledge(
    client,
    input,
    websiteContent,
    searchResults
  )

  return brandKnowledge
}

interface WebsiteContent {
  companyName: string
  rawContent: string
  pageTitle: string
  metaDescription: string
}

async function fetchWebsiteContent(url: string): Promise<WebsiteContent> {
  try {
    // Fetch the website HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookerBot/1.0; +https://bookerbot.ai)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }

    const html = await response.text()

    // Extract useful content (basic parsing)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)

    // Strip HTML tags and scripts for raw content
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000) // Limit content size

    // Try to extract company name from title or URL
    const pageTitle = titleMatch?.[1]?.trim() || ''
    const companyName = extractCompanyName(pageTitle, url)

    return {
      companyName,
      rawContent: textContent,
      pageTitle,
      metaDescription: metaDescMatch?.[1]?.trim() || ''
    }
  } catch (error) {
    console.error('Error fetching website:', error)
    return {
      companyName: extractCompanyName('', url),
      rawContent: '',
      pageTitle: '',
      metaDescription: ''
    }
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

interface SearchResults {
  news: string[]
  reviews: string[]
  socialMentions: string[]
}

async function searchForBrandContext(
  url: string,
  companyName: string
): Promise<SearchResults> {
  // In production, this would use a search API (Google, Bing, etc.)
  // For now, we'll use Claude's knowledge and the URL
  // This can be enhanced later with actual web search

  // Note: We could integrate with:
  // - Google Custom Search API
  // - Bing Search API
  // - News APIs
  // - Social media APIs

  // TODO: Implement web search integration
  console.log(`Brand context search stub for: ${companyName} (${url})`)

  // For MVP, return placeholder that Claude will work with
  return {
    news: [],
    reviews: [],
    socialMentions: []
  }
}

async function synthesizeBrandKnowledge(
  client: Anthropic,
  input: BrandResearchInput,
  websiteContent: WebsiteContent,
  searchResults: SearchResults
): Promise<BrandResearchResult> {
  const systemPrompt = `You are a brand research analyst. Your job is to analyze a business and create a comprehensive understanding that will help an AI assistant book appointments for them.

You will be given:
1. Website content from their URL
2. The goal they want to achieve (e.g., "book discovery calls")
3. The communication channel (SMS, WhatsApp, or email)

Your task is to analyze this and return a structured JSON response with your findings and recommendations.

IMPORTANT:
- Be specific and actionable in your recommendations
- The AI assistant will use this to have natural conversations
- For SMS, responses must be SHORT (2-3 sentences max)
- Suggest realistic qualification criteria based on their business
- Identify likely objections and how to handle them
- Create FAQs the AI should be able to answer

Return ONLY valid JSON matching this structure:
{
  "brandSummary": "2-3 sentence description of what this company does",
  "companyName": "Official company name",
  "industry": "Their industry/sector",
  "services": ["Service 1", "Service 2"],
  "uniqueSellingPoints": ["USP 1", "USP 2"],
  "pricingInfo": "Pricing details if found, or null",
  "targetAudience": "Description of who they serve",
  "idealCustomerProfile": "Specific description of ideal customer",
  "suggestedTone": "How the AI should communicate (e.g., professional but friendly)",
  "brandVoiceExamples": ["Example phrase 1", "Example phrase 2"],
  "commonObjections": ["Objection 1", "Objection 2"],
  "faqs": [
    {"question": "Q1", "answer": "A1"},
    {"question": "Q2", "answer": "A2"}
  ],
  "recentNews": ["News item if any"],
  "socialPresence": ["Platform mentions if any"],
  "suggestedQualificationCriteria": [
    "Criterion 1 (e.g., Business owner or decision maker)",
    "Criterion 2 (e.g., Has budget for services)",
    "Criterion 3 (e.g., Looking to start within 30 days)"
  ],
  "suggestedDosAndDonts": {
    "dos": ["Do 1", "Do 2"],
    "donts": ["Don't 1", "Don't 2"]
  }
}`

  const userPrompt = `Please analyze this business and create a brand understanding:

**URL:** ${input.url}
**Goal:** ${input.goal}
**Channel:** ${input.channel}

**Website Title:** ${websiteContent.pageTitle}
**Meta Description:** ${websiteContent.metaDescription}

**Website Content:**
${websiteContent.rawContent.slice(0, 10000)}

${searchResults.news.length > 0 ? `**Recent News:**\n${searchResults.news.join('\n')}` : ''}

Please analyze this business and provide the structured JSON response.`

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Use Sonnet for better analysis
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const textContent = response.content.find(block => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : '{}'

    // Parse JSON response
    const result = JSON.parse(text) as BrandResearchResult

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
    console.error('Error synthesizing brand knowledge:', error)

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

// Export for testing
export { fetchWebsiteContent, extractCompanyName }
