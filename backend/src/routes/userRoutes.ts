import express from 'express'
import { databaseService, User } from '../services/databaseService'

const router = express.Router()

// GET /api/users - Get all users
router.get('/users', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const users = await databaseService.getUsers()

        return res.json({
            success: true,
            data: users,
            count: users.length
        })

    } catch (error) {
        console.error('Get users API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        })
    }
})

// GET /api/users/:id - Get user by ID
router.get('/users/:id', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const userId = parseInt(req.params.id)
        const user = await databaseService.getUserById(userId)

        if (!user) {
            return res.status(404).json({
                success: false,
                error: `User ${userId} not found`
            })
        }

        return res.json({
            success: true,
            data: user
        })

    } catch (error) {
        console.error('Get user API error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        })
    }
})

// POST /api/users - Create new user
router.post('/users', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { username, email } = req.body

        // Validate required field
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: username'
            })
        }

        const newUser: User = {
            username: username.trim(),
            email: email ? email.trim() : undefined
        }

        const insertId = await databaseService.createUser(newUser)

        return res.status(201).json({
            success: true,
            message: `User ${newUser.username} created successfully`,
            data: { ...newUser, id: insertId }
        })

    } catch (error) {
        console.error('Create user error:', error)

        const errorMessage = (error as Error).message
        if (errorMessage.includes('Duplicate entry')) {
            return res.status(409).json({
                success: false,
                error: `Username ${req.body.username} already exists`
            })
        }

        return res.status(500).json({
            success: false,
            error: 'Failed to create user'
        })
    }
})

// GET /api/preferences/:browserId - Get user preferences for this browser
router.get('/preferences/:browserId', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { browserId } = req.params
        const preferences = await databaseService.getUserPreferences(browserId)

        if (!preferences) {
            return res.json({
                success: true,
                data: { last_viewed_user_id: null }
            })
        }

        return res.json({
            success: true,
            data: preferences
        })

    } catch (error) {
        console.error('Get preferences error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to get preferences'
        })
    }
})

// POST /api/preferences - Save user preferences
router.post('/preferences', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { browser_id, user_id } = req.body

        if (!browser_id || !user_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: browser_id, user_id'
            })
        }

        await databaseService.saveUserPreferences(browser_id, user_id)

        return res.json({
            success: true,
            message: 'Preferences saved successfully'
        })

    } catch (error) {
        console.error('Save preferences error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to save preferences'
        })
    }
})

// PUT /api/users/:userId/last-portfolio - Update user's last viewed portfolio
router.put('/users/:userId/last-portfolio', async (req, res) => {
    try {
        if (!databaseService.isConnected()) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            })
        }

        const { userId } = req.params
        const { portfolio_id } = req.body

        if (!portfolio_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: portfolio_id'
            })
        }

        const updated = await databaseService.updateUserLastViewedPortfolio(parseInt(userId), portfolio_id)

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: `User ${userId} not found`
            })
        }

        return res.json({
            success: true,
            message: 'Last viewed portfolio updated successfully'
        })

    } catch (error) {
        console.error('Update last portfolio error:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to update last viewed portfolio'
        })
    }
})

export default router
