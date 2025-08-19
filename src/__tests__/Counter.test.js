import { render, fireEvent } from '@testing-library/svelte';
import Counter from '../lib/Counter.svelte';

test('it increments when clicked', async () => {
  const { getByText } = render(Counter);
  const button = getByText(/count is/i);
  await fireEvent.click(button);
  expect(button).toHaveTextContent('count is 1');
});
