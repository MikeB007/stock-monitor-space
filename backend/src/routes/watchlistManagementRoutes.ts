import express from 'express'
import { databaseService, Watchlist } from '../services/databaseService'

const router = express.Router()

// GET /api/Watchlists/user/:userId - Get all Watchlists for a user
router.get('/Watchlists/user/:userId', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const userId = parseInt(req.params.userId)
        const Watchlists = await databaseService.getWatchlistsByUserId(userId)

        return res.json({
            success: true,
            data: Watchlists,
            count: Watchlists.length
        })

    } catch (error) {
        console.error('Get Watchlists API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch Watchlists'
        })
    }
})

// GET /api/Watchlists/:id - Get Watchlist by ID
router.get('/Watchlists/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const WatchlistId = parseInt(req.params.id)
        const Watchlist = await databaseService.getWatchlistById(WatchlistId)

        if (!Watchlist) {
            return res.status(404).json({
                success: false,
                error: `Watchlist ${WatchlistId} not found`
            })
        }

        return res.json({
            success: true,
            data: Watchlist
        })

    } catch (error) {
        console.error('Get Watchlist API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch Watchlist'
        })
    }
})

// POST /api/Watchlists - Create new Watchlist
router.post('/Watchlists', async (req, res) => {
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

        const newWatchlist: Watchlist = {
            user_id: parseInt(user_id),
            name: name.trim(),
            description: description ? description.trim() : undefined
        }

        const insertId = await databaseService.createWatchlist(newWatchlist)

        return res.status(201).json({
            success: true,
            message: `Watchlist ${newWatchlist.name} created successfully`,
            data: { ...newWatchlist, id: insertId }
        })

    } catch (error) {
        console.error('Create Watchlist error:', error)

        const errorMessage = (error as Error).message
        if (errorMessage.includes('Duplicate entry')) {
            return res.status(409).json({
                success: false,
                error: `Watchlist ${req.body.name} already exists for this user`
            })
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to create Watchlist'
        })
    }
})

// PUT /api/Watchlists/:id - Update Watchlist
router.put('/Watchlists/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const WatchlistId = parseInt(req.params.id)
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

        const updated = await databaseService.updateWatchlist(WatchlistId, updates)

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: `Watchlist ${WatchlistId} not found`
            })
        }

        return res.json({
            success: true,
            message: `Watchlist ${WatchlistId} updated successfully`
        })

    } catch (error) {
        console.error('Update Watchlist error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to update Watchlist'
        })
    }
})

// DELETE /api/Watchlists/:id - Delete Watchlist
router.delete('/Watchlists/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const WatchlistId = parseInt(req.params.id)
        const deleted = await databaseService.deleteWatchlist(WatchlistId)

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: `Watchlist ${WatchlistId} not found`
            })
        }

        return res.json({
            success: true,
            message: `Watchlist ${WatchlistId} deleted successfully`
        })

    } catch (error) {
        console.error('Delete Watchlist error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to delete Watchlist'
        })
    }
})

export default router

