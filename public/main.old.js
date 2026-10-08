const recordBtn = document.getElementById("record-button");
const transcript = document.getElementById("transcript");
const translationLanguage = document.getElementById("translation-language");
const translation = document.getElementById("translation");
var audio = document.getElementById("myAudio");
var source = document.getElementById("audioSource");

let isRecording = false;
let recorder;
let rt;
let micStream;

const resetUI = (label = "Start Voice Chat") => {
  recordBtn.innerText = label;
  recordBtn.disabled = false;
};

const stopAll = async () => {
  try {
    if (recorder) {
      recorder.stopRecording();
      recorder = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (rt) {
      await rt.close();
      rt = null;
    }
  } catch (e) {
    console.error("Stop error:", e);
  }
};

const handleFinalText = async (text) => {
  if (!text || !text.trim()) return;
  try {
    const response = await fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target_lang: translationLanguage.value }),
    });
    if (!response.ok) throw new Error(`/translate failed: ${response.status}`);
    const data = await response.json();

    const botText = data.textF || "";

    const printBotText = () => {
      translation.value += (translation.value ? "\n\n" : "") + "Bot: " + botText;
      translation.scrollTop = translation.scrollHeight;
    };

    if (data?.data?.audioContent) {
      source.src = `data:audio/mp3;base64,${data.data.audioContent}`;
      audio.load();
      audio.onplay = printBotText;          // print when bot starts speaking
      audio.play().catch((e) => {
        console.warn("Audio play blocked:", e);
        printBotText();                      // still print if audio fails
      });
    } else {
      console.warn("No audio from Google TTS - printing text only.");
      printBotText();
    }
  } catch (e) {
    console.error("Translate/TTS error:", e);
  }
};

const run = async () => {
  if (isRecording) {
    await stopAll();
    isRecording = false;
    resetUI();
    transcript.innerText = "";
    translation.innerText = "";
    return;
  }

  recordBtn.innerText = "Loading...";
  recordBtn.disabled = true;

  try {
    // 1. Get v3 temporary token from server
    const response = await fetch("/token");
    if (!response.ok) throw new Error(`/token failed: ${response.status}`);
    const data = await response.json();

    // 2. Create v3 streaming transcriber
    rt = new assemblyai.StreamingTranscriber({
      token: data.token,
      sampleRate: 16000,
    });

    const finishedTurns = [];

    rt.on("open", ({ id }) => {
      console.log("AssemblyAI session opened:", id);
    });

    rt.on("turn", async (turn) => {
      // Show finished turns + current partial text
      const live = turn.end_of_turn ? "" : turn.transcript;
      if (turn.end_of_turn) finishedTurns.push(turn.transcript);
      transcript.innerText = [...finishedTurns, live].join(" ").trim();

      if (turn.end_of_turn) {
        await handleFinalText(turn.transcript);
      }
    });

    rt.on("error", (error) => {
      console.error("AssemblyAI error:", error);
    });

    rt.on("close", (code, reason) => {
      console.log("AssemblyAI closed:", code, reason);
      rt = null;
      if (isRecording) {
        stopAll();
        isRecording = false;
        resetUI();
      }
    });

    // 3. Connect socket
    await rt.connect();

    // 4. Start microphone
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recorder = new RecordRTC(micStream, {
      type: "audio",
      mimeType: "audio/webm;codecs=pcm",
      recorderType: StereoAudioRecorder,
      timeSlice: 250,
      desiredSampRate: 16000,
      numberOfAudioChannels: 1,
      bufferSize: 4096,
      audioBitsPerSecond: 128000,
      ondataavailable: async (blob) => {
        if (!rt) return;
        const buffer = await blob.arrayBuffer();
        // Remove 44-byte WAV header -> raw PCM16
        rt.sendAudio(buffer.slice(44));
      },
    });

    recorder.startRecording();
    isRecording = true;
    recordBtn.innerText = "Stop Voice Chat";
    recordBtn.disabled = false;
  } catch (err) {
    console.error("Start failed:", err);
    await stopAll();
    isRecording = false;
    resetUI("Start Voice Chat (failed - see console)");
  }
};

recordBtn.addEventListener("click", () => {
  run();
});