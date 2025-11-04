import { Router, Request, Response } from 'express'
import { databaseService } from '../services/databaseService'

const router = Router()

// Get user preferences
router.get('/api/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId)
        
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid user ID' })
            return
        }

        const preferences = await databaseService.getUserSettings(userId)
        
        res.json(preferences)

    } catch (error) {
        console.error('Error fetching user preferences:', error)
        res.status(500).json({ error: 'Failed to fetch user preferences' })
    }
})

// Update user preferences
router.put('/api/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId)
        
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid user ID' })
            return
        }

        const { color_scheme } = req.body

        if (!color_scheme || !['standard', 'graded'].includes(color_scheme)) {
            res.status(400).json({ 
                error: 'Invalid color scheme. Must be "standard" or "graded"' 
            })
            return
        }

        await databaseService.updateUserSettings(userId, { color_scheme })
        
        const updatedPreferences = await databaseService.getUserSettings(userId)
        
        res.json({ 
            success: true, 
            preferences: updatedPreferences 
        })

    } catch (error) {
        console.error('Error updating user preferences:', error)
        res.status(500).json({ error: 'Failed to update user preferences' })
    }
})

export default router
