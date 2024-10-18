# AI Cover Letter Generator

This application helps you generate personalized cover letters based on your personal data and job advertisements using OpenAI's GPT model.

## Setup

1. Clone this repository to your local machine.
2. Install the dependencies by running `npm install` in the project directory.
3. Create a `.env` file in the root of the project directory.
4. Add your OpenAI API key to the `.env` file:

   ```
   VITE_OPENAI_API_KEY=your_actual_api_key_here
   ```

   Replace `your_actual_api_key_here` with your real OpenAI API key.

5. Start the development server by running `npm run dev`.

## Usage

1. Fill in your personal data in the form provided.
2. Paste the job advertisement text into the designated area.
3. Click on "Generate Cover Letter" to create a personalized cover letter.

## Important Notes

- Keep your API key confidential and never share it publicly.
- This application is for demonstration purposes. In a production environment, API calls should be made from a secure backend to protect your API key.

## Troubleshooting

If you encounter an "Invalid API key" error:
1. Double-check that you've created the `.env` file in the project root.
2. Ensure that the API key in the `.env` file is correct and properly formatted.
3. Restart the development server after making changes to the `.env` file.

For any other issues, please check the console for error messages and refer to the OpenAI API documentation.