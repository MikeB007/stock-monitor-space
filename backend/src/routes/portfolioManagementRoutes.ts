import express from 'express'
import { databaseService, Portfolio } from '../services/databaseService'

const router = express.Router()

// GET /api/portfolios/user/:userId - Get all portfolios for a user
router.get('/portfolios/user/:userId', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const userId = parseInt(req.params.userId)
        const portfolios = await databaseService.getPortfoliosByUserId(userId)

        return res.json({
            success: true,
            data: portfolios,
            count: portfolios.length
        })

    } catch (error) {
        console.error('Get portfolios API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolios'
        })
    }
})

// GET /api/portfolios/:id - Get portfolio by ID
router.get('/portfolios/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = parseInt(req.params.id)
        const portfolio = await databaseService.getPortfolioById(portfolioId)

        if (!portfolio) {
            return res.status(404).json({
                success: false,
                error: `Portfolio ${portfolioId} not found`
            })
        }

        return res.json({
            success: true,
            data: portfolio
        })

    } catch (error) {
        console.error('Get portfolio API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch portfolio'
        })
    }
})

// POST /api/portfolios - Create new portfolio
router.post('/portfolios', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { user_id, name, description } = req.body

        // Validate required fields
        if (!user_id || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: user_id, name'
            })
        }

        const newPortfolio: Portfolio = {
            user_id: parseInt(user_id),
            name: name.trim(),
            description: description ? description.trim() : undefined
        }

        const insertId = await databaseService.createPortfolio(newPortfolio)

        return res.status(201).json({
            success: true,
            message: `Portfolio ${newPortfolio.name} created successfully`,
            data: { ...newPortfolio, id: insertId }
        })

    } catch (error) {
        console.error('Create portfolio error:', error)

        const errorMessage = (error as Error).message
        if (errorMessage.includes('Duplicate entry')) {
            return res.status(409).json({
                success: false,
                error: `Portfolio ${req.body.name} already exists for this user`
            })
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to create portfolio'
        })
    }
})

// PUT /api/portfolios/:id - Update portfolio
router.put('/portfolios/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = parseInt(req.params.id)
        const updates = req.body

        // Remove id and user_id from updates
        delete updates.id
        delete updates.user_id

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields provided for update'
            })
        }

        const updated = await databaseService.updatePortfolio(portfolioId, updates)

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: `Portfolio ${portfolioId} not found`
            })
        }

        return res.json({
            success: true,
            message: `Portfolio ${portfolioId} updated successfully`
        })

    } catch (error) {
        console.error('Update portfolio error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to update portfolio'
        })
    }
})

// DELETE /api/portfolios/:id - Delete portfolio
router.delete('/portfolios/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const portfolioId = parseInt(req.params.id)
        const deleted = await databaseService.deletePortfolio(portfolioId)

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: `Portfolio ${portfolioId} not found`
            })
        }

        return res.json({
            success: true,
            message: `Portfolio ${portfolioId} deleted successfully`
        })

    } catch (error) {
        console.error('Delete portfolio error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to delete portfolio'
        })
    }
})

export default router
