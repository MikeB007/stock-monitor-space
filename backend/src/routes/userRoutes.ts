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

export default router
