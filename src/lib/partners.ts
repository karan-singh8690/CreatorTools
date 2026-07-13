// Partner / Affiliate Recommendation Configuration
// These are shown when tools are unavailable, broken, or coming soon

export interface Partner {
  id: string
  name: string
  description: string
  url: string // Affiliate link - replace with your actual affiliate URLs
  badge?: string // e.g. "Free Trial", "Most Popular", "Best Value"
  features: string[]
  logo?: string // URL to partner logo (optional)
}

export interface PartnerCategory {
  id: string
  toolId: string // Maps to the tool that triggers this recommendation
  title: string
  subtitle: string
  partners: Partner[]
}

export const partnerCategories: PartnerCategory[] = [
  {
    id: 'ocr',
    toolId: 'ocr-pdf',
    title: 'Need Professional OCR?',
    subtitle: 'Our free OCR works for text-based PDFs, but for 100% accurate scanned document recognition, try these industry-leading solutions:',
    partners: [
      {
        id: 'adobe-acrobat',
        name: 'Adobe Acrobat Pro',
        description: 'The industry standard for PDF OCR. Accurately convert scanned documents to searchable, editable text.',
        url: 'https://www.adobe.com/acrobat/free-trial-download.html',
        badge: 'Free Trial',
        features: ['99%+ OCR accuracy', 'Recognizes 20+ languages', 'Editable search layer', 'Industry standard'],
      },
      {
        id: 'pdfelement',
        name: 'CreatorTools PDF',
        description: 'Powerful and affordable PDF editor with advanced OCR capabilities for scanned documents.',
        url: 'https://pdf.wondershare.com/',
        badge: 'Best Value',
        features: ['Affordable alternative', 'Batch OCR processing', 'Multi-language support', 'Easy-to-use interface'],
      },
      {
        id: 'nanonets',
        name: 'Nanonets',
        description: 'AI-powered data extraction from invoices, receipts, and structured documents.',
        url: 'https://nanonets.com/',
        badge: 'For Data Extraction',
        features: ['AI document parsing', 'Invoice/receipt OCR', 'API integration', 'Auto-classification'],
      },
    ],
  },
  {
    id: 'esign',
    toolId: 'request-esign',
    title: 'Need E-Signatures?',
    subtitle: 'We\'ve partnered with the best e-signature platforms so you can sign and send documents securely:',
    partners: [
      {
        id: 'docusign',
        name: 'DocuSign',
        description: 'The world\'s #1 e-signature solution. Send, sign, and manage documents securely from anywhere.',
        url: 'https://www.docusign.com/',
        badge: 'Most Popular',
        features: ['Legally binding', 'Bank-level security', 'Mobile signing', 'Audit trail'],
      },
      {
        id: 'pandadoc',
        name: 'PandaDoc',
        description: 'All-in-one document automation with e-signatures, perfect for small businesses.',
        url: 'https://www.pandadoc.com/',
        badge: 'Free Demo',
        features: ['Document templates', 'Payment collection', 'CRM integration', 'Analytics'],
      },
      {
        id: 'dropbox-sign',
        name: 'Dropbox Sign',
        description: 'Simple, intuitive e-signatures built for fast-moving teams. Formerly HelloSign.',
        url: 'https://www.hellosign.com/',
        badge: 'Easy Setup',
        features: ['Simple interface', 'Template library', 'In-person signing', 'Team management'],
      },
    ],
  },
  {
    id: 'chat-pdf',
    toolId: 'summarize-pdf',
    title: 'Want to Chat with Your PDF?',
    subtitle: 'Our AI assistant is currently limited. For advanced PDF conversations and analysis, try these dedicated tools:',
    partners: [
      {
        id: 'humata',
        name: 'Humata',
        description: 'Ask questions about your PDF and get instant AI-powered answers with citations.',
        url: 'https://www.humata.ai/',
        badge: 'Free Tier',
        features: ['Q&A with citations', 'Instant summaries', 'Multi-document chat', 'Secure processing'],
      },
      {
        id: 'chatpdf',
        name: 'ChatPDF',
        description: 'Transform your PDFs into interactive chat sessions. Perfect for research papers and reports.',
        url: 'https://www.chatpdf.com/',
        badge: 'Popular',
        features: ['Research paper chat', 'Page references', 'Multi-file support', 'Chrome extension'],
      },
    ],
  },
  {
    id: 'translate',
    toolId: 'translate-pdf',
    title: 'Need Professional Translation?',
    subtitle: 'Our free AI translation handles basic needs, but for publication-quality results, try these dedicated services:',
    partners: [
      {
        id: 'deepl',
        name: 'DeepL Pro',
        description: 'The highest quality AI translator, trusted by professionals for nuanced, accurate translations.',
        url: 'https://www.deepl.com/pro',
        badge: 'Best Quality',
        features: ['Superior quality', '30+ languages', 'Document formatting preserved', 'Glossary support'],
      },
      {
        id: 'smartcat',
        name: 'Smartcat',
        description: 'Professional translation platform combining AI with human editors for perfect results.',
        url: 'https://www.smartcat.com/',
        badge: 'Pro Quality',
        features: ['AI + Human translation', 'Translation memory', 'Collaboration tools', 'CAT tools'],
      },
    ],
  },
  {
    id: 'extract-data',
    toolId: 'extract-data',
    title: 'Need Reliable Data Extraction?',
    subtitle: 'Our free extraction works for simple documents. For enterprise-grade data extraction, try these solutions:',
    partners: [
      {
        id: 'nanonets-extract',
        name: 'Nanonets',
        description: 'AI-powered data extraction from invoices, receipts, POs, and other business documents.',
        url: 'https://nanonets.com/',
        badge: 'Best for Business',
        features: ['Invoice extraction', 'Receipt parsing', 'Custom models', 'API & Zapier'],
      },
      {
        id: 'docparser',
        name: 'Docparser',
        description: 'Extract data from PDFs and turn it into structured, actionable data with custom parsing rules.',
        url: 'https://docparser.com/',
        badge: 'Custom Rules',
        features: ['Visual rule builder', 'Template library', 'Webhook delivery', 'Cloud integrations'],
      },
    ],
  },
  {
    id: 'convert',
    toolId: 'convert-pdf',
    title: 'Need Perfect PDF Conversion?',
    subtitle: 'Our free conversion handles basic formatting. For pixel-perfect Word/Excel conversions, try these:',
    partners: [
      {
        id: 'adobe-convert',
        name: 'Adobe Acrobat Pro',
        description: 'The gold standard for PDF to Word, Excel, and PowerPoint conversion with perfect formatting.',
        url: 'https://www.adobe.com/acrobat/free-trial-download.html',
        badge: 'Best Accuracy',
        features: ['Perfect formatting', 'All Office formats', 'Batch conversion', 'Preserve layouts'],
      },
      {
        id: 'pdfelement-convert',
        name: 'CreatorTools PDF',
        description: 'Affordable PDF converter with excellent Word, Excel, and PPT conversion quality.',
        url: 'https://pdf.wondershare.com/',
        badge: 'Best Value',
        features: ['Affordable pricing', 'Batch conversion', 'Form conversion', 'OCR included'],
      },
    ],
  },
  {
    id: 'templates',
    toolId: 'templates',
    title: 'Need Professional Templates?',
    subtitle: 'Jump-start your projects with thousands of ready-made templates from these platforms:',
    partners: [
      {
        id: 'envato',
        name: 'Envato Elements',
        description: 'Unlimited access to thousands of professional templates, graphics, fonts, and more.',
        url: 'https://elements.envato.com/',
        badge: 'Largest Library',
        features: ['Unlimited downloads', 'All file types', 'Commercial license', 'Regular updates'],
      },
      {
        id: 'canva',
        name: 'Canva Pro',
        description: 'Design anything with thousands of beautiful templates. From presentations to social media.',
        url: 'https://www.canva.com/pro/',
        badge: 'Free Trial',
        features: ['Drag & drop editor', 'Brand kit', 'Team collaboration', 'Millions of assets'],
      },
    ],
  },
  {
    id: 'scan',
    toolId: 'scan-to-pdf',
    title: 'Need to Scan Documents?',
    subtitle: 'Turn your physical documents into digital PDFs with these professional scanning solutions:',
    partners: [
      {
        id: 'adobe-scan',
        name: 'Adobe Scan',
        description: 'Free mobile scanner app that turns your phone into a powerful document scanner with OCR.',
        url: 'https://www.adobe.com/acrobat/mobile/scanner-app.html',
        badge: 'Free App',
        features: ['Mobile scanning', 'Auto-crop & enhance', 'Built-in OCR', 'Cloud storage'],
      },
      {
        id: 'camscanner',
        name: 'CamScanner',
        description: 'Popular document scanner with smart cropping, text recognition, and easy sharing.',
        url: 'https://www.camscanner.com/',
        badge: 'Popular',
        features: ['Smart cropping', 'Annotation tools', 'Cloud sync', 'Batch scanning'],
      },
    ],
  },
]

// Helper to find partner recommendations for a specific tool
export function getPartnersForTool(toolId: string): PartnerCategory | undefined {
  return partnerCategories.find((cat) => cat.toolId === toolId)
}

// Get all tool IDs that have partner recommendations
export function getToolsWithPartners(): string[] {
  return partnerCategories.map((cat) => cat.toolId)
}
