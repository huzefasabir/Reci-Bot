require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const path = require('path');
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // serve index.html from root

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


if (!API_KEY) {
    console.error("API_KEY is missing in the environment variables. Make sure to set it in the .env file.");
    process.exit(1);
}

app.get('/get-api-key', (_, res) => {
    try {
        console.log("API Key requested via GET");
        res.json({ apiKey: API_KEY });
    } catch (error) {
        console.error("Error retrieving API key:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/fetch-recipe', async (req, res) => {
    try {
        const { promptText } = req.body;
        if (!promptText) {
            return res.status(400).json({ error: "promptText is required" });
        }

        const apiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`,
            {
                contents: [{ role: "user", parts: [{ text: promptText }] }]
            },
            { headers: { "Content-Type": "application/json" } }
        );

        if (!apiResponse.data || !apiResponse.data.candidates) {
            return res.status(500).json({ error: "Unexpected response format from API" });
        }

        res.json(apiResponse.data);
    } catch (error) {
        console.error("Error fetching recipe:", error);
        res.status(500).json({ error: error.response?.data || error.message });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
