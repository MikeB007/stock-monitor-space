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

    describe('User Settings', () => {
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

    describe('User Operations', () => {
        describe('createUser', () => {
            it('should create a new user successfully', async () => {
                // Arrange
                const mockUser = {
                    username: 'testuser',
                    email: 'test@example.com'
                };
                const mockUserId = 1;

                jest.spyOn(databaseService, 'createUser').mockResolvedValue(mockUserId);

                // Act
                const result = await databaseService.createUser(mockUser);

                // Assert
                expect(result).toBe(mockUserId);
                expect(databaseService.createUser).toHaveBeenCalledWith(mockUser);
            });

            it('should handle duplicate user errors', async () => {
                // Arrange
                const duplicateUser = {
                    username: 'existinguser',
                    email: 'existing@example.com'
                };
                const mockError = new Error('User already exists');

                jest.spyOn(databaseService, 'createUser').mockRejectedValue(mockError);

                // Act & Assert
                await expect(databaseService.createUser(duplicateUser)).rejects.toThrow('User already exists');
            });
        });

        describe('getUsers', () => {
            it('should return list of all users', async () => {
                // Arrange
                const mockUsers = [
                    { id: 1, username: 'user1', email: 'user1@test.com' },
                    { id: 2, username: 'user2', email: 'user2@test.com' }
                ];

                jest.spyOn(databaseService, 'getUsers').mockResolvedValue(mockUsers);

                // Act
                const result = await databaseService.getUsers();

                // Assert
                expect(result).toEqual(mockUsers);
                expect(result).toHaveLength(2);
                expect(databaseService.getUsers).toHaveBeenCalledTimes(1);
            });

            it('should return empty array when no users exist', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getUsers').mockResolvedValue([]);

                // Act
                const result = await databaseService.getUsers();

                // Assert
                expect(result).toEqual([]);
                expect(result).toHaveLength(0);
            });
        });

        describe('getUserById', () => {
            it('should return user when found', async () => {
                // Arrange
                const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
                jest.spyOn(databaseService, 'getUserById').mockResolvedValue(mockUser);

                // Act
                const result = await databaseService.getUserById(1);

                // Assert
                expect(result).toEqual(mockUser);
                expect(databaseService.getUserById).toHaveBeenCalledWith(1);
            });

            it('should return null when user not found', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getUserById').mockResolvedValue(null);

                // Act
                const result = await databaseService.getUserById(999);

                // Assert
                expect(result).toBeNull();
                expect(databaseService.getUserById).toHaveBeenCalledWith(999);
            });
        });
    });

    describe('Watchlist Operations', () => {
        describe('createWatchlist', () => {
            it('should create a new watchlist successfully', async () => {
                // Arrange
                const mockWatchlist = {
                    user_id: 1,
                    name: 'Tech Stocks',
                    description: 'Technology sector watchlist'
                };
                const mockWatchlistId = 1;

                jest.spyOn(databaseService, 'createWatchlist').mockResolvedValue(mockWatchlistId);

                // Act
                const result = await databaseService.createWatchlist(mockWatchlist);

                // Assert
                expect(result).toBe(mockWatchlistId);
                expect(databaseService.createWatchlist).toHaveBeenCalledWith(mockWatchlist);
            });

            it('should handle errors when creating watchlist', async () => {
                // Arrange
                const mockWatchlist = {
                    user_id: 1,
                    name: '',
                    description: ''
                };
                const mockError = new Error('Watchlist name is required');

                jest.spyOn(databaseService, 'createWatchlist').mockRejectedValue(mockError);

                // Act & Assert
                await expect(databaseService.createWatchlist(mockWatchlist)).rejects.toThrow('Watchlist name is required');
            });
        });

        describe('getWatchlistsByUserId', () => {
            it('should return all watchlists for a user', async () => {
                // Arrange
                const mockWatchlists = [
                    { id: 1, user_id: 1, name: 'Tech Stocks', description: 'Tech' },
                    { id: 2, user_id: 1, name: 'Energy', description: 'Energy sector' }
                ];

                jest.spyOn(databaseService, 'getWatchlistsByUserId').mockResolvedValue(mockWatchlists);

                // Act
                const result = await databaseService.getWatchlistsByUserId(1);

                // Assert
                expect(result).toEqual(mockWatchlists);
                expect(result).toHaveLength(2);
                expect(databaseService.getWatchlistsByUserId).toHaveBeenCalledWith(1);
            });

            it('should return empty array when user has no watchlists', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getWatchlistsByUserId').mockResolvedValue([]);

                // Act
                const result = await databaseService.getWatchlistsByUserId(999);

                // Assert
                expect(result).toEqual([]);
                expect(result).toHaveLength(0);
            });
        });

        describe('getWatchlistById', () => {
            it('should return watchlist when found', async () => {
                // Arrange
                const mockWatchlist = { id: 1, user_id: 1, name: 'Tech Stocks', description: 'Tech' };
                jest.spyOn(databaseService, 'getWatchlistById').mockResolvedValue(mockWatchlist);

                // Act
                const result = await databaseService.getWatchlistById(1);

                // Assert
                expect(result).toEqual(mockWatchlist);
                expect(databaseService.getWatchlistById).toHaveBeenCalledWith(1);
            });

            it('should return null when watchlist not found', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getWatchlistById').mockResolvedValue(null);

                // Act
                const result = await databaseService.getWatchlistById(999);

                // Assert
                expect(result).toBeNull();
            });
        });

        describe('updateWatchlist', () => {
            it('should update watchlist successfully', async () => {
                // Arrange
                const updates = { name: 'Updated Tech Stocks', description: 'Updated description' };
                jest.spyOn(databaseService, 'updateWatchlist').mockResolvedValue(true);

                // Act
                const result = await databaseService.updateWatchlist(1, updates);

                // Assert
                expect(result).toBe(true);
                expect(databaseService.updateWatchlist).toHaveBeenCalledWith(1, updates);
            });

            it('should return false when watchlist not found', async () => {
                // Arrange
                const updates = { name: 'Updated Name' };
                jest.spyOn(databaseService, 'updateWatchlist').mockResolvedValue(false);

                // Act
                const result = await databaseService.updateWatchlist(999, updates);

                // Assert
                expect(result).toBe(false);
            });
        });

        describe('deleteWatchlist', () => {
            it('should delete watchlist successfully', async () => {
                // Arrange
                jest.spyOn(databaseService, 'deleteWatchlist').mockResolvedValue(true);

                // Act
                const result = await databaseService.deleteWatchlist(1);

                // Assert
                expect(result).toBe(true);
                expect(databaseService.deleteWatchlist).toHaveBeenCalledWith(1);
            });

            it('should return false when watchlist not found', async () => {
                // Arrange
                jest.spyOn(databaseService, 'deleteWatchlist').mockResolvedValue(false);

                // Act
                const result = await databaseService.deleteWatchlist(999);

                // Assert
                expect(result).toBe(false);
            });
        });
    });

    describe('Stock Operations', () => {
        describe('addWatchlistStock', () => {
            it('should add stock to watchlist successfully', async () => {
                // Arrange
                const stockData = {
                    symbol: 'AAPL',
                    description: 'Apple Inc.',
                    country: 'US',
                    market: 'NASDAQ',
                    exchange: 'NASDAQ'
                };
                const mockStockId = 1;

                jest.spyOn(databaseService, 'addWatchlistStock').mockResolvedValue(mockStockId);

                // Act
                const result = await databaseService.addWatchlistStock(1, stockData);

                // Assert
                expect(result).toBe(mockStockId);
                expect(databaseService.addWatchlistStock).toHaveBeenCalledWith(1, stockData);
            });

            it('should handle duplicate stock errors', async () => {
                // Arrange
                const stockData = {
                    symbol: 'AAPL',
                    description: 'Apple Inc.',
                    country: 'US',
                    market: 'NASDAQ',
                    exchange: 'NASDAQ'
                };
                const mockError = new Error('Stock already in watchlist');

                jest.spyOn(databaseService, 'addWatchlistStock').mockRejectedValue(mockError);

                // Act & Assert
                await expect(databaseService.addWatchlistStock(1, stockData)).rejects.toThrow('Stock already in watchlist');
            });
        });

        describe('removeWatchlistStock', () => {
            it('should remove stock from watchlist successfully', async () => {
                // Arrange
                jest.spyOn(databaseService, 'removeWatchlistStock').mockResolvedValue(true);

                // Act
                const result = await databaseService.removeWatchlistStock(1, 'AAPL');

                // Assert
                expect(result).toBe(true);
                expect(databaseService.removeWatchlistStock).toHaveBeenCalledWith(1, 'AAPL');
            });

            it('should return false when stock not found in watchlist', async () => {
                // Arrange
                jest.spyOn(databaseService, 'removeWatchlistStock').mockResolvedValue(false);

                // Act
                const result = await databaseService.removeWatchlistStock(1, 'INVALID');

                // Assert
                expect(result).toBe(false);
            });
        });

        describe('getWatchlistStocks', () => {
            it('should return all stocks in a watchlist', async () => {
                // Arrange
                const mockStocks = [
                    {
                        id: 1,
                        Watchlist_id: 1,
                        stock_id: 1,
                        symbol: 'AAPL',
                        description: 'Apple Inc.',
                        country: 'US',
                        market: 'NASDAQ',
                        exchange: 'NASDAQ'
                    },
                    {
                        id: 2,
                        Watchlist_id: 1,
                        stock_id: 2,
                        symbol: 'GOOGL',
                        description: 'Alphabet Inc.',
                        country: 'US',
                        market: 'NASDAQ',
                        exchange: 'NASDAQ'
                    }
                ];

                jest.spyOn(databaseService, 'getWatchlistStocks').mockResolvedValue(mockStocks);

                // Act
                const result = await databaseService.getWatchlistStocks(1);

                // Assert
                expect(result).toEqual(mockStocks);
                expect(result).toHaveLength(2);
                expect(databaseService.getWatchlistStocks).toHaveBeenCalledWith(1);
            });

            it('should return empty array when watchlist has no stocks', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getWatchlistStocks').mockResolvedValue([]);

                // Act
                const result = await databaseService.getWatchlistStocks(1);

                // Assert
                expect(result).toEqual([]);
                expect(result).toHaveLength(0);
            });
        });

        describe('getStockBySymbol', () => {
            it('should return stock when found', async () => {
                // Arrange
                const mockStock = {
                    id: 1,
                    symbol: 'AAPL',
                    description: 'Apple Inc.',
                    country: 'US',
                    market: 'NASDAQ',
                    exchange: 'NASDAQ'
                };
                jest.spyOn(databaseService, 'getStockBySymbol').mockResolvedValue(mockStock);

                // Act
                const result = await databaseService.getStockBySymbol('AAPL');

                // Assert
                expect(result).toEqual(mockStock);
                expect(databaseService.getStockBySymbol).toHaveBeenCalledWith('AAPL');
            });

            it('should return null when stock not found', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getStockBySymbol').mockResolvedValue(null);

                // Act
                const result = await databaseService.getStockBySymbol('INVALID');

                // Assert
                expect(result).toBeNull();
            });
        });
    });

    describe('User Preferences', () => {
        describe('getUserPreferences', () => {
            it('should return preferences for valid browser ID', async () => {
                // Arrange
                const mockPrefs = { last_viewed_user_id: 1 };
                jest.spyOn(databaseService, 'getUserPreferences').mockResolvedValue(mockPrefs);

                // Act
                const result = await databaseService.getUserPreferences('browser-123');

                // Assert
                expect(result).toEqual(mockPrefs);
                expect(databaseService.getUserPreferences).toHaveBeenCalledWith('browser-123');
            });

            it('should return null when preferences not found', async () => {
                // Arrange
                jest.spyOn(databaseService, 'getUserPreferences').mockResolvedValue(null);

                // Act
                const result = await databaseService.getUserPreferences('unknown-browser');

                // Assert
                expect(result).toBeNull();
            });
        });

        describe('saveUserPreferences', () => {
            it('should save user preferences successfully', async () => {
                // Arrange
                jest.spyOn(databaseService, 'saveUserPreferences').mockResolvedValue(undefined);

                // Act
                await databaseService.saveUserPreferences('browser-123', 1);

                // Assert
                expect(databaseService.saveUserPreferences).toHaveBeenCalledWith('browser-123', 1);
            });

            it('should handle save errors', async () => {
                // Arrange
                const mockError = new Error('Failed to save preferences');
                jest.spyOn(databaseService, 'saveUserPreferences').mockRejectedValue(mockError);

                // Act & Assert
                await expect(databaseService.saveUserPreferences('browser-123', 1)).rejects.toThrow('Failed to save preferences');
            });
        });
    });
});
