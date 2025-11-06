import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simple component to test the Jest configuration
function TestComponent() {
    return (
        <div>
            <h1>Stock Monitor Test</h1>
            <p>Testing configuration is working!</p>
        </div>
    );
}

describe('Jest Configuration Test', () => {
    it('should render test component', () => {
        // Arrange & Act
        render(<TestComponent />);

        // Assert
        expect(screen.getByText('Stock Monitor Test')).toBeInTheDocument();
        expect(screen.getByText('Testing configuration is working!')).toBeInTheDocument();
    });

    it('should verify Jest and Testing Library are working', () => {
        // Arrange
        const testValue = 'Hello Jest';

        // Act & Assert
        expect(testValue).toBe('Hello Jest');
        expect(testValue).toHaveLength(10);
        expect(testValue).toContain('Jest');
    });

    it('should test async behavior', async () => {
        // Arrange
        const asyncFunction = () => Promise.resolve('async result');

        // Act
        const result = await asyncFunction();

        // Assert
        expect(result).toBe('async result');
    });
});
