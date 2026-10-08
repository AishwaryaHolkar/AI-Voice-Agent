const express = require("express");
// const deepl = require("deepl-node");
const { AssemblyAI } = require("assemblyai");
// Imports the Google Cloud client library
const axios = require("axios");
const cors = require("cors");
const { OpenAI } = require('openai');

// Import other required libraries
const fs = require("fs");
const util = require("util");
const { error } = require("console");

require("dotenv").config();

// Creates a client

const authKey = process.env.DEEPL_API_KEY;
//const translator = new deepl.Translator(authKey);

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/token", async (req, res) => {
  try {
    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: 60,
    });
    res.json({ token });
  } catch (err) {
    console.error("Failed to create AssemblyAI token:", err);
    res.status(500).json({ error: "Could not create token" });
  }
});

app.post("/translate", async (req, res) => {
  const { text, target_lang } = req.body;
  //const translation = await translator.translateText(text, "en", target_lang);
  const  prompt   = `You are a helpful and enthusiastic and empathetic chat bot who can answer user's question : ${text}.Always speak as if you were chatting to a friend.Please reply in only 20-30 words.`
          const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });
  //console.log(completion.choices[0].message.content, target_lang);
  const data = await quickStart(completion.choices[0].message.content, target_lang);
  var textF = completion.choices[0].message.content;

  res.json({ textF, data });
});

async function quickStart(textTranslated, language) {
  try {

    var langCode = "en-US";
    var langTRanslator = "en-US-Chirp3-HD-Pulcherrima";
    if (language == "es") {
      langCode = "en-US";
      langTRanslator = "en-US-Chirp3-HD-Sulafat";
    } else if (language == "de") {
      langCode = "en-US";
      langTRanslator = "en-US-Chirp3-HD-Schedar";
    } else if (language == "fr") {
      langCode = "en-US";
      langTRanslator = "en-US-Chirp3-HD-Vindemiatrix";
    } else if(language == "it"){
      langCode = "en-US";
      langTRanslator = "en-US-Chirp3-HD-Sadaltager";
    }
    const apiKey = process.env.GOOGLE_API_KEY;
    const endPoint = `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`;
    const payload = {
      audioConfig: {
        audioEncoding: "MP3",
        pitch: 0,
        speakingRate: 1,
      },
      input: {
        text: `${textTranslated}`,
      },
      voice: {
        languageCode: `${langCode}`,
        name: `${langTRanslator}`,
      },
    };
    const response = await axios.post(endPoint, payload);
    //console.log(response)
    if (response?.data) {
      return response.data;
    }
  } catch (e) {
    console.log(e);
  }
}

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

server.setTimeout(60000);
