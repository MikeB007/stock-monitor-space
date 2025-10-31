import axios from 'axios'
import express from 'express'
import multer from 'multer'
import { ocrService } from '../services/ocrService'

const router = express.Router()

// Configure multer for image uploads
const storage = multer.memoryStorage()
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Allow only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'))
        }
    }
})

// OCR endpoint for extracting stock symbols from images
router.post('/extract-stocks', upload.single('image'), async (req, res): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            })
        }

        console.log(`📷 Processing image upload: ${req.file.originalname} (${req.file.size} bytes)`)

        // Process the image with OCR
        const result = await ocrService.processImageForStocks(req.file.buffer)

        // Validate extracted stocks with Yahoo Finance
        const validatedStocks = []
        for (const stock of result.extractedStocks) {
            try {
                // Quick validation with Yahoo Finance
                const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}`, {
                    timeout: 3000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })

                const data = response.data?.chart?.result?.[0]
                if (data && data.meta && data.meta.symbol === stock.symbol) {
                    validatedStocks.push({
                        ...stock,
                        isValid: true,
                        companyName: data.meta.longName || data.meta.shortName || stock.symbol,
                        currentPrice: data.meta.regularMarketPrice || data.meta.previousClose
                    })
                }
            } catch (error) {
                // Keep invalid stocks but mark them
                validatedStocks.push({
                    ...stock,
                    isValid: false,
                    reason: 'Symbol not found or invalid'
                })
            }
        }

        console.log(`✅ OCR processing complete: ${validatedStocks.length} stocks extracted`)

        res.json({
            success: true,
            data: {
                extractedStocks: validatedStocks,
                ocrConfidence: result.confidence,
                rawText: result.rawText.substring(0, 500), // Limit raw text in response
                processedText: result.processedText.substring(0, 500)
            }
        })

    } catch (error) {
        console.error('❌ OCR processing failed:', error)
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'OCR processing failed'
        })
    }
})

// Batch validate multiple stock symbols (for OCR results)
router.post('/validate-stocks', async (req, res): Promise<any> => {
    const { symbols } = req.body

    if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({
            success: false,
            error: 'Symbols array is required'
        })
    }

    try {
        const validationResults = []

        for (const symbol of symbols) {
            const cleanSymbol = symbol.trim().toUpperCase()

            // Basic format validation
            if (!/^[A-Z]{1,5}$/.test(cleanSymbol)) {
                validationResults.push({
                    symbol: cleanSymbol,
                    valid: false,
                    error: 'Invalid format'
                })
                continue
            }

            try {
                // Validate with Yahoo Finance
                const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${cleanSymbol}`, {
                    timeout: 3000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })

                const data = response.data?.chart?.result?.[0]
                if (data && data.meta && data.meta.symbol === cleanSymbol) {
                    validationResults.push({
                        symbol: cleanSymbol,
                        valid: true,
                        companyName: data.meta.longName || data.meta.shortName || cleanSymbol,
                        currentPrice: data.meta.regularMarketPrice || data.meta.previousClose
                    })
                } else {
                    validationResults.push({
                        symbol: cleanSymbol,
                        valid: false,
                        error: 'Symbol not found'
                    })
                }
            } catch (error) {
                validationResults.push({
                    symbol: cleanSymbol,
                    valid: false,
                    error: 'Validation failed'
                })
            }
        }

        res.json({
            success: true,
            data: validationResults
        })

    } catch (error) {
        console.error('❌ Batch validation failed:', error)
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Batch validation failed'
        })
    }
})

export default router