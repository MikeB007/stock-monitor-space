import sharp from 'sharp'
import { createWorker } from 'tesseract.js'

export interface ExtractedStock {
    symbol: string
    confidence: number
    context?: string
    position?: { x: number, y: number, width: number, height: number }
}

export interface OCRResult {
    extractedStocks: ExtractedStock[]
    rawText: string
    processedText: string
    confidence: number
}

export class OCRService {
    private worker: any = null

    async initialize() {
        if (!this.worker) {
            console.log('🔍 Initializing OCR engine...')
            this.worker = await createWorker('eng')
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:%$+-() \n\t',
                preserve_interword_spaces: '1',
            })
            console.log('✅ OCR engine initialized')
        }
    }

    async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
        try {
            // Enhance image for better OCR accuracy
            const processedImage = await sharp(imageBuffer)
                .resize(null, 1000, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .sharpen()
                .normalize()
                .greyscale()
                .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
                .png()
                .toBuffer()

            console.log('✅ Image preprocessed for OCR')
            return processedImage
        } catch (error) {
            console.error('❌ Image preprocessing failed:', error)
            return imageBuffer // Return original if preprocessing fails
        }
    }

    async extractTextFromImage(imageBuffer: Buffer): Promise<{ text: string, confidence: number }> {
        await this.initialize()

        try {
            console.log('🔍 Performing OCR on image...')

            // Preprocess image for better OCR
            const processedImage = await this.preprocessImage(imageBuffer)

            const { data: { text, confidence } } = await this.worker.recognize(processedImage)

            console.log(`✅ OCR completed with ${confidence.toFixed(1)}% confidence`)
            console.log('📄 Extracted text preview:', text.substring(0, 200) + '...')

            return { text, confidence }
        } catch (error) {
            console.error('❌ OCR extraction failed:', error)
            throw new Error('Failed to extract text from image')
        }
    }

    extractStockSymbols(text: string): ExtractedStock[] {
        const stocks: ExtractedStock[] = []

        // Enhanced regex patterns for stock symbols
        const patterns = [
            // Standard stock symbols (1-5 uppercase letters)
            /\b[A-Z]{1,5}\b/g,
            // Symbols with common prefixes/suffixes
            /\b[A-Z]{1,4}[A-Z0-9]\b/g,
            // Common stock symbol patterns in context
            /(?:Symbol|Ticker|Stock)[\s:]+([A-Z]{1,5})/gi,
            // Parenthetical symbols like "Apple Inc. (AAPL)"
            /\(([A-Z]{1,5})\)/g,
            // Colon-separated like "AAPL: $150.00"
            /([A-Z]{1,5}):/g
        ]

        const foundSymbols = new Set<string>()
        const lines = text.split('\n')

        patterns.forEach(pattern => {
            let match
            while ((match = pattern.exec(text)) !== null) {
                const symbol = match[1] || match[0]
                const cleanSymbol = symbol.trim().toUpperCase()

                // Filter out common false positives
                if (this.isValidStockSymbol(cleanSymbol)) {
                    // Find context (surrounding text)
                    const context = this.getSymbolContext(text, match.index!, cleanSymbol)

                    // Calculate confidence based on context
                    const confidence = this.calculateSymbolConfidence(cleanSymbol, context)

                    if (!foundSymbols.has(cleanSymbol)) {
                        stocks.push({
                            symbol: cleanSymbol,
                            confidence,
                            context
                        })
                        foundSymbols.add(cleanSymbol)
                    }
                }
            }
        })

        // Sort by confidence (highest first)
        return stocks.sort((a, b) => b.confidence - a.confidence)
    }

    private isValidStockSymbol(symbol: string): boolean {
        // Filter out common false positives
        const blacklist = [
            'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HAD',
            'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS',
            'HOW', 'ITS', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID',
            'TOTAL', 'VALUE', 'PRICE', 'CHANGE', 'HIGH', 'LOW', 'OPEN', 'CLOSE',
            'VOL', 'QTY', 'AMT', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD',
            'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
            'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'
        ]

        // Must be 1-5 characters
        if (symbol.length < 1 || symbol.length > 5) return false

        // Must be all uppercase letters/numbers
        if (!/^[A-Z0-9]+$/.test(symbol)) return false

        // Must not be in blacklist
        if (blacklist.includes(symbol)) return false

        // Must not be all numbers
        if (/^\d+$/.test(symbol)) return false

        return true
    }

    private getSymbolContext(text: string, position: number, symbol: string): string {
        const start = Math.max(0, position - 50)
        const end = Math.min(text.length, position + symbol.length + 50)
        return text.substring(start, end).trim()
    }

    private calculateSymbolConfidence(symbol: string, context: string): number {
        let confidence = 50 // Base confidence

        // Boost confidence based on context clues
        const contextLower = context.toLowerCase()

        // High confidence indicators
        if (contextLower.includes('symbol') || contextLower.includes('ticker')) confidence += 30
        if (contextLower.includes('stock') || contextLower.includes('equity')) confidence += 25
        if (contextLower.includes('shares') || contextLower.includes('holdings')) confidence += 20
        if (contextLower.includes('Watchlist') || contextLower.includes('position')) confidence += 20
        if (/\$[\d,]+\.?\d*/.test(context)) confidence += 15 // Price indicators
        if (/[\+\-]\d+\.?\d*%/.test(context)) confidence += 15 // Percentage change
        if (context.includes('(') && context.includes(')')) confidence += 10 // Parenthetical

        // Length-based confidence (3-4 letter symbols are most common)
        if (symbol.length === 3 || symbol.length === 4) confidence += 10
        if (symbol.length === 1 || symbol.length === 5) confidence -= 5

        // Pattern-based confidence instead of hardcoded symbols
        // Common patterns: vowel distribution, repeated letters, etc.
        const vowels = symbol.match(/[AEIOU]/g)?.length || 0
        const vowelRatio = vowels / symbol.length
        if (vowelRatio >= 0.2 && vowelRatio <= 0.5) confidence += 15 // Good vowel distribution
        if (/(.)\1/.test(symbol)) confidence -= 5 // Repeated letters are less common

        return Math.min(100, Math.max(0, confidence))
    }

    async processImageForStocks(imageBuffer: Buffer): Promise<OCRResult> {
        try {
            console.log('🔍 Starting OCR processing for stock extraction...')

            const { text, confidence } = await this.extractTextFromImage(imageBuffer)

            // Clean and process the text
            const processedText = text
                .replace(/[^\w\s\$\.\,\:\(\)\+\-\%]/g, ' ') // Remove special chars except financial ones
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim()

            const extractedStocks = this.extractStockSymbols(processedText)

            console.log(`✅ Extracted ${extractedStocks.length} potential stock symbols`)
            extractedStocks.forEach(stock => {
                console.log(`   📈 ${stock.symbol} (${stock.confidence}% confidence)`)
            })

            return {
                extractedStocks,
                rawText: text,
                processedText,
                confidence
            }
        } catch (error) {
            console.error('❌ Stock extraction failed:', error)
            throw error
        }
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate()
            this.worker = null
            console.log('🧹 OCR worker cleaned up')
        }
    }
}

// Export singleton instance
export const ocrService = new OCRService()
