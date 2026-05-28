import { useCallback, useEffect, useRef, useState } from "react";

const SR =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

// Speech-to-text. onResult(text) is called with the running transcript.
const ERR_MSG = {
  "not-allowed":
    "Microphone blocked. Allow mic access (and in Brave, enable Web Speech at brave://settings/privacy) or use Chrome.",
  "service-not-allowed":
    "Speech service blocked by the browser. Brave disables this — use Chrome, or enable Google services in brave://settings/privacy.",
  network:
    "Speech recognition needs network access to Google's service, which this browser is blocking. Use Chrome.",
  "no-speech": "Didn't catch anything — try again and speak clearly.",
  "audio-capture": "No microphone found.",
  aborted: null,
};

export function useSpeechRecognition(onResult) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;
  const supported = !!SR;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SR || recRef.current) return;
    setError(null);
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      cbRef.current((finalText + interim).trim());
    };
    rec.onerror = (e) => {
      const msg = ERR_MSG[e.error];
      if (msg === undefined) setError(`Speech error: ${e.error}`);
      else if (msg !== null) setError(msg);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, []);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { supported, listening, error, start, stop };
}

// Text-to-speech. One utterance at a time; speak() toggles per id.
export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState(null);
  const uttRef = useRef(null); // keep a ref so the utterance isn't GC'd
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = useCallback(
    (id, text) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      const wasSpeaking = speakingId === id;
      synth.cancel();
      if (wasSpeaking) {
        setSpeakingId(null);
        return;
      }
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 4000));
      u.rate = 1;
      u.onend = () => setSpeakingId(null);
      u.onerror = () => setSpeakingId(null);
      uttRef.current = u; // hold reference (Chrome/Brave GC bug)
      setSpeakingId(id);
      // cancel() is async; defer speak so it actually starts.
      setTimeout(() => synth.speak(u), 60);
    },
    [supported, speakingId],
  );

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, speakingId, speak };
}
