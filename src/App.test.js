import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the hero heading', () => {
  render(<App />);
  const heading = screen.getByText(/welcome to void's corner/i);
  expect(heading).toBeInTheDocument();
});
