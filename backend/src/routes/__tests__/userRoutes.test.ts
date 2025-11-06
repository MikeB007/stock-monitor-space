import request from 'supertest';
import express, { Express } from 'express';
import userRoutes from '../../routes/userRoutes';
import { databaseService } from '../../services/databaseService';

// Mock the database service
jest.mock('../../services/databaseService');

describe('User Routes', () => {
    let app: Express;

    beforeEach(() => {
        // Create a fresh Express app for each test
        app = express();
        app.use(express.json());
        app.use('/api', userRoutes);

        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    describe('GET /api/users', () => {
        it('should return list of all users', async () => {
            // Arrange
            const mockUsers = [
                { id: 1, username: 'user1', email: 'user1@test.com' },
                { id: 2, username: 'user2', email: 'user2@test.com' }
            ];
            jest.spyOn(databaseService, 'getUsers').mockResolvedValue(mockUsers);
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(true);

            // Act
            const response = await request(app)
                .get('/api/users')
                .expect('Content-Type', /json/)
                .expect(200);

            // Assert
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockUsers);
            expect(response.body.count).toBe(2);
            expect(databaseService.getUsers).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no users exist', async () => {
            // Arrange
            jest.spyOn(databaseService, 'getUsers').mockResolvedValue([]);
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(true);

            // Act
            const response = await request(app)
                .get('/api/users')
                .expect(200);

            // Assert
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
            expect(response.body.count).toBe(0);
        });

        it('should handle database errors', async () => {
            // Arrange
            jest.spyOn(databaseService, 'getUsers').mockRejectedValue(new Error('Database connection failed'));
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(true);

            // Act
            const response = await request(app)
                .get('/api/users')
                .expect(500);

            // Assert
            expect(response.body.success).toBe(false);
            expect(response.body).toHaveProperty('error');
        });

        it('should return 503 when database is not connected', async () => {
            // Arrange
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(false);

            // Act
            const response = await request(app)
                .get('/api/users')
                .expect(503);

            // Assert
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Database not connected');
        });
    });

    describe('GET /api/users/:id', () => {
        it('should return user by ID when found', async () => {
            // Arrange
            const mockUser = { id: 1, username: 'testuser', email: 'test@example.com' };
            jest.spyOn(databaseService, 'getUserById').mockResolvedValue(mockUser);
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(true);

            // Act
            const response = await request(app)
                .get('/api/users/1')
                .expect(200);

            // Assert
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockUser);
            expect(databaseService.getUserById).toHaveBeenCalledWith(1);
        });

        it('should return 404 when user not found', async () => {
            // Arrange
            jest.spyOn(databaseService, 'getUserById').mockResolvedValue(null);
            jest.spyOn(databaseService, 'isConnected').mockReturnValue(true);

            // Act
            const response = await request(app)
                .get('/api/users/999')
                .expect(404);

            // Assert
            expect(response.body.success).toBe(false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('not found');
        });
    });

    describe('POST /api/users', () => {
        it('should create a new user successfully', async () => {
            // Arrange
            const newUser = {
                username: 'newuser',
                email: 'newuser@example.com'
            };
            const mockInsertId = 1;
            jest.spyOn(databaseService, 'createUser').mockResolvedValue(mockInsertId);

            // Act
            const response = await request(app)
                .post('/api/users')
                .send(newUser)
                .expect('Content-Type', /json/)
                .expect(201);

            // Assert
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id', mockInsertId);
            expect(response.body.data.username).toBe(newUser.username);
            expect(databaseService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    username: newUser.username,
                    email: newUser.email
                })
            );
        });

        it('should return 400 when username is missing', async () => {
            // Arrange
            const invalidUser = {
                email: 'test@example.com'
                // missing username
            };

            // Act
            const response = await request(app)
                .post('/api/users')
                .send(invalidUser)
                .expect(400);

            // Assert
            expect(response.body.success).toBe(false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('username');
            expect(databaseService.createUser).not.toHaveBeenCalled();
        });

        it('should handle duplicate username errors', async () => {
            // Arrange
            const duplicateUser = {
                username: 'existinguser',
                email: 'new@example.com'
            };
            jest.spyOn(databaseService, 'createUser').mockRejectedValue(
                new Error('Duplicate entry for username')
            );

            // Act
            const response = await request(app)
                .post('/api/users')
                .send(duplicateUser)
                .expect(409);

            // Assert
            expect(response.body.success).toBe(false);
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('already exists');
        });
    });
});
