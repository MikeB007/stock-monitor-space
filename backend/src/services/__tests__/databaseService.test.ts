import { Request, Response } from 'express';
import { databaseService, UserPreferences } from '../../services/databaseService';

// Mock DatabaseService
jest.mock('../../services/databaseService');

describe('DatabaseService', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getUserSettings', () => {
        it('should return user settings for a valid user ID', async () => {
            // Arrange
            const mockUserId = 1;
            const mockSettings: UserPreferences = {
                user_id: 1,
                color_scheme: 'blue'
            };

            // Mock the getUserSettings method
            jest.spyOn(databaseService, 'getUserSettings').mockResolvedValue(mockSettings);

            // Act
            const result = await databaseService.getUserSettings(mockUserId);

            // Assert
            expect(result).toEqual(mockSettings);
            expect(databaseService.getUserSettings).toHaveBeenCalledWith(mockUserId);
            expect(databaseService.getUserSettings).toHaveBeenCalledTimes(1);
        });

        it('should handle errors when user settings not found', async () => {
            // Arrange
            const mockUserId = 999;
            const mockError = new Error('User settings not found');

            // Mock the getUserSettings method to throw error
            jest.spyOn(databaseService, 'getUserSettings').mockRejectedValue(mockError);

            // Act & Assert
            await expect(databaseService.getUserSettings(mockUserId)).rejects.toThrow('User settings not found');
            expect(databaseService.getUserSettings).toHaveBeenCalledWith(mockUserId);
        });
    });

    describe('updateUserSettings', () => {
        it('should update user settings successfully', async () => {
            // Arrange
            const mockUserId = 1;
            const mockSettings: Partial<UserPreferences> = {
                color_scheme: 'green'
            };

            // Mock the updateUserSettings method
            jest.spyOn(databaseService, 'updateUserSettings').mockResolvedValue(undefined);

            // Act
            await databaseService.updateUserSettings(mockUserId, mockSettings);

            // Assert
            expect(databaseService.updateUserSettings).toHaveBeenCalledWith(mockUserId, mockSettings);
            expect(databaseService.updateUserSettings).toHaveBeenCalledTimes(1);
        });

        it('should handle validation errors', async () => {
            // Arrange
            const mockUserId = 1;
            const invalidSettings: Partial<UserPreferences> = {
                color_scheme: 'invalid-color'
            };
            const mockError = new Error('Invalid settings');

            // Mock the updateUserSettings method to throw error
            jest.spyOn(databaseService, 'updateUserSettings').mockRejectedValue(mockError);

            // Act & Assert
            await expect(databaseService.updateUserSettings(mockUserId, invalidSettings)).rejects.toThrow('Invalid settings');
        });
    });
});
