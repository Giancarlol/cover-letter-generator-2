import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalDataPopup from '../PersonalDataPopup';

describe('PersonalDataPopup Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const initialData = {
    studies: 'Bachelor in Computer Science',
    experiences: ['Software Developer at Tech Co', 'Intern at Startup Inc']
  };

  beforeEach(() => {
    render(
      <PersonalDataPopup
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={initialData}
      />
    );
  });

  it('renders personal data form', () => {
    expect(screen.getByText('Personal Data')).toBeInTheDocument();
    expect(screen.getByLabelText(/Studies/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Experiences/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });

  it('displays initial data', () => {
    expect(screen.getByLabelText(/Studies/i)).toHaveValue(initialData.studies);
    expect(screen.getByLabelText(/Experiences/i)).toHaveValue(initialData.experiences.join('\n'));
  });

  it('validates empty fields', async () => {
    fireEvent.change(screen.getByLabelText(/Studies/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Experiences/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(screen.getByText('Studies information is required')).toBeInTheDocument();
      expect(screen.getByText('At least one experience is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const newStudies = 'Master in Data Science';
    const newExperiences = ['Data Analyst at Big Corp', 'Research Assistant at University'];

    fireEvent.change(screen.getByLabelText(/Studies/i), { target: { value: newStudies } });
    fireEvent.change(screen.getByLabelText(/Experiences/i), { target: { value: newExperiences.join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        studies: newStudies,
        experiences: newExperiences
      });
    });
  });

  it('calls onClose when close button is clicked', () => {
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
